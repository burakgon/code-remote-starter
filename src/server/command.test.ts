import { describe, it, expect } from 'vitest';
import { buildSessionCommand } from './command.ts';

const BASE =
  'CLAUDE_CODE_EFFORT_LEVEL=max claude remote-control --permission-mode bypassPermissions';

describe('buildSessionCommand', () => {
  it('appends a single-quoted --name', () => {
    expect(buildSessionCommand(BASE, 'code-starter')).toBe(`${BASE} --name 'code-starter'`);
  });

  it('escapes single quotes in the name', () => {
    expect(buildSessionCommand(BASE, "my'proj")).toBe(`${BASE} --name 'my'\\''proj'`);
  });

  it('handles names with spaces', () => {
    expect(buildSessionCommand(BASE, 'hello world')).toBe(`${BASE} --name 'hello world'`);
  });
});
