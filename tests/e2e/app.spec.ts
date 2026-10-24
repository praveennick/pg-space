import { test, expect } from "@playwright/test";
test("bed status filters show only matching beds in room cards", async ({ page }) => {
  for (const status of ["Occupied", "Available"]) {
    await page.goto(`/app/rooms?status=${status}`);
    const card = page.locator(".room-card").first();
    await expect(card).toBeVisible();
    const shownBeds = card.locator(".bed");
    expect(await shownBeds.count()).toBeGreaterThan(0);
    await expect(card.locator(`.bed:not(.${status.toLowerCase()})`)).toHaveCount(0);
    await card.getByRole("button", { name: "Room details" }).click();
    const detail = page.getByRole("dialog").locator(".room-card");
    await expect(detail).toBeVisible();
    expect(await detail.locator(".bed").count()).toBeGreaterThanOrEqual(await shownBeds.count());
  }
});
test("room capacity, tenant check-in, payment and refresh persistence", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/app/rooms");
  await page.getByRole("button", { name: "Add room", exact: true }).click();
  await page.getByLabel("Room number *").fill("QA-501");
  await page
    .getByRole("dialog")
    .getByLabel("Sharing type", { exact: true })
    .selectOption("3");
  await expect(page.getByLabel("Number of beds *")).toHaveValue("3");
  await page.getByRole("button", { name: "Create room & beds" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByLabel("Search rooms").fill("QA-501");
  await expect(page.getByRole("button", { name: /Bed QA-501/ })).toHaveCount(3);
  await page.reload();
  await page.getByLabel("Search rooms").fill("QA-501");
  await expect(page.getByRole("button", { name: /Bed QA-501/ })).toHaveCount(3);
  await page.getByLabel("Edit room QA-501").click();
  await page.getByLabel("Number of beds *").fill("4");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Bed QA-501/ })).toHaveCount(4);
  await page.getByRole("button", { name: "Bed QA-501-D: Available" }).click();
  await page.getByRole("button", { name: "Assign tenant" }).click();
  await page.getByLabel("Full name *").fill("QA Fictional Resident");
  await page.getByLabel("Phone *").fill("9000000000");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByLabel("Monthly rent (₹)", { exact: true }).fill("8000");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Confirm check-in" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Bed QA-501-D: Occupied" }),
  ).toBeVisible();
  const occupiedBed = page.getByRole("button", { name: "Bed QA-501-D: Occupied" });
  const freeBed = page.getByRole("button", { name: "Bed QA-501-A: Available" });
  await expect(occupiedBed).toContainText("In use");
  await expect(freeBed).toContainText("Free");
  const occupiedColor = await occupiedBed.evaluate((bed) => getComputedStyle(bed).backgroundColor);
  const freeColor = await freeBed.evaluate((bed) => getComputedStyle(bed).backgroundColor);
  expect(occupiedColor).not.toBe(freeColor);
  await page.getByLabel("Edit room QA-501").click();
  await page.getByLabel("Number of beds *").fill("2");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page.getByRole("button", { name: "Remove empty beds" }).click();
  await expect(page.getByText(/Bed QA-501-D is not free/)).toBeVisible();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await page.goto("/app/payments");
  await page.getByLabel("Search finance records").fill("QA Fictional");
  const row = page.locator("tbody tr").filter({ hasText: "QA Fictional" });
  await row.getByRole("button", { name: "Collect" }).click();
  await page.getByLabel("Amount (₹) *").fill("100");
  await page.getByRole("button", { name: "Save record" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  await page.getByLabel("Search finance records").fill("QA Fictional");
  await expect(
    page.locator("tbody tr").filter({ hasText: "QA Fictional" }),
  ).toContainText("₹100");
  expect(errors).toEqual([]);
});
test("dashboard, themes and responsive routes have no page overflow", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.goto("/app/dashboard");
  await expect(
    page.getByText("Rent collection", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".recharts-pie-sector").first()).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator(".kpi-grid > div").last()).toHaveCSS(
    "opacity",
    "1",
  );
  await page.screenshot({
    path: "tests/artifacts/dashboard-desktop.png",
    fullPage: true,
  });
  await page.getByLabel("Choose theme").click();
  await page.getByRole("menuitem", { name: "Dark", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator(".recharts-pie-sector").first()).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator(".kpi-grid > div").last()).toHaveCSS(
    "opacity",
    "1",
  );
  await page.screenshot({
    path: "tests/artifacts/dashboard-dark.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of [
    "dashboard",
    "rooms",
    "tenants",
    "payments",
    "expenses",
    "reservations",
    "maintenance",
    "notifications",
    "reports",
    "activity",
    "settings",
  ]) {
    await page.goto(`/app/${route}`);
    await expect(page.locator("main")).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      )
      .toBe(true);
  }
  await page.goto("/app/dashboard");
  await expect(page.locator(".recharts-pie-sector").first()).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator(".kpi-grid > div").last()).toHaveCSS(
    "opacity",
    "1",
  );
  await page.screenshot({
    path: "tests/artifacts/dashboard-mobile.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
test("reset requires confirmation and room sharing filters work", async ({
  page,
}) => {
  await page.goto("/app/rooms");
  await page.getByLabel("Sharing type", { exact: true }).selectOption("3");
  await expect(page.locator(".room-card")).toHaveCount(4);
  await expect(page.locator(".room-card").first()).toContainText("3-sharing");
  await page.goto("/app/settings");
  await page.getByRole("button", { name: "Reset demo data" }).click();
  await expect(
    page.getByRole("dialog", { name: "Reset all demo data?" }),
  ).toBeVisible();
  await page.getByLabel("Close dialog").click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
test("export, validated restore, and confirmed reset", async ({ page }) => {
  await page.goto("/app/settings");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download backup" }).click();
  const backup = await downloadPromise;
  const backupPath = await backup.path();
  expect(backupPath).toBeTruthy();
  await page.locator("input[type=file]").setInputFiles(backupPath!);
  await expect(
    page.getByRole("dialog", { name: "Use this backup?" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Replace data with this backup" })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Reset demo data" }).click();
  await page.getByRole("button", { name: "Yes, reset demo data" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goto("/app/rooms");
  await expect(page.locator(".list-meta")).toContainText("24 rooms");
});
