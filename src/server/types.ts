export type SessionStatus = 'running' | 'ended';

export interface Session {
  id: string;
  name: string;
  dir: string;
  tmuxName: string;
  startedAt: number;
  status: SessionStatus;
  claudeUrl?: string;
}

export interface LaunchHistoryEntry {
  path: string;
  lastLaunchedAt: number;
  count: number;
}

export interface AppConfig {
  token: string;
  port: number;
  host: string;
  baseCommand: string;
  launchHistory: LaunchHistoryEntry[];
}
