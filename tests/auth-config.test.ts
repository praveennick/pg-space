import { expect, it } from "vitest";
import { assertExpectedAuthConfig } from "../scripts/lib/auth-config.mjs";

it.each(["lucky-luxury-mens-pg", "105491929980"])(
  "recognizes Firebase resource name using %s",
  (identifier) => {
    expect(() =>
      assertExpectedAuthConfig(
        {
          name: `projects/${identifier}/config`,
          signIn: { email: { enabled: true } },
        },
        "lucky-luxury-mens-pg",
        "105491929980",
      ),
    ).not.toThrow();
  },
);
it("rejects another project and malformed responses before any write", () => {
  for (const value of [
    { name: "projects/other/config", signIn: {} },
    { name: "projects/105491929980/config" },
    null,
    [{ readTime: "now" }],
  ])
    expect(() =>
      assertExpectedAuthConfig(value, "lucky-luxury-mens-pg", "105491929980"),
    ).toThrow("No changes made");
});
