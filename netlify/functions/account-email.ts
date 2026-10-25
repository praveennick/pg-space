import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { handleAccountEmail } from "./_shared/account-email";

export default async (request: Request, context: { ip?: string } = {}) => {
  try {
    const account = JSON.parse(
      process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "null",
    );
    const appUrl = process.env.APP_URL || process.env.URL;
    const apiKey = process.env.FIREBASE_WEB_API_KEY;
    if (account?.project_id !== "lucky-luxury-mens-pg" || !appUrl || !apiKey)
      throw new Error("Missing configuration");
    const app =
      getApps().find((item) => item.name === "account-email") ||
      initializeApp({ credential: cert(account) }, "account-email");
    return await handleAccountEmail(request, {
      auth: getAuth(app),
      db: getFirestore(app),
      appUrl,
      apiKey,
      ip: context.ip || "unknown",
    });
  } catch {
    return Response.json(
      {
        error:
          "Password setup needs the Netlify Firebase server configuration. Contact the PG owner.",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
};
