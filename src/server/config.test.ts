import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, statSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig, saveConfig, generateToken } from './config.ts';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'crs-cfg-'));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('config', () => {
  it('generateToken returns 64 hex chars', () => {
    expect(generateToken()).toMatch(/^[0-9a-f]{64}$/);
  });

  it('loadConfig creates a default config with a token when none exists', () => {
    const cfg = loadConfig(dir);
    expect(cfg.token).toMatch(/^[0-9a-f]{64}$/);
    expect(cfg.port).toBe(4317);
    expect(cfg.host).toBe('0.0.0.0');
    expect(cfg.baseCommand).toBe('claude --dangerously-skip-permissions --effort max');
    expect(cfg.launchHistory).toEqual([]);
    expect(existsSync(join(dir, 'config.json'))).toBe(true);
  });

  it('writes config.json with 0600 permissions', () => {
    loadConfig(dir);
    const mode = statSync(join(dir, 'config.json')).mode & 0o777;
    expect(mode).toBe(0o600);
  });

  it('loadConfig returns the same token on a second call (persisted)', () => {
    const first = loadConfig(dir).token;
    const second = loadConfig(dir).token;
    expect(second).toBe(first);
  });

  it('saveConfig round-trips changes', () => {
    const cfg = loadConfig(dir);
    cfg.port = 5000;
    saveConfig(cfg, dir);
    expect(JSON.parse(readFileSync(join(dir, 'config.json'), 'utf8')).port).toBe(5000);
  });
});
