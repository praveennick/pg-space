import { expect, test, type Page } from "@playwright/test";

async function expectFits(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  const overflow = await page
    .locator(
      "main .panel, main .room-card, main .operation-card, main .reminder-card, .dialog, main .list-toolbar, main .tabs",
    )
    .evaluateAll((elements) =>
      elements
        .filter((element) => {
          const node = element as HTMLElement;
          return (
            node.getBoundingClientRect().width > 0 &&
            node.scrollWidth > node.clientWidth + 2
          );
        })
        .map((element) => ({
          class: element.className,
          extra: element.scrollWidth - element.clientWidth,
        })),
    );
  expect(overflow).toEqual([]);
}

for (const width of [320, 390, 768]) {
  test(`all management pages fit ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    for (const route of [
      "dashboard",
      "rooms",
      "tenants",
      "reservations",
      "payments",
      "reminders",
      "quotations",
      "expenses",
      "maintenance",
      "notifications",
      "reports",
      "activity",
      "settings",
      "team",
    ]) {
      await test.step(route, async () => {
        await page.goto(`/app/${route}`);
        await expect(page.locator("main h1")).toBeVisible();
        await expectFits(page);
      });
    }
  });
}

test("attention rows keep readable text and a separate reminder action", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/app/dashboard");
  const item = page.locator(".attention-item").first();
  await expect(item).toBeVisible();
  await item.locator("strong").evaluate((element) => {
    element.textContent = "₹1,91,919.35 rent pending";
  });
  await item.locator("p").evaluate((element) => {
    element.textContent = "Praveen Kumar Subramanian · 10-2026";
  });
  const copy = await item.locator(".attention-link > div").boundingBox();
  const link = await item.locator(".attention-link").boundingBox();
  const remind = await item
    .getByRole("button", { name: "Remind" })
    .boundingBox();
  expect(copy!.width).toBeGreaterThan(130);
  expect(remind!.y).toBeGreaterThanOrEqual(link!.y + link!.height - 1);
  expect(remind!.height).toBeGreaterThanOrEqual(44);
  await item.screenshot({ path: "tests/artifacts/mobile-attention.png" });
  await expectFits(page);
});

test("mobile editors and resident actions fit narrow phones", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 640 });
  for (const [route, action] of [
    ["rooms", "Add room"],
    ["tenants", "Add tenant"],
    ["reservations", "New reservation"],
    ["payments", "Record payment"],
    ["expenses", "Add expense"],
    ["maintenance", "Report a problem"],
  ]) {
    await page.goto(`/app/${route}`);
    await page
      .getByRole("button", { name: action, exact: true })
      .first()
      .click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expectFits(page);
    for (const field of await dialog
      .locator(
        "input:not([type=checkbox]):not([type=hidden]), select, textarea",
      )
      .all()) {
      if (await field.isVisible())
        expect(
          await field.evaluate((node) =>
            parseFloat(getComputedStyle(node).fontSize),
          ),
        ).toBeGreaterThanOrEqual(16);
    }
    await page.getByRole("button", { name: "Close dialog" }).click();
  }
  await page.goto("/app/tenants");
  await page.getByRole("button", { name: "View profile" }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expectFits(page);
  await page.getByRole("button", { name: /^Send reminder to/ }).click();
  await expect(page.getByRole("dialog").last()).toBeVisible();
  await expectFits(page);
});

test("bed details, transfer, checkout, deposits and photo controls stay reachable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 640 });
  for (const action of [
    "Transfer",
    "Checkout",
    "Deposit history",
    "Edit details",
  ]) {
    await page.goto("/app/tenants");
    await page.getByRole("button", { name: "View profile" }).first().click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: action, exact: true })
      .click();
    await expect(page.getByRole("dialog").last()).toBeVisible();
    await expectFits(page);
  }
  await page.goto("/app/rooms");
  await page.locator(".bed.occupied").first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expectFits(page);
});
