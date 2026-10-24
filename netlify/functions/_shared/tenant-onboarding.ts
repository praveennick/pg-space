import type { Auth, DecodedIdToken, UserRecord } from "firebase-admin/auth";
import type { Firestore } from "firebase-admin/firestore";
import { randomUUID } from "node:crypto";
import { z } from "zod/v4";
import { firebaseEmailFailure } from "./firebase-email-errors";

type Dependencies = {
  auth: Auth;
  db: Firestore;
  apiKey: string;
  appUrl: string;
  fetcher?: typeof fetch;
  now?: () => number;
};
class Failure extends Error {
  constructor(
    public status: number,
    message: string,
    public providerCode?: string,
  ) {
    super(message);
  }
}
const identifier = z
  .string()
  .min(1)
  .max(128)
  .refine((value) => !value.includes("/"));
const bodySchema = z
  .object({
    ownerUid: identifier,
    tenantId: identifier,
    resend: z.boolean().default(false),
  })
  .strict();
const normalizedEmail = (value: unknown) => {
  const email = String(value || "")
    .trim()
    .toLowerCase();
  if (!z.email().safeParse(email).success || email.includes("/"))
    throw new Failure(400, "Add a valid resident email first.");
  return email;
};
const reply = (status: number, body: object) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export function assertTenantAccess(
  existing: Record<string, unknown> | undefined,
  ownerUid: string,
  tenantId: string,
) {
  if (
    existing &&
    (existing.ownerUid !== ownerUid ||
      existing.role !== "tenant" ||
      existing.tenantId !== tenantId)
  )
    throw new Failure(
      409,
      "This email already has a different account role or resident link. Ask a super admin to review Team & access.",
    );
}

export async function handleTenantOnboarding(
  request: Request,
  dependencies: Dependencies,
): Promise<Response> {
  const {
    auth,
    db,
    apiKey,
    appUrl,
    fetcher = fetch,
    now = Date.now,
  } = dependencies;
  if (request.method !== "POST") return reply(405, { error: "Use POST." });
  let inviteRef: ReturnType<Firestore["doc"]> | undefined;
  let reserved = false;
  let emailRequestStarted = false;
  const attemptId = randomUUID();
  try {
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(appUrl).origin)
      throw new Failure(403, "This app address is not authorized.");
    const bearer = request.headers.get("authorization") || "";
    if (!bearer.startsWith("Bearer ") || bearer.length > 8192)
      throw new Failure(401, "Sign in before inviting a resident.");
    let actor: DecodedIdToken;
    try {
      actor = await auth.verifyIdToken(bearer.slice(7), true);
    } catch {
      throw new Failure(401, "Your sign-in expired. Sign in again.");
    }
    const raw = await request.text();
    if (raw.length > 4096) throw new Failure(413, "Request is too large.");
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Failure(400, "Invalid request.");
    }
    const result = bodySchema.safeParse(parsed);
    if (!result.success) throw new Failure(400, "Choose a saved resident.");
    const { ownerUid, tenantId, resend } = result.data;
    const actorEmail = actor.email ? normalizedEmail(actor.email) : "";
    const actorRef = actorEmail ? db.doc(`emailAccess/${actorEmail}`) : null;
    const permitted = (assignment?: Record<string, unknown>) =>
      actor.uid === ownerUid ||
      (actor.email_verified === true &&
        assignment?.ownerUid === ownerUid &&
        ["admin", "super_admin"].includes(String(assignment.role)));
    const actorGrant =
      actor.uid !== ownerUid && actorRef
        ? (await actorRef.get()).data()
        : undefined;
    if (!permitted(actorGrant))
      throw new Failure(
        403,
        "Only admins and super admins can send resident login emails.",
      );
    const tenantRef = db.doc(
      `accounts/${ownerUid}/records/tenants/items/${tenantId}`,
    );
    const settingsRef = db.doc(
      `accounts/${ownerUid}/records/settings/items/property`,
    );
    const [tenantDocument, settingsDocument, links] = await Promise.all([
      tenantRef.get(),
      settingsRef.get(),
      db
        .collection("emailAccess")
        .where("ownerUid", "==", ownerUid)
        .where("tenantId", "==", tenantId)
        .get(),
    ]);
    if (!tenantDocument.exists || !settingsDocument.exists)
      throw new Failure(404, "Resident or PG details were not found.");
    const tenant = tenantDocument.data()!;
    const email = normalizedEmail(tenant.email);
    if (email === actorEmail)
      throw new Failure(
        409,
        "The resident's email must be different from your signed-in account.",
      );
    if (links.docs.some((link) => link.id !== email))
      throw new Failure(
        409,
        "This resident already has a login using another email. Review Team & access before sending a new invitation.",
      );
    const workspaceName = String(settingsDocument.data()!.name || "My PG");
    let user: UserRecord | undefined;
    try {
      user = await auth.getUserByEmail(email);
    } catch (cause) {
      if ((cause as { code?: string }).code !== "auth/user-not-found")
        throw cause;
    }
    if (user?.disabled)
      throw new Failure(
        409,
        "This account is disabled. Ask the owner to review it.",
      );
    if (
      user &&
      (
        await db
          .doc(`accounts/${user.uid}/records/settings/items/property`)
          .get()
      ).exists
    )
      throw new Failure(
        409,
        "This email belongs to a PG owner account and cannot be assigned tenant access.",
      );
    const grantRef = db.doc(`emailAccess/${email}`);
    inviteRef = db.doc(`accounts/${ownerUid}/tenantOnboarding/${tenantId}`);
    const rateRef = db.doc(`accounts/${ownerUid}/control/tenantInviteRate`);
    const time = now();
    const hour = Math.floor(time / 3_600_000);
    const cached = await db.runTransaction(async (transaction) => {
      const [grant, invitation, rate, freshTenant, freshActor] =
        await Promise.all([
          transaction.get(grantRef),
          transaction.get(inviteRef!),
          transaction.get(rateRef),
          transaction.get(tenantRef),
          actor.uid !== ownerUid && actorRef
            ? transaction.get(actorRef)
            : Promise.resolve(null),
        ]);
      if (!permitted(freshActor?.data()))
        throw new Failure(
          403,
          "Your account no longer has permission to invite residents.",
        );
      if (
        !freshTenant.exists ||
        normalizedEmail(freshTenant.data()!.email) !== email
      )
        throw new Failure(
          409,
          "Resident details changed. Refresh before inviting them.",
        );
      assertTenantAccess(
        grant.exists ? grant.data() : undefined,
        ownerUid,
        tenantId,
      );
      const previous = invitation.data();
      if (
        previous?.email === email &&
        previous.status === "submitted" &&
        !resend
      )
        return true;
      if (
        previous?.status === "processing" &&
        time - Number(previous.startedAt || 0) < 120_000
      )
        throw new Failure(
          409,
          "A login email is already being prepared. Please wait before trying again.",
        );
      if (previous?.status === "processing" && !resend)
        throw new Failure(
          409,
          "The earlier login email request could not be confirmed. Check the inbox before choosing Send login email again.",
        );
      if (previous?.status === "uncertain" && !resend)
        throw new Failure(
          409,
          "The previous email request could not be confirmed. Check the inbox before choosing Send login email again.",
        );
      const accountAttempts =
        rate.data()?.hour === hour ? Number(rate.data()?.attempts || 0) : 0;
      const residentAttempts =
        previous?.hour === hour ? Number(previous.attempts || 0) : 0;
      if (accountAttempts >= 30 || residentAttempts >= 3)
        throw new Failure(
          429,
          `Too many login email requests. Please try again in ${Math.max(1, Math.ceil(((hour + 1) * 3_600_000 - time) / 60_000))} minutes.`,
        );
      transaction.set(rateRef, { hour, attempts: accountAttempts + 1 });
      transaction.set(inviteRef!, {
        email,
        hour,
        attempts: residentAttempts + 1,
        status: "processing",
        attemptId,
        startedAt: time,
        requestedBy: actor.uid,
      });
      transaction.set(grantRef, {
        email,
        ownerUid,
        workspaceName,
        role: "tenant",
        tenantId,
        label: String(tenant.name || "").slice(0, 100),
      });
      transaction.set(db.doc(`accounts/${ownerUid}/portal/${tenantId}`), {
        name: String(tenant.name || ""),
        email,
        phone: String(tenant.phone || ""),
        occupation: String(tenant.occupation || ""),
      });
      return false;
    });
    if (cached) return reply(200, { email, status: "already_submitted" });
    reserved = true;
    if (!user) {
      try {
        user = await auth.createUser({
          email,
          displayName: String(tenant.name || "Resident").slice(0, 128),
          emailVerified: false,
        });
      } catch (cause) {
        if ((cause as { code?: string }).code !== "auth/email-already-exists")
          throw cause;
        user = await auth.getUserByEmail(email);
        if (user.disabled) throw new Failure(409, "This account is disabled.");
      }
    }
    emailRequestStarted = true;
    const response = await fetcher(
      `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestType: "PASSWORD_RESET",
          email,
          continueUrl: new URL("/app", appUrl).href,
        }),
        signal: AbortSignal.timeout(15_000),
      },
    );
    if (!response.ok) {
      if (response.status < 500) emailRequestStarted = false;
      const provider = firebaseEmailFailure(
        response.status,
        await response.json().catch(() => null),
      );
      console.warn("Firebase password-setup request rejected", {
        status: response.status,
        code: provider.code,
      });
      throw new Failure(provider.status, provider.message, provider.code);
    }
    try {
      await db.runTransaction(async (transaction) => {
        const current = (await transaction.get(inviteRef!)).data();
        if (current?.attemptId !== attemptId) return;
        transaction.set(inviteRef!, {
          ...current,
          status: "submitted",
          authUid: user!.uid,
          submittedAt: now(),
        });
      });
    } catch {
      console.error("Tenant login email accepted; status persistence failed.");
    }
    return reply(200, { email, status: "submitted" });
  } catch (cause) {
    if (reserved && inviteRef) {
      try {
        await db.runTransaction(async (transaction) => {
          const current = (await transaction.get(inviteRef!)).data();
          if (
            current?.attemptId !== attemptId ||
            current.status !== "processing"
          )
            return;
          const credit =
            !emailRequestStarted &&
            cause instanceof Failure &&
            [
              "UNAUTHORIZED_DOMAIN",
              "INVALID_CONTINUE_URI",
              "API_KEY_INVALID",
              "API_KEY_RESTRICTED",
              "PASSWORD_LOGIN_DISABLED",
              "EMAIL_NOT_FOUND",
            ].includes(cause.providerCode || "");
          transaction.set(inviteRef!, {
            ...current,
            ...(credit
              ? {
                  attempts: Math.max(0, Number(current.attempts) - 1),
                  creditedFailedAttempt: attemptId,
                }
              : {}),
            status: emailRequestStarted ? "uncertain" : "failed",
            updatedAt: now(),
            ...(cause instanceof Failure && cause.providerCode
              ? { errorCode: cause.providerCode }
              : {}),
          });
        });
      } catch {
        console.error("Tenant login failure status could not be saved.");
      }
    }
    if (cause instanceof Failure)
      return reply(cause.status, {
        error: cause.message,
        ...(cause.providerCode ? { code: cause.providerCode } : {}),
      });
    console.error("Tenant login setup failed.");
    return reply(500, {
      error: emailRequestStarted
        ? "The email request could not be confirmed. Check the inbox before sending it again."
        : "Login setup could not be completed. The resident record is still saved; ask the owner to check the server configuration.",
    });
  }
}
