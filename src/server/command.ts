export function buildSessionCommand(baseCommand: string): string {
  // CRS runs the base command (the user's `cym`) verbatim in the session's tmux window.
  // Remote Control is enabled by the machine's `remoteControlAtStartup: true` setting —
  // exactly as a manually-typed `cym` would register and appear in the Claude app.
  return baseCommand;
}
