import { expect, test } from "@playwright/test";

for (const width of [360, 1440]) {
  test(`theme toggle and notification popover at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/app/dashboard");
    const theme = page.getByRole("button", { name: "Dark mode" });
    await theme.click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.reload();
    await expect(theme).toHaveAttribute("aria-pressed", "true");
    const bell = page.getByRole("button", { name: /^Notifications/ });
    await bell.click();
    const menu = page.getByRole("menu", { name: "Notifications", exact: true });
    await expect(menu).toBeVisible();
    const box = await menu.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(bell).toBeFocused();
    await bell.click();
    await menu.getByRole("menuitem", { name: "See all updates" }).click();
    await expect(page).toHaveURL(/\/app\/notifications$/);
  });
}
