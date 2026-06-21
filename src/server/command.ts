function singleQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

export function buildSessionCommand(baseCommand: string, name: string): string {
  return `${baseCommand} --remote-control ${singleQuote(name)}`;
}
