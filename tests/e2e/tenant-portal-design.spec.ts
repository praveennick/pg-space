import { expect, test } from "@playwright/test";

for (const width of [320, 390, 768, 1440]) {
  test(`resident portal works in both themes at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/tests/fixtures/tenant-portal.html");
    await expect(
      page.getByRole("heading", { name: "Hi, Ananya." }),
    ).toBeVisible();
    for (const theme of ["light", "dark"]) {
      if (theme === "dark")
        await page.getByRole("button", { name: "Dark mode" }).click();
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      for (const card of await page
        .locator(".resident-card, .resident-summary-card, .resident-welcome")
        .all()) {
        expect(
          await card.evaluate(
            (element) => element.scrollWidth <= element.clientWidth + 1,
          ),
        ).toBe(true);
      }
      await page.screenshot({
        path: `tests/artifacts/resident-${width}-${theme}.png`,
        fullPage: true,
      });
    }
    await page.getByRole("link", { name: "Get help" }).click();
    await page
      .getByLabel("Describe the problem")
      .fill("The shower tap is leaking.");
    await page.getByRole("button", { name: "Send repair request" }).click();
    await expect(page.getByRole("status")).toHaveText(
      "Your repair request was sent.",
    );
    await expect(page.getByText("The shower tap is leaking.")).toBeVisible();
    expect(
      await page
        .getByRole("button", { name: /resolve|edit request|close request/i })
        .count(),
    ).toBe(0);
  });
}
test("empty and checked-out portal states remain clear", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/tests/fixtures/tenant-portal.html?empty");
  await expect(
    page.getByRole("heading", { name: "No repair requests yet" }),
  ).toBeVisible();
  await expect(page.getByText("No payments recorded yet.")).toBeVisible();
  await page.goto("/tests/fixtures/tenant-portal.html?ended");
  await expect(
    page.getByRole("heading", { name: "Your PG access has ended" }),
  ).toBeVisible();
  await expect(page.getByText("ananya@example.test")).toHaveCount(0);
});
