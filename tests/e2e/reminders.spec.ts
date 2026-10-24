import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

test("reminder cards and message preview fit a phone", async ({ page }) => {
  await page.goto("/app/reminders");
  await expect(page.getByRole("heading", { name: "Rent reminders" })).toBeVisible();
  await expect(page.locator(".reminder-card").first()).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator(".reminder-card .reminder-inline").first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect.poll(() => page.evaluate(() => {
    const dialog = document.querySelector<HTMLElement>("[role=dialog]");
    return Boolean(dialog && dialog.getBoundingClientRect().right <= innerWidth + 1 && dialog.scrollWidth <= innerWidth + 1);
  })).toBe(true);
  await expect(page.getByLabel("WhatsApp reminder message")).not.toHaveValue("");
  await page.setViewportSize({ width: 320, height: 568 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect.poll(() => page.evaluate(() => {
    const dialog = document.querySelector<HTMLElement>("[role=dialog]");
    return Boolean(dialog && dialog.getBoundingClientRect().right <= innerWidth + 1);
  })).toBe(true);
  const send = await page.getByRole("button", { name: "Open WhatsApp" }).boundingBox();
  expect(send && send.y + send.height <= 568).toBeTruthy();
});

test("receipt sharing hands a PDF file to the phone without plain text", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "canShare", { configurable: true, value: (data: ShareData) => Boolean(data.files?.length) });
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: (data: ShareData) => {
        Reflect.set(window, "sharedReceipt", {
          keys: Object.keys(data),
          name: data.files?.[0]?.name,
          type: data.files?.[0]?.type,
        });
        return Promise.resolve();
      },
    });
  });
  await page.goto("/app/payments");
  await page.getByRole("button", { name: "Payments received", exact: true }).click();
  await page.getByRole("button", { name: "Share receipt PDF" }).first().click();
  await page.setViewportSize({ width: 320, height: 568 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("button", { name: "Share PDF attachment" }).click();
  const payload = await page.evaluate(() => Reflect.get(window, "sharedReceipt"));
  expect(payload.keys).toEqual(["files", "title"]);
  expect(payload.type).toBe("application/pdf");
  expect(payload.name).toMatch(/\.pdf$/);
});

test("phones without file sharing get a PDF download", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "canShare", { configurable: true, value: () => false });
  });
  await page.goto("/app/payments");
  await page.getByRole("button", { name: "Payments received", exact: true }).click();
  await page.getByRole("button", { name: "Share receipt PDF" }).first().click();
  await expect(page.getByRole("button", { name: "Share PDF attachment" })).toHaveCount(0);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PDF" }).click();
  expect((await download).suggestedFilename()).toMatch(/\.pdf$/);
  await expect(page.getByRole("link", { name: /WhatsApp chat to attach the PDF/ })).toBeVisible();
});
