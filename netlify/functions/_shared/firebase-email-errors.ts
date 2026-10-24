// Map only known provider codes. Never expose raw responses, keys or links.
export function firebaseEmailFailure(httpStatus: number, body: unknown) {
  const error = (
    body as {
      error?: { message?: unknown; details?: Array<{ reason?: unknown }> };
    } | null
  )?.error;
  const raw = typeof error?.message === "string" ? error.message : "";
  const details = Array.isArray(error?.details) ? error.details : [];
  const reasons = [
    raw.split(/[\s:]/)[0],
    ...details.map((detail) => detail?.reason),
  ];
  const has = (...codes: string[]) =>
    reasons.some((reason) => codes.includes(String(reason)));
  if (has("UNAUTHORIZED_DOMAIN"))
    return {
      code: "UNAUTHORIZED_DOMAIN",
      status: 400,
      message:
        "Firebase has not authorized the app's return address. Add the Netlify hostname in Firebase Authentication → Settings → Authorized domains, then try again.",
    };
  if (has("INVALID_CONTINUE_URI", "MISSING_CONTINUE_URI"))
    return {
      code: "INVALID_CONTINUE_URI",
      status: 503,
      message:
        "The login email's return address is invalid. Ask the owner to check APP_URL in Netlify.",
    };
  if (
    has("API_KEY_INVALID", "INVALID_API_KEY") ||
    /api key not valid/i.test(raw)
  )
    return {
      code: "API_KEY_INVALID",
      status: 503,
      message:
        "The server's Firebase Web API key is invalid. Check FIREBASE_WEB_API_KEY in Netlify and redeploy.",
    };
  if (
    has(
      "API_KEY_HTTP_REFERRER_BLOCKED",
      "API_KEY_SERVICE_BLOCKED",
      "API_KEY_IP_ADDRESS_BLOCKED",
    )
  )
    return {
      code: "API_KEY_RESTRICTED",
      status: 503,
      message:
        "The Firebase API key is blocking server requests. Ask the owner to check its restrictions for Firebase Authentication.",
    };
  if (has("OPERATION_NOT_ALLOWED", "PASSWORD_LOGIN_DISABLED"))
    return {
      code: "PASSWORD_LOGIN_DISABLED",
      status: 503,
      message:
        "Enable Email/Password in Firebase Authentication before sending login setup emails.",
    };
  if (has("EMAIL_NOT_FOUND"))
    return {
      code: "EMAIL_NOT_FOUND",
      status: 409,
      message:
        "Firebase could not find the login account in the email service's project. Check that the server credential and Web API key belong to the same Firebase project.",
    };
  if (
    httpStatus === 429 ||
    has(
      "TOO_MANY_ATTEMPTS_TRY_LATER",
      "RESET_PASSWORD_EXCEED_LIMIT",
      "QUOTA_EXCEEDED",
      "TOO_MANY_REQUESTS",
    )
  )
    return {
      code: "EMAIL_RATE_LIMITED",
      status: 429,
      message:
        "Firebase has limited password-setup emails. Please wait before trying again; the resident account remains saved.",
    };
  return {
    code: "FIREBASE_EMAIL_REJECTED",
    status: 502,
    message:
      "Firebase could not accept the password-setup email request. Ask the owner to check the tenant-login function logs for the provider error code.",
  };
}
