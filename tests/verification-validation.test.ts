import { describe, expect, it } from "vitest";
import { getVerificationErrors } from "../src/components/Editors";

describe("resident verification validation", () => {
  it("allows a verified resident once all required fields are filled", () => {
    const errors = getVerificationErrors({
      verificationStatus: "Verified",
      verificationDate: "2026-10-20",
      verificationMethod: "Driving licence",
      verifyingStaff: "Test Staff",
      aadhaarConsent: false,
    });

    expect(errors).toEqual({});
  });

  it("asks for the missing verification details before the error disappears", () => {
    const errors = getVerificationErrors({
      verificationStatus: "Verified",
      verificationDate: "",
      verificationMethod: "",
      verifyingStaff: " ",
      aadhaarConsent: false,
    });

    expect(errors).toMatchObject({
      verificationDate: "Add the date checked.",
      verificationMethod: "Choose an ID type.",
      verifyingStaff: "Add the staff member's name.",
    });
  });
});
