import { describe, expect, it } from "vitest";
import { Blob as NodeBlob } from "node:buffer";
import { detectedImageType } from "../src/services/profilePhoto";
import { schemas } from "../src/domain/models";
import { demoData } from "../src/data/seed";

describe("profile photo file checks", () => {
  it("detects JPEG, PNG and WebP signatures", async () => {
    expect(
      await detectedImageType(
        new NodeBlob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])]) as Blob,
      ),
    ).toBe("image/jpeg");
    expect(
      await detectedImageType(
        new NodeBlob([
          new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
        ]) as Blob,
      ),
    ).toBe("image/png");
    expect(
      await detectedImageType(
        new NodeBlob([
          new Uint8Array([82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80]),
        ]) as Blob,
      ),
    ).toBe("image/webp");
    expect(
      await detectedImageType(new NodeBlob(["not an image"]) as Blob),
    ).toBeNull();
  });
});

describe("identity verification", () => {
  it("requires consent for an in-person Aadhaar check and permits another ID", () => {
    const tenant = demoData().tenants[0];
    const verification = {
      status: "Verified",
      date: "2026-10-21",
      method: "Aadhaar checked in person",
      staff: "Test Staff",
    };
    expect(schemas.tenants.safeParse({ ...tenant, verification }).success).toBe(false);
    expect(schemas.tenants.safeParse({ ...tenant, verification: { ...verification, consent: true } }).success).toBe(true);
    expect(schemas.tenants.safeParse({ ...tenant, verification: { ...verification, method: "Passport" } }).success).toBe(true);
  });
});
