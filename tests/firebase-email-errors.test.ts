import { expect, it } from "vitest";
import { firebaseEmailFailure } from "../netlify/functions/_shared/firebase-email-errors";

it("explains a missing authorized return domain", () => {
  const result = firebaseEmailFailure(400, {
    error: { message: "UNAUTHORIZED_DOMAIN" },
  });
  expect(result.code).toBe("UNAUTHORIZED_DOMAIN");
  expect(result.message).toContain("Authorized domains");
});
it("distinguishes an invalid key from an unauthorized domain", () => {
  expect(
    firebaseEmailFailure(400, {
      error: { message: "API key not valid. Please pass a valid API key." },
    }).code,
  ).toBe("API_KEY_INVALID");
});
it("recognizes server-key restrictions without exposing the provider body", () => {
  const result = firebaseEmailFailure(403, {
    error: {
      message: "private provider details",
      details: [{ reason: "API_KEY_HTTP_REFERRER_BLOCKED" }],
    },
  });
  expect(result.code).toBe("API_KEY_RESTRICTED");
  expect(result.message).not.toContain("private provider details");
});
it("reports email quotas separately", () => {
  expect(
    firebaseEmailFailure(400, {
      error: { message: "RESET_PASSWORD_EXCEED_LIMIT" },
    }).status,
  ).toBe(429);
});
it("does not expose raw errors or private data for unknown failures", () => {
  const result = firebaseEmailFailure(500, {
    error: { message: "unknown provider text with secret", details: null },
  });
  expect(result.code).toBe("FIREBASE_EMAIL_REJECTED");
  expect(result.message).not.toContain("secret");
});
