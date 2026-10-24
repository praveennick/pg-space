import { expect, test } from "@playwright/test";

test("mobile header search finds a room and opens its details", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/app/dashboard");

  await page.getByRole("button", { name: "Search residents and rooms" }).click();
  const search = page.getByRole("search");
  await expect(search.getByRole("textbox")).toBeFocused();
  await search.getByRole("textbox").fill("101");
  await search.getByRole("button", { name: /Room 101/ }).click();

  await expect(page).toHaveURL(/\/app\/rooms\//);
  await expect(search).toBeHidden();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
});

test("mobile navigation and record details remain reachable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto("/app/tenants");
  await expect(page.locator("main h1")).toHaveText("Your residents");

  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(page.locator(".sidebar")).toHaveClass(/show/);
  await expect(page.locator(".bottom-nav")).toBeHidden();
  await page.locator('.sidebar a[href="/app/settings"]').click();
  await expect(page.locator("main h1")).toHaveText("Settings");
  await expect(page.locator(".sidebar")).not.toHaveClass(/show/);
  await expect(page.locator(".bottom-nav")).toBeVisible();
  await page
    .getByRole("button", { name: "Reset demo data" })
    .scrollIntoViewIfNeeded();
  const reset = await page
    .getByRole("button", { name: "Reset demo data" })
    .boundingBox();
  const bar = await page.locator(".bottom-nav").boundingBox();
  expect(reset && bar && reset.y + reset.height <= bar.y).toBeTruthy();

  for (const route of [
    "dashboard",
    "rooms",
    "tenants",
    "payments",
    "expenses",
    "reports",
  ]) {
    await page.goto(`/app/${route}`);
    await expect(page.locator("main h1")).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBe(true);
    await expect
      .poll(() =>
        page.evaluate(() =>
          [...document.querySelectorAll<HTMLElement>(".table-wrap")].every(
            (table) => table.scrollWidth <= table.clientWidth + 1,
          ),
        ),
      )
      .toBe(true);
    const firstRow = page.locator(".table-wrap tbody tr").first();
    if (await firstRow.count()) {
      await expect(firstRow.locator("td[data-label]").first()).toBeVisible();
    }
  }

  await page.goto("/app/payments");
  const firstInvoice = page.locator(".table-wrap tbody tr").first();
  if (await firstInvoice.count()) {
    await expect(
      firstInvoice.locator('td[data-label="Left to pay"]'),
    ).toBeVisible();
    await expect(firstInvoice.locator('td[data-label="Status"]')).toBeVisible();
  }
  await page.getByRole("button", { name: "Payments received", exact: true }).click();
  const firstPayment = page.locator(".table-wrap tbody tr").first();
  if (await firstPayment.count()) {
    await expect(
      firstPayment.locator('td[data-label="Not used for rent"]'),
    ).toBeVisible();
    await expect(firstPayment.locator("button", { name: /PDF/ })).toBeVisible();
  }
});

test("narrow phone layouts keep cards, tables, and forms usable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/app/tenants");
  await page.getByRole("button", { name: "Card view" }).click();
  const card = page.locator(".tenant-card").first();
  await expect(card).toContainText("Monthly rent");
  await expect(card).toContainText("Rent due");
  await page.getByRole("button", { name: "Add tenant" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  await page.getByLabel("Close dialog").click();

  await page.goto("/app/rooms");
  await page.getByRole("button", { name: "Table view" }).click();
  const row = page.locator(".table-wrap tbody tr").first();
  await expect(row.locator('td[data-label="Rent / bed"]')).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);

  await page.goto("/app/reports");
  const detail = page.getByText("More details");
  await detail.scrollIntoViewIfNeeded();
  await expect(page.locator(".pagination").last()).toContainText("Page 1 of");
  await page
    .locator(".pagination")
    .last()
    .getByRole("button", { name: "Next" })
    .click();
  await expect(page.locator(".pagination").last()).toContainText("Page 2 of");
});

test("reservation filters and card text fit narrow phones", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/app/reservations");
  const tabs = page.locator(".operation-tabs");
  await expect(tabs).toBeVisible();
  await expect(tabs.locator("button")).toHaveCount(6);
  await expect
    .poll(() =>
      tabs.evaluate(
        (element) => element.scrollWidth <= element.clientWidth + 1,
      ),
    )
    .toBe(true);
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  await expect(tabs.getByRole("button", { name: "Expired" })).toBeVisible();
  await tabs.getByRole("button", { name: "Pending" }).click();
  await expect(tabs.getByRole("button", { name: "Pending" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await tabs.getByRole("button", { name: "All", exact: true }).click();
  const card = page.locator(".operation-card").first();
  await expect(card).toBeVisible();
  expect(
    await card
      .locator(".report-row")
      .first()
      .evaluate((element) => parseFloat(getComputedStyle(element).fontSize)),
  ).toBeGreaterThanOrEqual(13);
  await page.goto("/app/maintenance");
  await expect(page.locator(".operation-tabs button")).toHaveCount(5);
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
});

test("payment, report, and resident tabs fit without sideways scrolling", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  for (const route of ["payments", "reports"]) {
    await page.goto(`/app/${route}`);
    const tabs = page.locator("main .tabs").first();
    await expect(tabs.locator("button")).toHaveCount(4);
    await expect
      .poll(() =>
        tabs.evaluate(
          (element) => element.scrollWidth <= element.clientWidth + 1,
        ),
      )
      .toBe(true);
    for (const button of await tabs.locator("button").all()) {
      const box = await button.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }
  }
  await page.goto("/app/tenants");
  await page
    .locator("tbody tr")
    .first()
    .getByRole("button", { name: "View profile" })
    .click();
  const profileTabs = page.locator(".dialog .tabs");
  await expect(profileTabs.locator("button")).toHaveCount(6);
  await expect
    .poll(() =>
      profileTabs.evaluate(
        (element) => element.scrollWidth <= element.clientWidth + 1,
      ),
    )
    .toBe(true);
  await profileTabs.getByRole("button", { name: "Activity" }).click();
  await expect(
    profileTabs.getByRole("button", { name: "Activity" }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("mobile filters show their selected values at narrow widths", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  for (const route of ["rooms", "tenants", "payments"]) {
    await page.goto(`/app/${route}`);
    const toolbar = page.locator("main .list-toolbar");
    await expect
      .poll(() =>
        toolbar.evaluate(
          (element) => element.scrollWidth <= element.clientWidth + 1,
        ),
      )
      .toBe(true);
    for (const select of await toolbar.locator("select").all()) {
      const enoughRoom = await select.evaluate((element) => {
        const style = getComputedStyle(element);
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d")!;
        context.font = style.font;
        const textWidth = context.measureText(
          element.selectedOptions[0].text,
        ).width;
        return (
          element.clientWidth >=
          textWidth +
            parseFloat(style.paddingLeft) +
            parseFloat(style.paddingRight) +
            12
        );
      });
      expect(enoughRoom).toBe(true);
    }
  }
});

test("mobile table identities stay grouped beside their labels", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of ["payments", "expenses"]) {
    await page.goto(`/app/${route}`);
    const identity = page
      .locator(".table-wrap tbody tr .record-identity:has(small)")
      .first();
    await expect(identity).toBeVisible();
    const title = await identity.locator("strong").boundingBox();
    const detail = await identity.locator("small").boundingBox();
    expect(
      title && detail && detail.y >= title.y + title.height - 1,
    ).toBeTruthy();
    const firstCell = identity.locator("xpath=..");
    await expect(firstCell).toHaveCSS("display", "grid");
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBe(true);
  }
  for (const route of ["dashboard", "tenants", "reports"]) {
    await page.goto(`/app/${route}`);
    const firstCell = page
      .locator(".table-wrap tbody tr td:first-child")
      .first();
    await expect(firstCell).toHaveCSS("display", "grid");
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/app/payments");
  const desktopIdentity = page.locator(".record-identity:has(small)").first();
  await expect(desktopIdentity).toHaveCSS("display", "flex");
  const desktopTitle = await desktopIdentity.locator("strong").boundingBox();
  const desktopDetail = await desktopIdentity.locator("small").boundingBox();
  expect(
    desktopTitle &&
      desktopDetail &&
      desktopDetail.y >= desktopTitle.y + desktopTitle.height - 1,
  ).toBeTruthy();
});

test("dashboard mobile text is readable in cards and reminders", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/app/dashboard");
  await expect(page.locator(".kpi-card").first()).toBeVisible();
  const sizes = await page.evaluate(() => {
    const size = (selector: string) =>
      parseFloat(getComputedStyle(document.querySelector(selector)!).fontSize);
    return {
      metricLabel: size(".kpi-top"),
      metricNote: size(".metric-note"),
      sectionTitle: size(".lower-grid .section-title h2"),
      reminder: size(".attention-list strong"),
      reminderDetail: size(".attention-list p"),
      footer: size(".page-footer"),
    };
  });
  expect(sizes.metricLabel).toBeGreaterThanOrEqual(14);
  expect(sizes.metricNote).toBeGreaterThanOrEqual(14);
  expect(sizes.sectionTitle).toBeGreaterThanOrEqual(18);
  expect(sizes.reminder).toBeGreaterThanOrEqual(15);
  expect(sizes.reminderDetail).toBeGreaterThanOrEqual(13);
  expect(sizes.footer).toBeGreaterThanOrEqual(13);
  await page.setViewportSize({ width: 320, height: 568 });
  await expect
    .poll(() =>
      page.evaluate(() =>
        [
          ...document.querySelectorAll<HTMLElement>(
            ".kpi-card, .attention-list",
          ),
        ].every((element) => element.scrollWidth <= element.clientWidth + 1),
      ),
    )
    .toBe(true);
});

test.describe("touch charts", () => {
  test.use({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 390, height: 844 },
  });
  test("mobile charts stay clear after touch and expose their figures", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/app/dashboard");
    for (const selector of [".collection-panel", ".occupancy-panel"]) {
      const chart = page.locator(`${selector} .recharts-surface`);
      await chart.scrollIntoViewIfNeeded();
      await chart.tap();
      await expect
        .poll(() =>
          page.evaluate(() => {
            const focused = document.activeElement;
            return (
              !focused?.closest(".recharts-wrapper") ||
              getComputedStyle(focused).outlineStyle === "none"
            );
          }),
        )
        .toBe(true);
      await expect
        .poll(() =>
          page
            .locator(`${selector} .recharts-tooltip-wrapper`)
            .evaluateAll((elements) =>
              elements.every(
                (element) => getComputedStyle(element).display === "none",
              ),
            ),
        )
        .toBe(true);
    }
    const donut = await page.locator(".occupancy-panel .donut").boundingBox();
    const legend = await page
      .locator(".occupancy-panel .occupancy-legend")
      .boundingBox();
    expect(
      donut && legend && legend.y >= donut.y + donut.height - 1,
    ).toBeTruthy();
    const rentDetails = page.locator(".collection-panel .chart-data-details");
    await rentDetails.locator("summary").click();
    await expect(rentDetails.locator(".chart-data-row")).toHaveCount(6);
    await expect(rentDetails).toContainText("Still due");

    await page.setViewportSize({ width: 320, height: 568 });
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      )
      .toBe(true);
    const narrowDonut = await page.locator(".occupancy-panel .donut").boundingBox();
    const narrowLegend = await page
      .locator(".occupancy-panel .occupancy-legend")
      .boundingBox();
    expect(
      narrowDonut &&
        narrowLegend &&
        narrowLegend.y >= narrowDonut.y + narrowDonut.height - 1,
    ).toBeTruthy();

    await page.goto("/app/reports");
    const cashChart = page.locator(".chart-grid .recharts-surface").last();
    await cashChart.scrollIntoViewIfNeeded();
    await cashChart.tap();
    await expect
      .poll(() =>
        page.evaluate(() => {
          const focused = document.activeElement;
          return (
            !focused?.closest(".recharts-wrapper") ||
            getComputedStyle(focused).outlineStyle === "none"
          );
        }),
      )
      .toBe(true);
    const cashDetails = page
      .getByText("See monthly income and expenses")
      .locator("xpath=..");
    await cashDetails.locator("summary").click();
    await expect(cashDetails.locator(".chart-data-row")).toHaveCount(6);
    await expect(cashDetails).toContainText("Expenses");
  });
});

test("desktop charts keep hover tooltips with currency values", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/app/dashboard");
  const rentChart = page.locator(".collection-panel .recharts-surface");
  await expect(rentChart).toBeVisible();
  await rentChart.hover({ position: { x: 240, y: 90 } });
  await expect(page.locator(".collection-panel .recharts-tooltip-wrapper")).toBeVisible();

  await page.goto("/app/reports");
  const bar = page.locator(".recharts-bar-rectangle").first();
  await expect(bar).toBeVisible();
  await bar.hover();
  const tooltip = page.locator(".chart-grid .recharts-tooltip-wrapper").last();
  await expect(tooltip).toBeVisible();
  await expect(tooltip).toContainText("₹");
});
