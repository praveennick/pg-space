import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { handleAccountAction } from "./_shared/account-actions";

export default async (request: Request) => {
  try {
    const account = JSON.parse(
      process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "null",
    );
    const appUrl = process.env.APP_URL || process.env.URL;
    if (account?.project_id !== "lucky-luxury-mens-pg" || !appUrl)
      throw new Error("Configuration missing");
    const app =
      getApps().find((item) => item.name === "account-actions") ||
      initializeApp({ credential: cert(account) }, "account-actions");
    return await handleAccountAction(
      request,
      getAuth(app),
      getFirestore(app),
      appUrl,
    );
  } catch {
    return Response.json(
      {
        error:
          "Account services need the Netlify Firebase server configuration.",
      },
      { status: 503 },
    );
  }
};
