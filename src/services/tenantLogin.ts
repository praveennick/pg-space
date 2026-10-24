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
  if (!response.headers.get("content-type")?.includes("application/json"))
    throw new Error(
      "Login emails need the deployed Netlify app or Netlify Dev. The resident is still saved.",
    );
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
