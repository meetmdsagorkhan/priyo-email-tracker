export function errorMessage(
  error: unknown,
  fallback = "Something went wrong. Please try again.",
) {
  return error instanceof Error ? error.message : fallback;
}
export function isAutomated(metadata: unknown): boolean {
  return (
    typeof metadata === "object" &&
    metadata !== null &&
    "automated_estimate" in metadata &&
    metadata.automated_estimate === true
  );
}
