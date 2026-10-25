// Read-only checks: GET does not provision users or send emails.
const origin = process.argv[2] || "https://lucky-luxury-pg.netlify.app";
for (const path of [
  "/api/tenant-login",
  "/.netlify/functions/tenant-login",
  "/api/account-action",
  "/.netlify/functions/account-action",
]) {
  const url = new URL(path, origin).href;
  try {
    const response = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(15000),
    });
    const contentType = response.headers.get("content-type") || "";
    const body = await response.text();
    let result = body.slice(0, 500) || "Empty response";
    if (contentType.includes("application/json")) {
      const data = JSON.parse(body);
      result = typeof data.error === "string" ? data.error : "JSON response";
    } else if (/<!doctype html|<html/i.test(body))
      result = "HTML page returned instead of the server function";
    console.log(
      JSON.stringify({
        url,
        status: response.status,
        contentType,
        server: response.headers.get("server"),
        netlifyRequestId: response.headers.get("x-nf-request-id"),
        result,
      }),
    );
  } catch (error) {
    console.log(JSON.stringify({ url, error: error.message }));
    process.exitCode = 1;
  }
}
