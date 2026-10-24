// Smoke-tests password setup entirely in the local Firebase Auth emulator.
import assert from "node:assert/strict";
import { initializeApp, deleteApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

if (process.argv.includes("--start")) {
  const cli = fileURLToPath(
    new URL(
      "../node_modules/firebase-tools/lib/bin/firebase.js",
      import.meta.url,
    ),
  );
  const result = spawnSync(
    process.execPath,
    [
      cli,
      "emulators:exec",
      "--project",
      "demo-pg-onboarding",
      "--config",
      "firebase.auth-test.json",
      "--only",
      "auth",
      "node scripts/test-tenant-auth.mjs",
    ],
    {
      stdio: "inherit",
      env: { ...process.env, DEBUG: "" },
    },
  );
  process.exit(result.status ?? 1);
}

const host = process.env.FIREBASE_AUTH_EMULATOR_HOST;
if (!host || !/^127\.0\.0\.1:\d+$/.test(host))
  throw new Error(
    "This test requires a local Auth emulator. It never runs against production.",
  );
const projectId = "demo-pg-onboarding";
const app = initializeApp({ projectId }, "tenant-onboarding-test");
const email = `resident-${Date.now()}@example.test`;
const password = "FictionalTestPassword123!";
const base = `http://${host}`;
async function call(action, body) {
  const response = await fetch(
    `${base}/identitytoolkit.googleapis.com/v1/${action}?key=demo-key`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  const result = await response.json();
  assert.ok(
    response.ok,
    `${action} failed: ${result.error?.message || response.status}`,
  );
  return result;
}
try {
  const user = await getAuth(app).createUser({
    email,
    displayName: "Fictional Resident",
    emailVerified: false,
  });
  assert.equal(user.email, email);
  await call("accounts:sendOobCode", { requestType: "PASSWORD_RESET", email });
  const response = await fetch(
    `${base}/emulator/v1/projects/${projectId}/oobCodes`,
  );
  const codes = await response.json();
  const setup = codes.oobCodes.find(
    (item) => item.email === email && item.requestType === "PASSWORD_RESET",
  );
  assert.ok(
    setup,
    "Expected a password-setup email action for the exact saved email.",
  );
  await call("accounts:resetPassword", {
    oobCode: setup.oobCode,
    newPassword: password,
  });
  const signin = await call("accounts:signInWithPassword", {
    email,
    password,
    returnSecureToken: true,
  });
  assert.equal(signin.localId, user.uid);
  assert.equal(signin.email, email);
  console.log(
    "PASS: exact-email account creation, Firebase password-setup action, password selection and sign-in. No real email was sent.",
  );
} finally {
  await deleteApp(app);
}
