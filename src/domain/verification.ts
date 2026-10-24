export function getVerificationErrors(v: {
  verificationStatus: string;
  verificationDate: string;
  verificationMethod: string;
  verifyingStaff: string;
  aadhaarConsent: boolean;
}) {
  const errors: Partial<
    Record<
      | "verificationDate"
      | "verificationMethod"
      | "verifyingStaff"
      | "aadhaarConsent",
      string
    >
  > = {};

  if (v.verificationStatus !== "Verified") return errors;
  if (!v.verificationDate) errors.verificationDate = "Add the date checked.";
  if (!v.verificationMethod) errors.verificationMethod = "Choose an ID type.";
  if (!v.verifyingStaff.trim()) errors.verifyingStaff = "Add the staff member's name.";
  if (v.verificationMethod === "Aadhaar checked in person" && !v.aadhaarConsent)
    errors.aadhaarConsent = "Consent is required for an Aadhaar check.";

  return errors;
}
