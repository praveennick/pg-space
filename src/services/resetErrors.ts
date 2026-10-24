export function resetFailureMessage(
  error: unknown,
  deletedRecords: number,
  writeAttempted: boolean,
): string {
  const permissionDenied = [
    "permission-denied",
    "firestore/permission-denied",
  ].includes(String((error as { code?: string })?.code));
  if (permissionDenied) {
    return deletedRecords === 0
      ? "Reset was blocked by the published Firebase rules. Publish the latest rules, then try again. No records were deleted."
      : `Reset stopped because Firebase denied access. ${deletedRecords} records were deleted before it stopped. Publish the latest rules before retrying.`;
  }
  const detail = error instanceof Error ? error.message : "Please try again.";
  if (!writeAttempted)
    return `Reset failed before deletion. No records were deleted. ${detail}`;
  return `Reset could not be completed. ${deletedRecords ? `${deletedRecords} records were confirmed deleted; ` : ""}other deletions could not be confirmed. Check your records before retrying. ${detail}`;
}
