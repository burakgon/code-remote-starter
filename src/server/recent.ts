import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { LaunchHistoryEntry } from './types.ts';

export interface RecentDir {
  path: string;
  lastUsedAt: number;
  source: 'launch' | 'claude';
}

/** Pull the first recorded cwd out of a session transcript (.jsonl). */
export function extractCwd(jsonlPath: string): string | null {
  try {
    const content = readFileSync(jsonlPath, 'utf8');
    const match = content.match(/"cwd":"((?:[^"\\]|\\.)*)"/);
    if (!match) return null;
    return JSON.parse(`"${match[1]}"`) as string;
  } catch {
    return null;
  }
}

/** Directories Claude has been used in, derived from transcript cwd + file mtime. */
export function claudeRecentDirs(claudeProjectsDir: string): RecentDir[] {
  if (!existsSync(claudeProjectsDir)) return [];
  const out: RecentDir[] = [];
  for (const entry of readdirSync(claudeProjectsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const dir = join(claudeProjectsDir, entry.name);
    let newest: { file: string; mtime: number } | null = null;
    try {
      for (const f of readdirSync(dir)) {
        if (!f.endsWith('.jsonl')) continue;
        const mtime = statSync(join(dir, f)).mtimeMs;
        if (!newest || mtime > newest.mtime) newest = { file: join(dir, f), mtime };
      }
    } catch {
      continue;
    }
    if (!newest) continue;
    const cwd = extractCwd(newest.file);
    if (cwd) out.push({ path: cwd, lastUsedAt: newest.mtime, source: 'claude' });
  }
  return out;
}

export function recentDirectories(opts: {
  launchHistory: LaunchHistoryEntry[];
  claudeProjectsDir?: string;
  limit?: number;
}): RecentDir[] {
  const claudeProjectsDir = opts.claudeProjectsDir ?? join(homedir(), '.claude', 'projects');
  const limit = opts.limit ?? 20;
  const byPath = new Map<string, RecentDir>();

  for (const r of claudeRecentDirs(claudeProjectsDir)) {
    const existing = byPath.get(r.path);
    if (!existing || r.lastUsedAt > existing.lastUsedAt) byPath.set(r.path, r);
  }
  for (const h of opts.launchHistory) {
    const r: RecentDir = { path: h.path, lastUsedAt: h.lastLaunchedAt, source: 'launch' };
    const existing = byPath.get(r.path);
    if (!existing || r.lastUsedAt >= existing.lastUsedAt) byPath.set(r.path, r);
  }

  return [...byPath.values()].sort((a, b) => b.lastUsedAt - a.lastUsedAt).slice(0, limit);
}
