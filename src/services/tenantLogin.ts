import { cloudAuth, firebaseMode } from "../data/firebase";

export type TenantLoginResult = {
  email: string;
  status: "submitted" | "already_submitted";
};

export async function inviteTenantLogin(
  ownerUid: string,
  tenantId: string,
  resend = false,
): Promise<TenantLoginResult> {
  const user = cloudAuth?.currentUser;
  if (!firebaseMode || !user)
    throw new Error(
      "Sign in to the Firebase app before sending a login email.",
    );
  const response = await fetch("/api/tenant-login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${await user.getIdToken()}`,
    },
    body: JSON.stringify({ ownerUid, tenantId, resend }),
  });
  if (!response.headers.get("content-type")?.includes("application/json")) {
    if (response.status >= 500)
      throw new Error(
        `The login-email service is unavailable (HTTP ${response.status}). Ask the owner to redeploy the updated Netlify function. Check the inbox before sending again if an earlier request timed out.`,
      );
    throw new Error(
      "The login-email endpoint returned a web page instead of a server response. Deploy the tenant-login Netlify function with the app, or use Netlify Dev locally.",
    );
  }
  const result = await response.json();
  if (!response.ok)
    throw new Error(
      typeof result.error === "string"
        ? result.error
        : "Could not prepare the resident's login email.",
    );
  if (
    typeof result.email !== "string" ||
    !["submitted", "already_submitted"].includes(result.status)
  )
    throw new Error(
      "Could not confirm the login email request. Check the inbox before sending again.",
    );
  return result;
}
