import { expect, test } from "@playwright/test";
import { resolve } from "node:path";

test.use({
  launchOptions: {
    executablePath: process.env.PLAYWRIGHT_CHROME_PATH,
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
    ],
  },
});

test("a resident photo and verification record can be added and removed", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 760 });
  await page.goto("/app/tenants");
  await page.getByRole("button", { name: "View profile" }).first().click();
  const profile = page.getByRole("dialog", { name: "Resident profile" });
  await profile.getByRole("button", { name: "Edit details" }).click();
  const editor = page.getByRole("dialog", { name: "Edit resident" });
  await editor.getByLabel("Choose profile photo").setInputFiles({
    name: "fake.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from("not an image"),
  });
  await expect(
    page.getByText("This file does not match its image type."),
  ).toBeVisible();
  await editor
    .getByLabel("Choose profile photo")
    .setInputFiles(resolve("tests/artifacts/dashboard-mobile.png"));
  await expect(editor.getByAltText("New resident photo preview")).toBeVisible();
  await editor.getByLabel("Verification status").selectOption("Verified");
  await expect(editor.getByText("Add the date checked.")).toHaveCount(0);
  await expect(editor.getByText("Choose an ID type.")).toHaveCount(0);
  await expect(editor.getByText("Add the staff member's name.")).toHaveCount(0);
  await editor.getByRole("button", { name: "Save resident" }).click();
  await expect(editor.getByText("Add the date checked.")).toBeVisible();
  await expect(editor.getByText("Choose an ID type.")).toBeVisible();
  await expect(editor.getByText("Add the staff member's name.")).toBeVisible();
  await editor.getByLabel("ID checked").selectOption("Driving licence");
  await editor.getByRole("textbox", { name: "Date checked" }).fill("20-10-2026");
  await editor.getByLabel("Checked by").fill("Test Staff");
  await editor.getByRole("button", { name: "Save resident" }).click();
  await expect(editor).toHaveCount(0);
  await expect(profile.locator(".profile-heading img")).toBeVisible();
  await profile.getByRole("button", { name: "ID check" }).click();
  await expect(profile.getByText("Driving licence")).toBeVisible();
  await expect(profile.getByText("Test Staff")).toBeVisible();
  await page.reload();
  await expect(profile.locator(".profile-heading img")).toBeVisible();
  await profile
    .getByRole("button", { name: "Replace or remove photo" })
    .click();
  const editAgain = page.getByRole("dialog", { name: "Edit resident" });
  await editAgain.getByRole("button", { name: "Remove" }).click();
  await editAgain.getByRole("button", { name: "Save resident" }).click();
  await expect(editAgain).toHaveCount(0);
  await expect(profile.locator(".profile-heading img")).toHaveCount(0);
});

test("registration saves a photo and shows it in the resident list", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 760 });
  await page.goto("/app/tenants");
  await page.getByRole("button", { name: "Add tenant" }).click();
  const editor = page.getByRole("dialog", { name: "Add a resident" });
  await editor.getByLabel("Full name *").fill("Fictional Photo Resident");
  await editor.getByLabel("Phone *").fill("9000000011");
  await editor
    .getByLabel("Choose profile photo")
    .setInputFiles(resolve("tests/artifacts/dashboard-mobile.png"));
  await editor.getByRole("button", { name: "Continue" }).click();
  const availableBed = editor.locator(".allocation-grid button").first();
  const bedLabel = (await availableBed.locator("strong").textContent())!.trim();
  await availableBed.click();
  await editor.getByRole("button", { name: "Continue" }).click();
  await editor.getByRole("button", { name: "Continue" }).click();
  await editor.getByRole("button", { name: "Confirm check-in" }).click();
  await expect(editor).toHaveCount(0);
  await page.getByLabel("Search tenants").fill("Fictional Photo Resident");
  await expect(
    page
      .locator("tbody tr")
      .filter({ hasText: "Fictional Photo Resident" })
      .locator(".tenant-avatar img"),
  ).toBeVisible();
  await page.goto("/app/rooms");
  await page.getByLabel("Search rooms").fill(bedLabel.split("-")[0]);
  await page.getByRole("button", { name: `Bed ${bedLabel}: Occupied` }).click();
  await expect(
    page.getByRole("dialog").locator(".bed-resident-heading img"),
  ).toBeVisible();
});

test.describe("camera capture", () => {
  test("captures and retakes a photo on localhost", async ({ page }) => {
    await page.context().grantPermissions(["camera"]);
    await page.goto("/app/tenants");
    await page.getByRole("button", { name: "View profile" }).first().click();
    await page
      .getByRole("dialog", { name: "Resident profile" })
      .getByRole("button", { name: "Edit details" })
      .click();
    const editor = page.getByRole("dialog", { name: "Edit resident" });
    await editor.getByRole("button", { name: "Capture Photo" }).click();
    const camera = page.getByRole("dialog", { name: "Capture photo" });
    await expect(camera.getByLabel("Live camera preview")).toBeVisible();
    await expect(
      camera.getByRole("button", { name: "Capture", exact: true }),
    ).toBeEnabled();
    await camera.getByRole("button", { name: "Capture", exact: true }).click();
    await expect(camera.getByAltText("Captured photo preview")).toBeVisible();
    await camera.getByRole("button", { name: "Retake" }).click();
    await expect(
      camera.getByRole("button", { name: "Capture", exact: true }),
    ).toBeEnabled();
    await camera.getByRole("button", { name: "Capture", exact: true }).click();
    await camera.getByRole("button", { name: "Use Photo" }).click();
    await expect(
      editor.getByAltText("New resident photo preview"),
    ).toBeVisible();
  });
});
