// Prints non-secret email settings only. No emails or accounts are created.
import { createRequire } from "node:module";
import { assertExpectedAuthConfig } from "./lib/auth-config.mjs";
async function main() {
  const require = createRequire(import.meta.url);
  const { getGlobalDefaultAccount } = require("firebase-tools/lib/auth");
  const { requireAuth } = require("firebase-tools/lib/requireAuth");
  const { Client } = require("firebase-tools/lib/apiv2");
  const project = "lucky-luxury-mens-pg";
  const hostname = "lucky-luxury-pg.netlify.app";
  await requireAuth({ project, ...getGlobalDefaultAccount() });
  const client = new Client({
    urlPrefix: "https://identitytoolkit.googleapis.com",
    apiVersion: "admin/v2",
  });
  const path = `/projects/${project}/config`;
  const read = async () =>
    (await client.get(path, { skipLog: { resBody: true } })).body;
  let config = await read();
  assertExpectedAuthConfig(config, project, "105491929980");
  if (process.argv.includes("--disable-public-signup")) {
    await client.patch(
      path,
      { client: { permissions: { disabledUserSignup: true } } },
      {
        queryParams: { updateMask: "client.permissions.disabledUserSignup" },
        skipLog: { body: true, resBody: true },
      },
    );
    config = await read();
    assertExpectedAuthConfig(config, project, "105491929980");
    if (config.client?.permissions?.disabledUserSignup !== true)
      throw new Error(
        "Firebase did not confirm that public signup is disabled.",
      );
    console.log(
      "Public client signup is disabled. Server-authorized invitations can still create accounts. No emails were sent.",
    );
  }
  if (
    process.argv.includes("--allow-netlify-domain") &&
    !config.authorizedDomains?.includes(hostname)
  ) {
    await client.patch(
      path,
      { authorizedDomains: [...(config.authorizedDomains || []), hostname] },
      {
        queryParams: { updateMask: "authorizedDomains" },
        skipLog: { body: true, resBody: true },
      },
    );
    config = await read();
    if (!config.authorizedDomains?.includes(hostname))
      throw new Error("Firebase did not confirm the authorized domain.");
    console.log(
      "Authorized the existing Netlify app domain. No email was sent.",
    );
  }
  console.log(
    JSON.stringify(
      {
        project,
        resourceName: config.name || "not returned by Firebase",
        emailPasswordEnabled: config.signIn?.email?.enabled,
        passwordRequired: config.signIn?.email?.passwordRequired,
        publicSignupDisabled:
          config.client?.permissions?.disabledUserSignup === true,
        authorizedDomains: config.authorizedDomains,
        netlifyDomainAuthorized: Boolean(
          config.authorizedDomains?.includes(hostname),
        ),
      },
      null,
      2,
    ),
  );
}
main().catch((error) => {
  console.error(
    error instanceof Error
      ? error.message
      : "Firebase configuration check failed.",
  );
  process.exitCode = 1;
});
