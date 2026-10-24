// Run with --no-experimental-require-module to match Lambda's default.
// Imports only: never reads credentials, contacts Firebase or sends email.
await import("firebase-admin/app");
await import("firebase-admin/auth");
await import("firebase-admin/firestore");
console.log(
  "PASS: Firebase Admin function dependencies load with CommonJS-to-ESM require disabled.",
);
