// Reads active rules only. Never publishes rules or accesses PG records.
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { getGlobalDefaultAccount } = require("firebase-tools/lib/auth");
const { requireAuth } = require("firebase-tools/lib/requireAuth");
const {
  listReleases,
  getRulesetContent,
} = require("firebase-tools/lib/gcp/rules");
const project = "lucky-luxury-mens-pg";
await requireAuth({ project, ...getGlobalDefaultAccount() });
const releases = await listReleases(project);
const active = releases.releases?.find((release) =>
  release.name.endsWith("/cloud.firestore"),
);
if (!active) throw new Error("No active Firestore rules release was found.");
const files = await getRulesetContent(active.rulesetName);
const source = files.map((file) => file.content).join("\n");
const local = await readFile(
  new URL("../firestore.rules", import.meta.url),
  "utf8",
);
const normalize = (value) => value.replace(/\r\n/g, "\n").trim();
const metadataStart = local.indexOf(
  "    // Only the server creates or updates invitation status",
);
const metadataEnd = local.indexOf(
  "    match /accounts/{accountUid}/portal/",
  metadataStart,
);
const withoutMetadata =
  metadataStart >= 0 && metadataEnd >= 0
    ? local.slice(0, metadataStart) + local.slice(metadataEnd)
    : local;
const compact = (value) => normalize(value).replace(/\s+/g, " ");
console.log(
  JSON.stringify(
    {
      project,
      matchesLocalRules: normalize(source) === normalize(local),
      matchesLocalExceptInvitationMetadata:
        compact(source) === compact(withoutMetadata),
      hasEmailAccess: source.includes("match /emailAccess/"),
      hasPortalRules: source.includes("/portal/"),
      hasOnboardingResetRules: source.includes("/tenantOnboarding/"),
      hasInviteRateResetRules: source.includes("/control/tenantInviteRate"),
    },
    null,
    2,
  ),
);
