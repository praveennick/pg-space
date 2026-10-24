import { expect, test } from "@playwright/test";

test("short desktop sidebar remains usable and repairs opens on Open", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 700 });
  await page.goto("/app/tenants");

  const sidebar = page.locator(".sidebar");
  const bottom = sidebar.locator(".sidebar-bottom");
  await expect(bottom).toBeVisible();
  const bottomBox = await bottom.boundingBox();
  expect(bottomBox && bottomBox.y + bottomBox.height <= 700).toBeTruthy();
  const settings = sidebar.getByRole("link", { name: "Settings" });
  await settings.scrollIntoViewIfNeeded();
  await expect(settings).toBeInViewport();

  await page.goto("/app/maintenance");
  const tabs = page.locator(".operation-tabs");
  await expect(tabs.getByRole("button", { name: "Open", exact: true })).toHaveAttribute("aria-pressed", "true");
  await tabs.getByRole("button", { name: "All", exact: true }).click();
  await expect(tabs.getByRole("button", { name: "All", exact: true })).toHaveAttribute("aria-pressed", "true");
});
