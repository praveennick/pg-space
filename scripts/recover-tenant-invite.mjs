// Restore only the allowance used by a confirmed failed invitation.
// Never sends emails, deletes accounts or resets the PG-wide request limit.
import { createRequire } from "node:module";
const option = (name) => process.argv[process.argv.indexOf(name) + 1];
const email = option("--email")?.trim().toLowerCase();
const tenantId = option("--tenant");
if (
  !process.argv.includes("--email") ||
  !process.argv.includes("--tenant") ||
  !email ||
  !tenantId ||
  email.includes("/") ||
  tenantId.includes("/")
)
  throw new Error(
    "Use --email EMAIL --tenant RESIDENT_ID [--credit-last-failure].",
  );
const require = createRequire(import.meta.url);
const { getGlobalDefaultAccount } = require("firebase-tools/lib/auth");
const { requireAuth } = require("firebase-tools/lib/requireAuth");
const { Client } = require("firebase-tools/lib/apiv2");
const project = "lucky-luxury-mens-pg";
await requireAuth({ project, ...getGlobalDefaultAccount() });
const client = new Client({
  urlPrefix: "https://firestore.googleapis.com",
  apiVersion: "v1",
});
const base = `/projects/${project}/databases/(default)/documents`;
const silent = { skipLog: { body: true, resBody: true } };
const grant = (
  await client.get(`${base}/emailAccess/${encodeURIComponent(email)}`, silent)
).body.fields;
if (
  grant?.role?.stringValue !== "tenant" ||
  grant?.tenantId?.stringValue !== tenantId
)
  throw new Error(
    "The email is not linked to that resident with Tenant access. No changes made.",
  );
const ownerUid = grant.ownerUid.stringValue;
const path = `${base}/accounts/${encodeURIComponent(ownerUid)}/tenantOnboarding/${encodeURIComponent(tenantId)}`;
const document = (await client.get(path, silent)).body;
const fields = document.fields || {};
const status = fields.status?.stringValue;
const attempts = Number(fields.attempts?.integerValue || 0);
const attempt = fields.attemptId?.stringValue || fields.startedAt?.integerValue;
const credited = fields.creditedFailedAttempt?.stringValue === attempt;
console.log(
  JSON.stringify(
    {
      status,
      attempts,
      errorCode:
        fields.errorCode?.stringValue || "not recorded by older deployment",
      lastFailureAlreadyCredited: credited,
    },
    null,
    2,
  ),
);
if (process.argv.includes("--credit-last-failure")) {
  if (
    status !== "failed" ||
    attempts < 1 ||
    !attempt ||
    credited ||
    fields.errorCode?.stringValue === "EMAIL_RATE_LIMITED"
  )
    throw new Error(
      "No eligible uncredited configuration-failure attempt. No changes made.",
    );
  const queryParams = new URLSearchParams();
  queryParams.append("updateMask.fieldPaths", "attempts");
  queryParams.append("updateMask.fieldPaths", "creditedFailedAttempt");
  queryParams.set("currentDocument.updateTime", document.updateTime);
  await client.patch(
    path,
    {
      fields: {
        attempts: { integerValue: String(attempts - 1) },
        creditedFailedAttempt: { stringValue: attempt },
      },
    },
    {
      queryParams,
      ...silent,
    },
  );
  const verified = (await client.get(path, silent)).body.fields;
  if (
    Number(verified.attempts.integerValue) !== attempts - 1 ||
    verified.creditedFailedAttempt.stringValue !== attempt
  )
    throw new Error(
      "Could not confirm the saved failure credit. Do not retry this script automatically.",
    );
  console.log(
    "Restored one confirmed-failure allowance. Other attempts and the PG-wide request limit are unchanged. No email was sent.",
  );
}
