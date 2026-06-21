import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BookmarkStore } from './bookmarks.ts';

let dir: string;
let ids: string[];
function store() {
  ids = ['bk_1', 'bk_2', 'bk_3'];
  return new BookmarkStore({ dir, now: () => 1000, idFactory: () => ids.shift()! });
}
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'crs-bk-'));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('BookmarkStore', () => {
  it('adds with default label = basename and increasing order', () => {
    const s = store();
    const a = s.add({ path: '/Users/x/Developer/code-starter' });
    const b = s.add({ path: '/Users/x/Developer/remotedroid', label: 'Droid' });
    expect(a.label).toBe('code-starter');
    expect(b.label).toBe('Droid');
    expect(a.order).toBe(0);
    expect(b.order).toBe(1);
  });

  it('does not duplicate the same path', () => {
    const s = store();
    const a = s.add({ path: '/p/a' });
    const again = s.add({ path: '/p/a' });
    expect(again.id).toBe(a.id);
    expect(s.list()).toHaveLength(1);
  });

  it('persists across instances', () => {
    store().add({ path: '/p/a' });
    const fresh = new BookmarkStore({ dir });
    expect(fresh.list()).toHaveLength(1);
  });

  it('removes by id', () => {
    const s = store();
    const a = s.add({ path: '/p/a' });
    s.remove(a.id);
    expect(s.list()).toHaveLength(0);
  });

  it('reorders by id list', () => {
    const s = store();
    const a = s.add({ path: '/p/a' });
    const b = s.add({ path: '/p/b' });
    s.reorder([b.id, a.id]);
    expect(s.list().map((x) => x.path)).toEqual(['/p/b', '/p/a']);
  });
});
