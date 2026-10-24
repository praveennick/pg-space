import { expect, test } from "@playwright/test";

test("a quotation can be filled and exported on a narrow phone", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 360, height: 720 });
  await page.goto("/app/quotations");
  await expect(page.locator("main h1")).toHaveText("Quotations");
  await expect(page.getByLabel("Quotation number")).toHaveValue(
    /LLPG\/QTN\/\d{4}-\d{2}\/001/,
  );
  await page.getByLabel("To / company name").fill("VINTON Engineering");
  await page.getByLabel("Recipient address").fill("Ernakulam, Kerala");
  await page.getByLabel("Accommodation").fill("4");
  await page.getByLabel("Persons / slots").fill("8");
  await page.getByLabel("Rate / person / month (₹)").fill("6500");
  await page.getByRole("button", { name: "Add accommodation" }).click();
  await page.getByLabel("Accommodation").nth(1).fill("2");
  await page.getByLabel("Persons / slots").nth(1).fill("2");
  await page.getByLabel("Rate / person / month (₹)").nth(1).fill("9500");
  await expect(page.locator(".quotation-total strong")).toHaveText("₹71,000");
  await expect(page.locator(".quotation-preview-items")).toContainText(
    "4 Sharing",
  );
  await expect(page.locator(".quotation-preview-items")).toContainText(
    "2 Sharing",
  );
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  await page.reload();
  await expect(page.getByLabel("To / company name")).toHaveValue(
    "VINTON Engineering",
  );
  await expect(page.locator(".quotation-total strong")).toHaveText("₹71,000");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PDF" }).click();
  const download = await downloadPromise;
  await download.saveAs(testInfo.outputPath("quotation.pdf"));
  expect(download.suggestedFilename()).toMatch(/^quotation-.*\.pdf$/);
  const stream = await download.createReadStream();
  expect(stream).toBeTruthy();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const bytes = Buffer.concat(chunks);
  expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
  expect(bytes.length).toBeGreaterThan(100_000);
  const pdfText = bytes.toString("latin1");
  expect(pdfText.match(/\/Type \/Page\b/g)).toHaveLength(1);
  expect(pdfText).toContain("TOTAL MONTHLY AMOUNT");
  expect(pdfText).toContain("Notes / Inclusions");
  expect(pdfText).toContain("4 Sharing");
  expect(pdfText).toContain("2 Sharing");
  await expect(
    page
      .getByRole("region", { name: "Quotation history" })
      .getByText("VINTON Engineering"),
  ).toBeVisible();
  await page.getByRole("button", { name: "New quotation" }).click();
  await expect(page.getByLabel("Quotation number")).toHaveValue(/\/002$/);
  await page.getByLabel("To / company name").fill("Second Customer");
  await page.getByLabel("Accommodation").fill("3");
  await page.getByLabel("Rate / person / month (₹)").fill("8000");
  await page.getByRole("button", { name: "Save quotation" }).click();
  await expect(
    page
      .getByRole("region", { name: "Quotation history" })
      .getByText("Second Customer"),
  ).toBeVisible();
  await page.reload();
  const history = page.getByRole("region", { name: "Quotation history" });
  await expect(history.getByText("VINTON Engineering")).toBeVisible();
  await expect(history.getByText("Second Customer")).toBeVisible();
  await history.getByRole("button", { name: "Open" }).last().click();
  await expect(page.getByLabel("To / company name")).toHaveValue(
    "VINTON Engineering",
  );
  await expect(page.getByLabel("Quotation number")).toHaveValue(/\/001$/);
  await page.goto("/app/settings");
  const backupPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download backup" }).click();
  const backupDownload = await backupPromise;
  const backupStream = await backupDownload.createReadStream();
  const backupChunks: Buffer[] = [];
  for await (const chunk of backupStream!)
    backupChunks.push(Buffer.from(chunk));
  const backup = JSON.parse(Buffer.concat(backupChunks).toString());
  expect(backup.version).toBe(2);
  expect(backup.data.quotations).toHaveLength(2);
});
