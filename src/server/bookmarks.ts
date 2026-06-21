import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';

export interface Bookmark {
  id: string;
  path: string;
  label: string;
  order: number;
  addedAt: number;
}

interface BookmarkStoreOptions {
  dir: string;
  now?: () => number;
  idFactory?: () => string;
}

export class BookmarkStore {
  private readonly file: string;
  private readonly now: () => number;
  private readonly idFactory: () => string;
  private items: Bookmark[];

  constructor(opts: BookmarkStoreOptions) {
    mkdirSync(opts.dir, { recursive: true, mode: 0o700 });
    this.file = join(opts.dir, 'bookmarks.json');
    this.now = opts.now ?? (() => Date.now());
    this.idFactory = opts.idFactory ?? (() => `bk_${randomBytes(6).toString('hex')}`);
    this.items = this.read();
  }

  private read(): Bookmark[] {
    if (!existsSync(this.file)) return [];
    try {
      return JSON.parse(readFileSync(this.file, 'utf8')) as Bookmark[];
    } catch {
      return [];
    }
  }

  private write(): void {
    writeFileSync(this.file, JSON.stringify(this.items, null, 2), { mode: 0o600 });
  }

  list(): Bookmark[] {
    return [...this.items].sort((a, b) => a.order - b.order);
  }

  add(input: { path: string; label?: string }): Bookmark {
    const existing = this.items.find((b) => b.path === input.path);
    if (existing) return existing;
    const order = this.items.reduce((m, b) => Math.max(m, b.order + 1), 0);
    const bookmark: Bookmark = {
      id: this.idFactory(),
      path: input.path,
      label: input.label?.trim() || basename(input.path) || input.path,
      order,
      addedAt: this.now(),
    };
    this.items.push(bookmark);
    this.write();
    return bookmark;
  }

  remove(id: string): void {
    this.items = this.items.filter((b) => b.id !== id);
    this.write();
  }

  reorder(ids: string[]): void {
    const index = new Map(ids.map((id, i) => [id, i] as const));
    for (const b of this.items) {
      const i = index.get(b.id);
      if (i !== undefined) b.order = i;
    }
    this.write();
  }
}
