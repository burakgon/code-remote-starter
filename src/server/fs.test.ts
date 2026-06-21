import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { listDirectory, claudeEncode, resolvePath } from './fs.ts';

let root: string;
let claudeProjects: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'crs-fs-'));
  claudeProjects = mkdtempSync(join(tmpdir(), 'crs-claude-'));
  mkdirSync(join(root, 'proj-a', '.git'), { recursive: true });
  mkdirSync(join(root, 'proj-a', 'sub1'));
  mkdirSync(join(root, 'proj-a', 'sub2'));
  mkdirSync(join(root, 'proj-b'));
  mkdirSync(join(root, '.hidden'));
  writeFileSync(join(root, 'file.txt'), 'x');
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  rmSync(claudeProjects, { recursive: true, force: true });
});

describe('claudeEncode', () => {
  it('replaces slashes with dashes', () => {
    expect(claudeEncode('/Users/x/Developer/code-starter')).toBe('-Users-x-Developer-code-starter');
  });
});

describe('resolvePath', () => {
  it('expands ~', () => {
    expect(resolvePath('~')).toBe(homedir());
    expect(resolvePath('~/Developer')).toBe(join(homedir(), 'Developer'));
  });
});

describe('listDirectory', () => {
  it('returns only directories, sorted, with metadata', () => {
    const listing = listDirectory(root, { claudeProjectsDir: claudeProjects });
    const names = listing.entries.map((e) => e.name);
    expect(names).toEqual(['.hidden', 'proj-a', 'proj-b']);
    expect(names).not.toContain('file.txt');
    const a = listing.entries.find((e) => e.name === 'proj-a')!;
    expect(a.isGitRepo).toBe(true);
    expect(a.childDirCount).toBe(3); // .git, sub1, sub2
    expect(a.hidden).toBe(false);
    expect(listing.entries.find((e) => e.name === '.hidden')!.hidden).toBe(true);
    expect(listing.parent).toBe(dirname(root));
  });

  it('flags usedWithClaude when a matching project dir exists', () => {
    const full = join(root, 'proj-a');
    mkdirSync(join(claudeProjects, claudeEncode(full)));
    const listing = listDirectory(root, { claudeProjectsDir: claudeProjects });
    expect(listing.entries.find((e) => e.name === 'proj-a')!.usedWithClaude).toBe(true);
    expect(listing.entries.find((e) => e.name === 'proj-b')!.usedWithClaude).toBe(false);
  });

  it('throws on an unreadable path', () => {
    expect(() => listDirectory(join(root, 'does-not-exist'))).toThrow();
  });
});
