import type { Auth } from "firebase-admin/auth";
import type { Firestore } from "firebase-admin/firestore";
import { z } from "zod/v4";

const identifier = z
  .string()
  .min(1)
  .max(128)
  .refine((value) => !value.includes("/"));
const schema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("remove"),
      ownerUid: identifier,
      email: z
        .email()
        .max(254)
        .refine((value) => !value.includes("/")),
    })
    .strict(),
  z.object({ action: z.literal("session"), ownerUid: identifier }).strict(),
  z
    .object({
      action: z.literal("checkout"),
      ownerUid: identifier,
      tenantId: identifier,
    })
    .strict(),
  z
    .object({
      action: z.literal("ticket"),
      ownerUid: identifier,
      category: z.enum([
        "Electrical",
        "Plumbing",
        "Cleaning",
        "Wi-Fi",
        "Other",
      ]),
      description: z.string().trim().min(3).max(2000),
    })
    .strict(),
]);
class Rejected extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function handleAccountAction(
  request: Request,
  auth: Auth,
  db: Firestore,
  appUrl: string,
) {
  const reply = (status: number, body: object) =>
    Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
  try {
    if (request.method !== "POST") return reply(405, { error: "Use POST." });
    if (
      request.headers.get("origin") &&
      request.headers.get("origin") !== new URL(appUrl).origin
    )
      throw new Rejected(403, "This app address is not authorized.");
    const bearer = request.headers.get("authorization") || "";
    if (!bearer.startsWith("Bearer ") || bearer.length > 8192)
      throw new Rejected(401, "Sign in again.");
    let actor;
    try {
      actor = await auth.verifyIdToken(bearer.slice(7), true);
    } catch {
      throw new Rejected(401, "Your sign-in expired. Sign in again.");
    }
    const raw = await request.text();
    if (raw.length > 8192) throw new Rejected(413, "Request is too large.");
    const parsed = schema.safeParse(JSON.parse(raw));
    if (!parsed.success) throw new Rejected(400, "Check the request details.");
    const input = parsed.data;
    const email = actor.email?.toLowerCase() || "";
    const actorGrant = email
      ? (await db.doc(`emailAccess/${email}`).get()).data()
      : undefined;
    const role =
      actor.uid === input.ownerUid
        ? "super_admin"
        : actor.email_verified && actorGrant?.ownerUid === input.ownerUid
          ? actorGrant.role
          : "";
    if (input.action === "ticket" || input.action === "session") {
      if (role !== "tenant")
        throw new Rejected(
          403,
          "Only a resident can submit their own repair request here.",
        );
      const tenantId = String(actorGrant!.tenantId);
      const stays = await db
        .collection(`accounts/${input.ownerUid}/records/occupancies/items`)
        .where("tenantId", "==", tenantId)
        .where("end", "==", null)
        .get();
      const stay = stays.docs[0];
      if (input.action === "session") {
        const active = await db.runTransaction(async (tx) => {
          const grant = (await tx.get(db.doc(`emailAccess/${email}`))).data();
          const freshStay = stay ? await tx.get(stay.ref) : null;
          const profile = await tx.get(
            db.doc(`accounts/${input.ownerUid}/portal/${tenantId}`),
          );
          if (
            grant?.role !== "tenant" ||
            grant.ownerUid !== input.ownerUid ||
            grant.tenantId !== tenantId
          )
            throw new Rejected(403, "Your access changed. Sign in again.");
          const active =
            !!freshStay?.exists &&
            freshStay.data()?.end === null &&
            profile.data()?.active !== false;
          tx.set(
            db.doc(`accounts/${input.ownerUid}/portal/${tenantId}`),
            { active },
            { merge: true },
          );
          return active;
        });
        return reply(200, { active });
      }
      if (!stay)
        throw new Rejected(403, "Your stay has ended. Contact the PG office.");
      const bed = await db
        .doc(
          `accounts/${input.ownerUid}/records/beds/items/${stay.data().bedId}`,
        )
        .get();
      if (!bed.exists)
        throw new Rejected(
          409,
          "Your bed details are unavailable. Contact the PG office.",
        );
      const ticket = db
        .collection(`accounts/${input.ownerUid}/records/tickets/items`)
        .doc();
      const rate = db.doc(
        `accounts/${input.ownerUid}/tenantTicketRate/${tenantId}`,
      );
      await db.runTransaction(async (tx) => {
        const [freshGrant, freshStay, currentRate, version, profile] =
          await Promise.all([
            tx.get(db.doc(`emailAccess/${email}`)),
            tx.get(stay.ref),
            tx.get(rate),
            tx.get(db.doc(`accounts/${input.ownerUid}/control/version`)),
            tx.get(db.doc(`accounts/${input.ownerUid}/portal/${tenantId}`)),
          ]);
        if (
          freshGrant.data()?.role !== "tenant" ||
          freshGrant.data()?.ownerUid !== input.ownerUid ||
          freshGrant.data()?.tenantId !== tenantId ||
          profile.data()?.active !== true ||
          !freshStay.exists ||
          freshStay.data()?.end !== null
        )
          throw new Rejected(403, "Your resident access is no longer active.");
        const hour = Math.floor(Date.now() / 3_600_000);
        const count =
          currentRate.data()?.hour === hour
            ? Number(currentRate.data()?.count || 0)
            : 0;
        if (count >= 5)
          throw new Rejected(
            429,
            "You can submit up to 5 repair requests per hour. Please try later.",
          );
        tx.set(rate, { hour, count: count + 1 });
        tx.set(ticket, {
          id: ticket.id,
          createdAt: new Date().toISOString(),
          tenantId,
          occupancyId: stay.id,
          roomId: bed.data()!.roomId,
          bedId: stay.data().bedId,
          category: input.category,
          description: input.description,
          priority: "Medium",
          status: "Open",
          block: false,
          resolution: "",
        });
        tx.set(db.doc(`accounts/${input.ownerUid}/control/version`), {
          number: Number(version.data()?.number || 0) + 1,
        });
      });
      return reply(200, { status: "created" });
    }
    if (input.action === "remove" && role !== "super_admin")
      throw new Rejected(403, "Only a super admin can remove users.");
    if (
      input.action === "checkout" &&
      !["super_admin", "admin", "staff"].includes(String(role))
    )
      throw new Rejected(403, "You cannot check out residents.");
    const grants =
      input.action === "checkout"
        ? await db
            .collection("emailAccess")
            .where("ownerUid", "==", input.ownerUid)
            .where("tenantId", "==", input.tenantId)
            .get()
        : null;
    const targets = grants
      ? grants.docs.map((item) => item.ref)
      : [
          db.doc(
            `emailAccess/${input.action === "remove" ? input.email.toLowerCase() : ""}`,
          ),
        ];
    const checkMissingAssignment = async (address: string) => {
      try {
        await auth.getUserByEmail(address);
      } catch (error) {
        if ((error as { code?: string }).code === "auth/user-not-found") return;
        throw error;
      }
      throw new Rejected(
        409,
        "The PG access entry is already missing, but the Firebase sign-in account still exists. It was not deleted. Ask the owner to review this exact email in Firebase Authentication before removing that remaining account.",
      );
    };
    if (input.action === "checkout" && !targets.length) {
      const tenant = (
        await db
          .doc(
            `accounts/${input.ownerUid}/records/tenants/items/${input.tenantId}`,
          )
          .get()
      ).data();
      if (!tenant)
        throw new Rejected(
          404,
          "Resident not found. Login removal could not be confirmed.",
        );
      if (typeof tenant.email === "string" && tenant.email.trim())
        await checkMissingAssignment(tenant.email.trim().toLowerCase());
    }
    for (const target of targets) {
      const grant = (await target.get()).data();
      if (!grant) {
        await checkMissingAssignment(target.id);
        continue;
      }
      if (grant.ownerUid !== input.ownerUid || target.id === email)
        throw new Rejected(403, "You cannot remove this account.");
      if (input.action === "checkout" && grant.role !== "tenant") continue;
      let user;
      try {
        user = await auth.getUserByEmail(target.id);
      } catch (error) {
        if ((error as { code?: string }).code !== "auth/user-not-found")
          throw error;
      }
      if (
        user &&
        (user.uid === input.ownerUid ||
          (
            await db
              .doc(`accounts/${user.uid}/records/settings/items/property`)
              .get()
          ).exists)
      )
        throw new Rejected(409, "A PG owner account cannot be deleted here.");
      await db.runTransaction(async (tx) => {
        if (actor.uid !== input.ownerUid) {
          const currentActor = (
            await tx.get(db.doc(`emailAccess/${email}`))
          ).data();
          const permitted =
            input.action === "remove"
              ? ["super_admin"]
              : ["super_admin", "admin", "staff"];
          if (
            currentActor?.ownerUid !== input.ownerUid ||
            !permitted.includes(String(currentActor.role))
          )
            throw new Rejected(403, "Your permission changed. Sign in again.");
        }
        const fresh = (await tx.get(target)).data();
        if (
          !fresh ||
          fresh.ownerUid !== input.ownerUid ||
          fresh.role !== grant.role ||
          fresh.tenantId !== grant.tenantId
        )
          throw new Rejected(409, "Access changed. Refresh and try again.");
        if (input.action === "checkout") {
          const stays = await tx.get(
            db
              .collection(
                `accounts/${input.ownerUid}/records/occupancies/items`,
              )
              .where("tenantId", "==", input.tenantId)
              .where("end", "==", null),
          );
          if (!stays.empty)
            throw new Rejected(
              409,
              "Check out the resident before removing their login.",
            );
        }
        // Keep the assignment until Auth deletion succeeds, so a failed cleanup can be retried.
        if (grant.role === "tenant")
          tx.set(
            db.doc(`accounts/${input.ownerUid}/portal/${grant.tenantId}`),
            { active: false },
            { merge: true },
          );
      });
      if (user) {
        try {
          await auth.revokeRefreshTokens(user.uid);
          await auth.deleteUser(user.uid);
        } catch (error) {
          const code = (error as { code?: string }).code;
          if (code === "auth/insufficient-permission") {
            console.warn(
              "Firebase account deletion denied: auth/insufficient-permission",
            );
            throw new Rejected(
              503,
              "Firebase did not allow sign-in account deletion. Ask the owner to check the Netlify service account's Firebase Authentication permissions, then retry Remove. The PG access entry is kept for retry.",
            );
          }
          if (code !== "auth/user-not-found") throw error;
        }
      }
      await db.runTransaction(async (tx) => {
        const fresh = (await tx.get(target)).data();
        if (!fresh) return;
        if (
          fresh.ownerUid !== grant.ownerUid ||
          fresh.role !== grant.role ||
          fresh.tenantId !== grant.tenantId
        )
          throw new Rejected(
            409,
            "The sign-in account was removed, but PG access changed during cleanup. Ask the super admin to review it.",
          );
        tx.delete(target);
        if (grant.role === "tenant")
          tx.delete(
            db.doc(
              `accounts/${input.ownerUid}/tenantOnboarding/${grant.tenantId}`,
            ),
          );
      });
    }
    return reply(200, { status: "removed" });
  } catch (error) {
    if (error instanceof Rejected)
      return reply(error.status, { error: error.message });
    if (error instanceof SyntaxError)
      return reply(400, { error: "Invalid request." });
    console.error("Account action failed.");
    return reply(500, {
      error:
        "Could not finish. Refresh and try again; contact the owner if it continues.",
    });
  }
}
