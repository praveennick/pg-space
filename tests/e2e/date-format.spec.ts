import { expect, test } from "@playwright/test";

test("dates are shown and entered day first", async ({ page }) => {
  await page.goto("/app/quotations");
  const quoteDate = page.getByRole("textbox", { name: "Date", exact: true });
  await expect(quoteDate).toHaveValue(/^\d{2}-\d{2}-\d{4}$/);
  await quoteDate.fill("21102026");
  await expect(quoteDate).toHaveValue("21-10-2026");

  await page.goto("/app/payments");
  const month = page.getByRole("textbox", { name: "Billing month" });
  await month.fill("102026");
  await expect(month).toHaveValue("10-2026");
  await expect(
    page.locator("tbody tr").first().locator('[data-label="Due date"]'),
  ).toContainText(/^\d{2}-\d{2}-\d{4}$/);
});
