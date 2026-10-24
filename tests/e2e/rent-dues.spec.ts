import { expect, test } from "@playwright/test";

test("recording rent clears the resident from the due list", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 760 });
  await page.goto("/app/payments");
  await expect(page.getByLabel("Payment status")).toHaveValue("Outstanding");
  const first = page.locator("tbody tr").first();
  const name = (await first
    .locator(".record-identity strong")
    .textContent())!.trim();
  const bed = (await first
    .locator(".record-identity small")
    .textContent())!.trim();
  const dueRow = page
    .locator("tbody tr")
    .filter({ hasText: name })
    .filter({ hasText: bed });
  await expect(dueRow).toBeVisible();
  await page.getByRole("button", { name: "Record payment" }).click();
  const form = page.getByRole("dialog", { name: "Record a payment" });
  const tenantOption = await form
    .getByLabel("Tenant *")
    .locator("option")
    .filter({ hasText: name })
    .filter({ hasText: bed })
    .getAttribute("value");
  await form.getByLabel("Tenant *").selectOption(tenantOption!);
  await expect(form.getByLabel("Rent bill")).not.toHaveValue("");
  await expect(form.getByLabel("Amount (₹) *")).not.toHaveValue("");
  await form.getByRole("button", { name: "Save record" }).click();
  await expect(form).toHaveCount(0);
  await expect(dueRow).toHaveCount(0);
  await page.getByLabel("Payment status").selectOption("All");
  await expect(dueRow).toContainText("Paid");
});

test("an advance stays due until it is applied to a rent bill", async ({
  page,
}) => {
  await page.goto("/app/payments");
  const first = page.locator("tbody tr").first();
  const name = (await first
    .locator(".record-identity strong")
    .textContent())!.trim();
  const bed = (await first
    .locator(".record-identity small")
    .first()
    .textContent())!.trim();
  const dueRow = page
    .locator("tbody tr")
    .filter({ hasText: name })
    .filter({ hasText: bed });
  await page.getByRole("button", { name: "Record payment" }).click();
  const payment = page.getByRole("dialog", { name: "Record a payment" });
  const tenantOption = await payment
    .getByLabel("Tenant *")
    .locator("option")
    .filter({ hasText: name })
    .filter({ hasText: bed })
    .getAttribute("value");
  await payment.getByLabel("Tenant *").selectOption(tenantOption!);
  await payment.getByLabel("Rent bill").selectOption("");
  await expect(
    payment.getByText("This payment will be kept as advance money.", {
      exact: false,
    }),
  ).toBeVisible();
  await payment.getByRole("button", { name: "Save record" }).click();
  await expect(payment).toHaveCount(0);
  await expect(dueRow).toBeVisible();
  await expect(dueRow).toContainText("advance available");
  await dueRow.getByRole("button", { name: "Use advance" }).click();
  const allocation = page.getByRole("dialog", { name: "Use advance for rent" });
  await expect(allocation.getByLabel("Rent bill")).not.toHaveValue("");
  await allocation.getByRole("button", { name: "Save record" }).click();
  await expect(allocation).toHaveCount(0);
  await expect(dueRow).toHaveCount(0);
});
