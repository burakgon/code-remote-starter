import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Clock, FolderPlus, Star, Trash2, X } from 'lucide-react';
import { api, errorMessage } from '../lib/api.ts';
import { basename, relativeTime, tildePath } from '../lib/format.ts';
import { useToast } from '../lib/toast.tsx';
import { Sheet } from './Sheet.tsx';
import { Tabs } from './Tabs.tsx';
import { Breadcrumb } from './Breadcrumb.tsx';
import { FilterInput } from './FilterInput.tsx';
import { FolderRow } from './FolderRow.tsx';

type Tab = 'browse' | 'bookmarks' | 'recent';

export function Picker({
  onClose,
  onChoose,
}: {
  onClose: () => void;
  onChoose: (dir: string) => void;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const meta = useQuery({ queryKey: ['meta'], queryFn: api.meta });
  const home = meta.data?.home;

  const [tab, setTab] = useState<Tab>('browse');
  const [path, setPath] = useState('~');
  const [filter, setFilter] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [folderName, setFolderName] = useState('');

  const listing = useQuery({ queryKey: ['fs', path], queryFn: () => api.listDir(path) });
  const bookmarks = useQuery({ queryKey: ['bookmarks'], queryFn: api.listBookmarks });
  const recent = useQuery({ queryKey: ['recent'], queryFn: api.listRecent });

  const currentDir = listing.data?.path ?? null;
  const target = selected ?? currentDir;

  const navigate = (p: string) => {
    setSelected(null);
    setFilter('');
    setCreatingFolder(false);
    setPath(p);
  };

  const createFolder = async () => {
    const name = folderName.trim();
    if (!name || !currentDir) return;
    try {
      await api.mkdir(currentDir, name);
      setFolderName('');
      setCreatingFolder(false);
      qc.invalidateQueries({ queryKey: ['fs', path] });
    } catch (err) {
      toast({ message: errorMessage(err), tone: 'error' });
    }
  };

  const entries = (listing.data?.entries ?? []).filter((e) =>
    filter ? e.name.toLowerCase().includes(filter.toLowerCase()) : !e.hidden,
  );

  const bookmarked = bookmarks.data?.bookmarks.find((b) => b.path === target);

  const toggleBookmark = async () => {
    if (!target) return;
    try {
      if (bookmarked) await api.removeBookmark(bookmarked.id);
      else await api.addBookmark(target);
      qc.invalidateQueries({ queryKey: ['bookmarks'] });
    } catch (err) {
      toast({ message: errorMessage(err), tone: 'error' });
    }
  };

  const removeBookmark = async (id: string) => {
    try {
      await api.removeBookmark(id);
      qc.invalidateQueries({ queryKey: ['bookmarks'] });
    } catch (err) {
      toast({ message: errorMessage(err), tone: 'error' });
    }
  };

  return (
    <Sheet onClose={onClose} ariaLabel="Choose a directory" full>
      <div className="flex items-center justify-between px-4 pb-3 pt-4">
        <span className="text-[14px] font-semibold">Choose a directory</span>
        <button
          type="button"
          onClick={onClose}
          className="text-[13px] text-dim transition-colors hover:text-fg"
        >
          Close
        </button>
      </div>

      <div className="px-3 pb-3">
        <Tabs
          active={tab}
          onChange={setTab}
          tabs={[
            { id: 'browse', label: 'Browse' },
            { id: 'bookmarks', label: 'Bookmarks' },
            { id: 'recent', label: 'Recent' },
          ]}
        />
      </div>

      {tab === 'browse' && (
        <>
          <div className="flex flex-col gap-3 px-4 pb-3">
            {(currentDir ?? path) && (
              <Breadcrumb
                path={currentDir ?? path}
                home={home}
                parent={listing.data?.parent ?? null}
                onNavigate={navigate}
              />
            )}
            <FilterInput value={filter} onChange={setFilter} onSubmitPath={navigate} />
            {creatingFolder ? (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  value={folderName}
                  onChange={(e) => setFolderName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void createFolder();
                    if (e.key === 'Escape') {
                      setCreatingFolder(false);
                      setFolderName('');
                    }
                  }}
                  placeholder="New folder name"
                  autoCapitalize="off"
                  spellCheck={false}
                  className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-[12.5px] outline-none focus:border-accent"
                />
                <button
                  type="button"
                  aria-label="Create folder"
                  onClick={() => void createFolder()}
                  className="grid size-9 shrink-0 place-items-center rounded-lg border border-accent/40 text-accent"
                >
                  <Check size={15} />
                </button>
                <button
                  type="button"
                  aria-label="Cancel new folder"
                  onClick={() => {
                    setCreatingFolder(false);
                    setFolderName('');
                  }}
                  className="grid size-9 shrink-0 place-items-center rounded-lg border border-line text-dim transition-colors hover:text-fg"
                >
                  <X size={15} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setCreatingFolder(true)}
                className="flex items-center gap-1.5 self-start text-[11px] font-medium text-dim transition-colors hover:text-fg"
              >
                <FolderPlus size={13} /> New folder
              </button>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-2.5 pb-3">
            {listing.isError ? (
              <p className="px-2 py-6 text-center text-[12.5px] text-dim">
                {errorMessage(listing.error)}
              </p>
            ) : entries.length === 0 ? (
              <p className="px-2 py-6 text-center text-[12.5px] text-dim">
                {listing.isLoading ? 'Loading…' : 'No subfolders here.'}
              </p>
            ) : (
              <div className="flex flex-col gap-0.5">
                {entries.map((e) => (
                  <FolderRow
                    key={e.path}
                    entry={e}
                    selected={selected === e.path}
                    onSelect={() => setSelected((s) => (s === e.path ? null : e.path))}
                    onOpen={() => navigate(e.path)}
                  />
                ))}
              </div>
            )}
          </div>

          {target && (
            <div className="flex items-center gap-2.5 border-t border-line-soft px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <button
                type="button"
                aria-label={bookmarked ? 'Remove bookmark' : 'Bookmark this folder'}
                onClick={toggleBookmark}
                className={`grid size-10 shrink-0 place-items-center rounded-xl border transition-colors ${
                  bookmarked ? 'border-accent/40 text-accent' : 'border-line text-dim hover:text-fg'
                }`}
              >
                <Star size={16} fill={bookmarked ? 'currentColor' : 'none'} />
              </button>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-[8px] uppercase tracking-[0.07em] text-faint">Selected</span>
                <span className="truncate font-mono text-[10.5px] text-muted">
                  {tildePath(target, home)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => onChoose(target)}
                className="accent-gradient shrink-0 rounded-xl px-5 py-2.5 text-[13px] font-bold text-[#1a0f0a]"
              >
                Use
              </button>
            </div>
          )}
        </>
      )}

      {tab === 'bookmarks' && (
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {(bookmarks.data?.bookmarks ?? []).length === 0 ? (
            <p className="px-2 py-8 text-center text-[12.5px] text-dim">
              No bookmarks yet. Star a folder while browsing.
            </p>
          ) : (
            <div className="flex flex-col gap-1">
              {bookmarks.data?.bookmarks.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center gap-2.5 rounded-xl border border-transparent px-2.5 py-2.5 transition-colors hover:bg-surface"
                >
                  <button
                    type="button"
                    onClick={() => onChoose(b.path)}
                    className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                  >
                    <Star size={14} className="shrink-0 text-accent" fill="currentColor" />
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-medium">{b.label}</span>
                      <span className="block truncate font-mono text-[10px] text-dim">
                        {tildePath(b.path, home)}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    aria-label="Remove bookmark"
                    onClick={() => removeBookmark(b.id)}
                    className="grid size-7 shrink-0 place-items-center rounded-md text-faint transition-colors hover:text-accent"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'recent' && (
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {(recent.data?.recent ?? []).length === 0 ? (
            <p className="px-2 py-8 text-center text-[12.5px] text-dim">
              No recent directories yet.
            </p>
          ) : (
            <div className="flex flex-col gap-1">
              {recent.data?.recent.map((r) => (
                <button
                  key={r.path}
                  type="button"
                  onClick={() => onChoose(r.path)}
                  className="flex items-center gap-2.5 rounded-xl border border-transparent px-2.5 py-2.5 text-left transition-colors hover:bg-surface"
                >
                  <Clock size={14} className="shrink-0 text-faint" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium">
                      {basename(r.path)}
                    </span>
                    <span className="block truncate font-mono text-[10px] text-dim">
                      {tildePath(r.path, home)}
                    </span>
                  </span>
                  <span className="shrink-0 font-mono text-[9.5px] text-faint">
                    {relativeTime(r.lastUsedAt)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </Sheet>
  );
}
