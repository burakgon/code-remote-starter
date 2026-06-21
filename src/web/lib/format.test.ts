import { describe, it, expect } from 'vitest';
import { basename, tildePath, relativeTime } from './format.ts';

describe('basename', () => {
  it('returns the last path segment', () => {
    expect(basename('/Users/x/Developer/code-starter')).toBe('code-starter');
    expect(basename('/Users/x/Developer/code-starter/')).toBe('code-starter');
  });
});

describe('tildePath', () => {
  it('collapses the home directory to ~', () => {
    expect(tildePath('/Users/x', '/Users/x')).toBe('~');
    expect(tildePath('/Users/x/Developer', '/Users/x')).toBe('~/Developer');
    expect(tildePath('/etc', '/Users/x')).toBe('/etc');
  });
});

describe('relativeTime', () => {
  it('formats elapsed time', () => {
    const now = 1_000_000_000;
    expect(relativeTime(now, now)).toBe('just now');
    expect(relativeTime(now - 30_000, now)).toBe('30s ago');
    expect(relativeTime(now - 5 * 60_000, now)).toBe('5m ago');
    expect(relativeTime(now - 3 * 3_600_000, now)).toBe('3h ago');
    expect(relativeTime(now - 2 * 86_400_000, now)).toBe('2d ago');
  });
});
