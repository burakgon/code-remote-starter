import { existsSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

export interface DirEntry {
  name: string;
  path: string;
  isGitRepo: boolean;
  usedWithClaude: boolean;
  childDirCount: number;
  hidden: boolean;
}

export interface DirListing {
  path: string;
  parent: string | null;
  entries: DirEntry[];
}

/** Encode an absolute path the way Claude Code names its project directories. */
export function claudeEncode(path: string): string {
  return path.replace(/\//g, '-');
}

/** Expand a leading ~ and resolve to an absolute path. Empty input -> home. */
export function resolvePath(input: string): string {
  let p = input.trim();
  if (p === '~' || p.startsWith('~/')) p = join(homedir(), p.slice(1));
  if (!p) p = homedir();
  return resolve(p);
}

function safeIsDir(p: string): boolean {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function countChildDirs(dir: string): number {
  try {
    let n = 0;
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) n++;
      else if (e.isSymbolicLink() && safeIsDir(join(dir, e.name))) n++;
    }
    return n;
  } catch {
    return 0;
  }
}

export function listDirectory(
  inputPath: string,
  opts: { claudeProjectsDir?: string } = {},
): DirListing {
  const path = resolvePath(inputPath);
  const claudeProjectsDir = opts.claudeProjectsDir ?? join(homedir(), '.claude', 'projects');
  const dirents = readdirSync(path, { withFileTypes: true }); // throws if unreadable
  const entries: DirEntry[] = [];
  for (const d of dirents) {
    const full = join(path, d.name);
    const isDir = d.isDirectory() || (d.isSymbolicLink() && safeIsDir(full));
    if (!isDir) continue;
    entries.push({
      name: d.name,
      path: full,
      isGitRepo: existsSync(join(full, '.git')),
      usedWithClaude: existsSync(join(claudeProjectsDir, claudeEncode(full))),
      childDirCount: countChildDirs(full),
      hidden: d.name.startsWith('.'),
    });
  }
  entries.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
  const parent = path === dirname(path) ? null : dirname(path);
  return { path, parent, entries };
}
