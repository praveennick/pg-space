// Uses Firebase's Rules :test endpoint with fictional request data.
// It never publishes rules or reads/writes application records.
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { getGlobalDefaultAccount } = require("firebase-tools/lib/auth");
const { requireAuth } = require("firebase-tools/lib/requireAuth");
const { Client } = require("firebase-tools/lib/apiv2");
const project = process.argv[2] || "lucky-luxury-mens-pg";
const account = getGlobalDefaultAccount();
await requireAuth({ project, ...account });

const base = "/databases/(default)/documents";
const record = (entity, id = "sample") =>
  `${base}/accounts/owner/records/${entity}/items/${id}`;
const grant = (role, extra = {}) => ({
  email: "person@example.test",
  ownerUid: "owner",
  role,
  tenantId: role === "tenant" ? "resident-one" : "",
  label: "Test Person",
  workspaceName: "Test PG",
  ...extra,
});
const tests = [];
function check(
  name,
  expectation,
  path,
  {
    role,
    method = "get",
    uid = "member",
    verified = true,
    before = {},
    after,
    exists = true,
    email = "person@example.test",
  } = {},
) {
  tests.push({
    name,
    test: {
      expectation,
      request: {
        path: path.startsWith(base) ? path : `${base}/${path}`,
        method,
        auth: uid ? { uid, token: { email, email_verified: verified } } : null,
        ...(after ? { resource: { data: after } } : {}),
      },
      resource: { data: before },
      functionMocks: [
        {
          function: "exists",
          args: [{ anyValue: {} }],
          result: { value: exists },
        },
        {
          function: "get",
          args: [{ anyValue: {} }],
          result: { value: { data: grant(role || "staff") } },
        },
      ],
    },
  });
}
check(
  "owner can grant super admin access",
  "ALLOW",
  "emailAccess/new@example.test",
  {
    uid: "owner",
    method: "create",
    after: grant("super_admin", { email: "new@example.test" }),
  },
);
check(
  "another super admin can grant access",
  "ALLOW",
  "emailAccess/new@example.test",
  {
    role: "super_admin",
    method: "create",
    after: grant("staff", { email: "new@example.test" }),
  },
);
check(
  "staff cannot promote themselves",
  "DENY",
  "emailAccess/person@example.test",
  {
    role: "staff",
    method: "update",
    before: grant("staff"),
    after: grant("super_admin"),
  },
);
check("admin cannot grant access", "DENY", "emailAccess/new@example.test", {
  role: "admin",
  method: "create",
  after: grant("staff", { email: "new@example.test" }),
});
check(
  "invitation ownership cannot be changed",
  "DENY",
  "emailAccess/person@example.test",
  {
    uid: "owner",
    method: "update",
    before: grant("staff"),
    after: grant("staff", { ownerUid: "another-pg" }),
  },
);
check(
  "verified user can discover their own access",
  "ALLOW",
  "emailAccess/person@example.test",
  { role: "staff", before: grant("staff") },
);
check(
  "unverified user cannot discover access",
  "DENY",
  "emailAccess/person@example.test",
  { verified: false, before: grant("staff") },
);
check(
  "staff cannot read another invitation",
  "DENY",
  "emailAccess/other@example.test",
  { role: "staff", before: grant("admin", { email: "other@example.test" }) },
);
check("staff can see rooms", "ALLOW", record("rooms"), { role: "staff" });
check("staff cannot see payments", "DENY", record("payments"), {
  role: "staff",
});
check("unverified staff cannot see rooms", "DENY", record("rooms"), {
  role: "staff",
  verified: false,
});
check("tenant can read their own invoice", "ALLOW", record("invoices"), {
  role: "tenant",
  before: { tenantId: "resident-one" },
});
check("tenant cannot read another invoice", "DENY", record("invoices"), {
  role: "tenant",
  before: { tenantId: "resident-two" },
});
check("tenant cannot record a payment", "DENY", record("payments"), {
  role: "tenant",
  method: "create",
  after: { id: "sample", tenantId: "resident-one" },
});
check(
  "tenant can see their safe profile",
  "ALLOW",
  "accounts/owner/portal/resident-one",
  { role: "tenant" },
);
check(
  "tenant cannot see another profile",
  "DENY",
  "accounts/owner/portal/resident-two",
  { role: "tenant" },
);
check(
  "tenant cannot see staff notes",
  "DENY",
  record("tenants", "resident-one"),
  { role: "tenant" },
);
check("revoked membership cannot read rooms", "DENY", record("rooms"), {
  role: "staff",
  exists: false,
});
check("signed-out users cannot read records", "DENY", record("rooms"), {
  uid: null,
});
check("admin cannot delete records", "DENY", record("rooms"), {
  role: "admin",
  method: "delete",
});
check("additional super admin can delete records", "ALLOW", record("rooms"), {
  role: "super_admin",
  method: "delete",
});
check(
  "owner can list their email assignments",
  "ALLOW",
  "emailAccess/sample@example.test",
  { uid: "owner", method: "list", before: grant("staff") },
);
check(
  "additional super admin can list assignments",
  "ALLOW",
  "emailAccess/sample@example.test",
  { role: "super_admin", method: "list", before: grant("staff") },
);
check(
  "staff cannot list email assignments",
  "DENY",
  "emailAccess/sample@example.test",
  { role: "staff", method: "list", before: grant("staff") },
);
check(
  "staff cannot cross into another PG",
  "DENY",
  "accounts/other-pg/records/rooms/items/sample",
  { role: "staff" },
);

check(
  "staff cannot read invitation metadata",
  "DENY",
  "accounts/owner/tenantOnboarding/resident-one",
  { role: "staff" },
);
check(
  "admin cannot forge invitation results",
  "DENY",
  "accounts/owner/tenantOnboarding/resident-one",
  { role: "admin", method: "create", after: { status: "submitted" } },
);
check(
  "super admin can clear invitation metadata",
  "ALLOW",
  "accounts/owner/tenantOnboarding/resident-one",
  { role: "super_admin", method: "delete" },
);
check(
  "super admin can clear invite rate metadata",
  "ALLOW",
  "accounts/owner/control/tenantInviteRate",
  { role: "super_admin", method: "delete" },
);

const client = new Client({
  urlPrefix: "https://firebaserules.googleapis.com",
  apiVersion: "v1",
});
const response = await client.post(
  `/projects/${encodeURIComponent(project)}:test`,
  {
    source: {
      files: [
        {
          name: "firestore.rules",
          content: await readFile(
            new URL("../firestore.rules", import.meta.url),
            "utf8",
          ),
        },
      ],
    },
    testSuite: { testCases: tests.map((item) => item.test) },
  },
  { skipLog: { body: true, resBody: true } },
);
const results = response.body.testResults || [];
let failed = false;
for (const issue of response.body.issues || []) {
  if (issue.severity === "ERROR") {
    failed = true;
    console.error(issue.description);
  }
}
tests.forEach((item, index) => {
  const result = results[index];
  const passed = result?.state === "SUCCESS";
  console.log(`${passed ? "PASS" : "FAIL"} ${item.name}`);
  if (!passed) {
    failed = true;
    console.error(JSON.stringify(result || {}));
  }
});
if (failed) process.exitCode = 1;
else
  console.log(
    `${tests.length} Firebase access rules tests passed. No records were changed.`,
  );
