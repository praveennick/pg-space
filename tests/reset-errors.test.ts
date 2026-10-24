import { expect, it } from "vitest";
import { resetFailureMessage } from "../src/services/resetErrors";

it("explains a rules failure before deletion without claiming partial deletion", () => {
  const message = resetFailureMessage({ code: "permission-denied" }, 0, false);
  expect(message).toContain("Publish the latest rules");
  expect(message).toContain("No records were deleted");
});
it("reports confirmed deletions when a later batch is rejected", () => {
  expect(
    resetFailureMessage({ code: "permission-denied" }, 200, true),
  ).toContain("200 records were deleted");
});
it("does not claim no deletion when a write timed out", () => {
  const message = resetFailureMessage(new Error("Network timeout"), 0, true);
  expect(message).toContain("could not be confirmed");
  expect(message).not.toContain("No records were deleted");
});
