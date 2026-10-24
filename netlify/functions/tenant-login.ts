import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { handleTenantOnboarding } from "./_shared/tenant-onboarding";

export default async (request: Request): Promise<Response> => {
  const credential = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const apiKey = process.env.FIREBASE_WEB_API_KEY;
  const appUrl = process.env.APP_URL || process.env.URL;
  if (!credential || !apiKey || !appUrl)
    return Response.json(
      {
        error:
          "Resident login emails are not configured yet. Ask the owner to finish the Netlify setup in TENANT_LOGIN_SETUP.md.",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  try {
    const account = JSON.parse(credential);
    if (account.project_id !== "lucky-luxury-mens-pg")
      throw new Error("Wrong project.");
    const app =
      getApps().find((item) => item.name === "tenant-onboarding") ||
      initializeApp(
        { credential: cert(account), projectId: account.project_id },
        "tenant-onboarding",
      );
    return await handleTenantOnboarding(request, {
      auth: getAuth(app),
      db: getFirestore(app),
      apiKey,
      appUrl,
    });
  } catch {
    console.error("Tenant onboarding configuration failed.");
    return Response.json(
      {
        error:
          "Resident login setup is unavailable. Ask the owner to check the Netlify server configuration.",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
};
