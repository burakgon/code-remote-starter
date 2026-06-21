import { describe, it, expect } from 'vitest';
import { buildSessionCommand } from './command.ts';

const BASE = 'claude --dangerously-skip-permissions --effort max';

describe('buildSessionCommand', () => {
  it('appends a single-quoted remote-control name', () => {
    expect(buildSessionCommand(BASE, 'code-starter')).toBe(
      `${BASE} --remote-control 'code-starter'`,
    );
  });

  it('escapes single quotes in the name', () => {
    expect(buildSessionCommand(BASE, "my'proj")).toBe(`${BASE} --remote-control 'my'\\''proj'`);
  });

  it('handles names with spaces', () => {
    expect(buildSessionCommand(BASE, 'hello world')).toBe(`${BASE} --remote-control 'hello world'`);
  });
});
