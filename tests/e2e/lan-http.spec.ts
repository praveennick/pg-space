import { test, expect } from "@playwright/test";

test("starts and persists records without randomUUID", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window.crypto, "randomUUID", {
      value: undefined,
      configurable: true,
    });
  });

  await page.goto("/app/rooms");
  await expect(page.getByRole("heading", { name: "Rooms & beds" })).toBeVisible();

  await page.getByRole("button", { name: "Add room", exact: true }).click();
  await page.getByLabel("Room number *").fill("LAN-TEST");
  await page.getByRole("button", { name: "Create room & beds" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.reload();
  await page.getByLabel("Search rooms").fill("LAN-TEST");
  await expect(page.getByText("Room LAN-TEST")).toBeVisible();
});
