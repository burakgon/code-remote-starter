import { describe, it, expect } from 'vitest';
import { buildSessionCommand } from './command.ts';

const BASE = 'claude --dangerously-skip-permissions --effort max';

describe('buildSessionCommand', () => {
  it('runs the base command (cym) verbatim', () => {
    expect(buildSessionCommand(BASE)).toBe(BASE);
  });
});
