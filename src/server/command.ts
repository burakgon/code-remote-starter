function singleQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

export function buildSessionCommand(baseCommand: string, name: string): string {
  // baseCommand is `claude remote-control ...`; the session/environment name is
  // passed via --name (shown in claude.ai/code and the Claude mobile app).
  return `${baseCommand} --name ${singleQuote(name)}`;
}
