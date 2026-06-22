export type SessionStatus = 'running' | 'ended';

export interface Session {
  id: string;
  name: string;
  dir: string;
  tmuxName: string;
  startedAt: number;
  status: SessionStatus;
}

export interface DirEntry {
  name: string;
  path: string;
  isGitRepo: boolean;
  usedWithClaude: boolean;
  hidden: boolean;
}

export interface DirListing {
  path: string;
  parent: string | null;
  entries: DirEntry[];
}

export interface Bookmark {
  id: string;
  path: string;
  label: string;
  order: number;
  addedAt: number;
}

export interface RecentDir {
  path: string;
  lastUsedAt: number;
  source: 'launch' | 'claude';
}

export interface Meta {
  baseCommand: string;
  home: string;
}
