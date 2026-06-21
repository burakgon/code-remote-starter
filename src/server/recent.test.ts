import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { extractCwd, claudeRecentDirs, recentDirectories } from './recent.ts';

let claudeProjects: string;
beforeEach(() => {
  claudeProjects = mkdtempSync(join(tmpdir(), 'crs-recent-'));
});
afterEach(() => {
  rmSync(claudeProjects, { recursive: true, force: true });
});

function project(name: string, cwd: string, mtimeSec: number) {
  const dir = join(claudeProjects, name);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, 'session.jsonl');
  writeFileSync(file, `${JSON.stringify({ type: 'user', cwd })}\n`);
  utimesSync(file, mtimeSec, mtimeSec);
}

describe('extractCwd', () => {
  it('reads the cwd from a jsonl file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'crs-cwd-'));
    const file = join(dir, 's.jsonl');
    writeFileSync(
      file,
      `${JSON.stringify({ type: 'summary' })}\n${JSON.stringify({ cwd: '/Users/x/p' })}\n`,
    );
    expect(extractCwd(file)).toBe('/Users/x/p');
    rmSync(dir, { recursive: true, force: true });
  });
});

describe('claudeRecentDirs', () => {
  it('extracts cwd + mtime per project', () => {
    project('p1', '/Users/x/a', 1000);
    project('p2', '/Users/x/b', 2000);
    const dirs = claudeRecentDirs(claudeProjects);
    const map = Object.fromEntries(dirs.map((d) => [d.path, d.lastUsedAt]));
    expect(map['/Users/x/a']).toBe(1000 * 1000);
    expect(map['/Users/x/b']).toBe(2000 * 1000);
  });
});

describe('recentDirectories', () => {
  it('merges launch history + claude dirs, dedupes, sorts desc, limits', () => {
    project('p1', '/Users/x/a', 1000);
    const recent = recentDirectories({
      launchHistory: [{ path: '/Users/x/b', lastLaunchedAt: 5_000_000, count: 1 }],
      claudeProjectsDir: claudeProjects,
      limit: 10,
    });
    expect(recent.map((r) => r.path)).toEqual(['/Users/x/b', '/Users/x/a']);
    expect(recent.find((r) => r.path === '/Users/x/b')!.source).toBe('launch');
  });

  it('launch history wins on dedupe when newer', () => {
    project('p1', '/Users/x/a', 1000);
    const recent = recentDirectories({
      launchHistory: [{ path: '/Users/x/a', lastLaunchedAt: 9_000_000, count: 3 }],
      claudeProjectsDir: claudeProjects,
    });
    expect(recent).toHaveLength(1);
    expect(recent[0]!.source).toBe('launch');
  });
});
