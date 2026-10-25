import { createHash } from "node:crypto";
import type { Auth } from "firebase-admin/auth";
import type { Firestore } from "firebase-admin/firestore";
import { z } from "zod/v4";

const schema = z
  .object({
    email: z
      .email()
      .max(254)
      .refine((email) => !email.includes("/")),
    mode: z.enum(["setup", "reset"]),
  })
  .strict();
const message =
  "If this email has active PG access, a password link will be sent. Check your inbox and spam folder. A password reset does not restore removed PG access.";
export async function handleAccountEmail(
  request: Request,
  dependencies: {
    auth: Auth;
    db: Firestore;
    apiKey: string;
    appUrl: string;
    ip: string;
    fetcher?: typeof fetch;
  },
) {
  const { auth, db, apiKey, appUrl, ip, fetcher = fetch } = dependencies;
  const reply = (status: number, body: object) =>
    Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
  if (request.method !== "POST") return reply(405, { error: "Use POST." });
  try {
    if (
      request.headers.get("origin") &&
      request.headers.get("origin") !== new URL(appUrl).origin
    )
      return reply(403, { error: "This app address is not authorized." });
    const raw = await request.text();
    if (raw.length > 2048)
      return reply(413, { error: "Request is too large." });
    const parsed = schema.safeParse(JSON.parse(raw));
    if (!parsed.success)
      return reply(400, { error: "Enter a valid email address." });
    const email = parsed.data.email.trim().toLowerCase();
    const grantRef = db.doc(`emailAccess/${email}`);
    const hash = (value: string) =>
      createHash("sha256").update(value).digest("hex");
    const limits = [
      { ref: db.doc(`accountEmailLimits/${hash(`email:${email}`)}`), max: 3 },
      { ref: db.doc(`accountEmailLimits/${hash(`ip:${ip}`)}`), max: 15 },
      { ref: db.doc("accountEmailLimits/global"), max: 100 },
    ];
    const hour = Math.floor(Date.now() / 3_600_000);
    const limited = await db.runTransaction(async (tx) => {
      const snapshots = await Promise.all(
        limits.map((limit) => tx.get(limit.ref)),
      );
      const counts = snapshots.map((item) =>
        item.data()?.hour === hour ? Number(item.data()?.count || 0) : 0,
      );
      if (limits.some((limit, index) => counts[index] >= limit.max))
        return true;
      limits.forEach((limit, index) =>
        tx.set(limit.ref, { hour, count: counts[index] + 1 }),
      );
      return false;
    });
    if (limited)
      return reply(429, {
        error: "Too many requests. Please wait before trying again.",
      });
    const grant = (await grantRef.get()).data();
    let user;
    try {
      user = await auth.getUserByEmail(email);
    } catch (error) {
      if ((error as { code?: string }).code !== "auth/user-not-found")
        throw error;
    }
    if (user?.disabled) return reply(200, { message });
    // Existing original owners are recognized by their server-owned PG records.
    const originalOwner =
      user &&
      (
        await db
          .doc(`accounts/${user.uid}/records/settings/items/property`)
          .get()
      ).exists;
    const allowed = async () => {
      if (originalOwner) return true;
      const current = (await grantRef.get()).data();
      if (
        !current ||
        current.revoked === true ||
        current.ownerUid !== grant?.ownerUid ||
        current.role !== grant?.role ||
        current.tenantId !== grant?.tenantId
      )
        return false;
      if (
        !["super_admin", "admin", "staff", "tenant"].includes(
          String(current.role),
        )
      )
        return false;
      if (current.role === "tenant") {
        const [profile, stays] = await Promise.all([
          db
            .doc(`accounts/${current.ownerUid}/portal/${current.tenantId}`)
            .get(),
          db
            .collection(
              `accounts/${current.ownerUid}/records/occupancies/items`,
            )
            .where("tenantId", "==", current.tenantId)
            .where("end", "==", null)
            .get(),
        ]);
        return profile.data()?.active !== false && !stays.empty;
      }
      return true;
    };
    if (!(await allowed())) return reply(200, { message });
    // Only a saved, non-revoked invitation can create a login. No password is accepted here.
    if (!user && parsed.data.mode === "setup") {
      try {
        user = await auth.createUser({ email, emailVerified: false });
      } catch (error) {
        if ((error as { code?: string }).code !== "auth/email-already-exists")
          throw error;
        user = await auth.getUserByEmail(email);
      }
    }
    if (!user || user.disabled || !(await allowed()))
      return reply(200, { message });
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
    if (!response.ok)
      console.warn("Account password email was not accepted", {
        status: response.status,
      });
    // Same public response for absent, revoked, accepted and provider-rejected accounts.
    return reply(200, { message });
  } catch (error) {
    if (error instanceof SyntaxError)
      return reply(400, { error: "Invalid request." });
    console.error("Account password request could not be completed.");
    return reply(503, {
      error:
        "Could not confirm the request. Check your inbox before trying again.",
    });
  }
}
