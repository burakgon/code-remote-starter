import { randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { AppConfig } from './types.ts';

export function getConfigDir(): string {
  return process.env.CRS_CONFIG_DIR ?? join(homedir(), '.config', 'code-remote-starter');
}

export function generateToken(): string {
  return randomBytes(32).toString('hex');
}

function defaultConfig(): AppConfig {
  return {
    token: generateToken(),
    port: 4317,
    host: '0.0.0.0',
    baseCommand:
      'CLAUDE_CODE_EFFORT_LEVEL=max claude remote-control --permission-mode bypassPermissions',
    launchHistory: [],
  };
}

export function loadConfig(dir: string = getConfigDir()): AppConfig {
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const file = join(dir, 'config.json');
  if (!existsSync(file)) {
    const cfg = defaultConfig();
    saveConfig(cfg, dir);
    return cfg;
  }
  const loaded = JSON.parse(readFileSync(file, 'utf8')) as Partial<AppConfig>;
  return { ...defaultConfig(), ...loaded, token: loaded.token ?? generateToken() };
}

export function saveConfig(config: AppConfig, dir: string = getConfigDir()): void {
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  writeFileSync(join(dir, 'config.json'), JSON.stringify(config, null, 2), { mode: 0o600 });
}

/** Record (or bump) a launched directory in the history. Mutates and returns config. */
export function recordLaunch(config: AppConfig, path: string, now: number = Date.now()): AppConfig {
  const existing = config.launchHistory.find((e) => e.path === path);
  if (existing) {
    existing.lastLaunchedAt = now;
    existing.count += 1;
  } else {
    config.launchHistory.push({ path, lastLaunchedAt: now, count: 1 });
  }
  config.launchHistory.sort((a, b) => b.lastLaunchedAt - a.lastLaunchedAt);
  config.launchHistory = config.launchHistory.slice(0, 50);
  return config;
}
