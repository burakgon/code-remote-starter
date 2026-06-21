import { describe, it, expect } from 'vitest';
import { parseArgs, accessUrl } from './index.ts';

describe('parseArgs', () => {
  it('parses flags', () => {
    expect(parseArgs(['--port', '5000', '--host', '127.0.0.1', '--open'])).toEqual({
      port: 5000,
      host: '127.0.0.1',
      open: true,
    });
  });
  it('parses --command', () => {
    expect(parseArgs(['--command', 'claude --foo'])).toEqual({ command: 'claude --foo' });
  });
  it('returns empty object for no args', () => {
    expect(parseArgs([])).toEqual({});
  });
});

describe('accessUrl', () => {
  it('uses localhost when host is 0.0.0.0', () => {
    expect(accessUrl('0.0.0.0', 4317, 'tok')).toBe('http://localhost:4317/?token=tok');
  });
  it('uses the given host otherwise', () => {
    expect(accessUrl('192.168.1.5', 4317, 'tok')).toBe('http://192.168.1.5:4317/?token=tok');
  });
});
