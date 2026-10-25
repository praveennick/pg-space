export async function requestAccountEmail(
  email: string,
  mode: "setup" | "reset",
) {
  const response = await fetch("/api/account-email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, mode }),
  });
  if (!response.headers.get("content-type")?.includes("application/json"))
    throw new Error(
      "Password setup needs the updated Netlify app or Netlify Dev. Contact the PG owner.",
    );
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error || "Could not request a password link.");
  if (typeof result.message !== "string")
    throw new Error(
      "Could not confirm the request. Check your inbox before trying again.",
    );
  return result.message as string;
}
