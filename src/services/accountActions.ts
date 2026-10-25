import { cloudAuth } from "../data/firebase";

export async function accountAction(input: object) {
  const user = cloudAuth?.currentUser;
  if (!user) throw new Error("Sign in again.");
  const response = await fetch("/api/account-action", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${await user.getIdToken()}`,
    },
    body: JSON.stringify(input),
  });
  if (!response.headers.get("content-type")?.includes("application/json"))
    throw new Error(
      "Deploy the account-action Netlify function, or use Netlify Dev locally.",
    );
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error || "Could not complete the request.");
  return result;
}
