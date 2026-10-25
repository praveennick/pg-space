export function assertExpectedAuthConfig(config, projectId, projectNumber) {
  const names = [
    `projects/${projectId}/config`,
    `projects/${projectNumber}/config`,
  ];
  if (
    !config ||
    !names.includes(config.name) ||
    !config.signIn ||
    typeof config.signIn !== "object"
  )
    throw new Error(
      "Could not validate the Firebase project configuration. No changes made.",
    );
}
