import type { SessionManager } from './sessions.ts';
import type { Session } from './types.ts';

export interface WsClient {
  send(data: string): void;
  readyState: number;
}

const OPEN = 1;

export class SessionBroadcaster {
  private readonly clients = new Set<WsClient>();

  constructor(private readonly sessions: SessionManager) {
    this.sessions.onChange(() => this.broadcast());
  }

  add(client: WsClient): void {
    this.clients.add(client);
    this.sendTo(client, this.sessions.list());
  }

  remove(client: WsClient): void {
    this.clients.delete(client);
  }

  private broadcast(): void {
    const snapshot = this.sessions.list();
    for (const client of this.clients) this.sendTo(client, snapshot);
  }

  private sendTo(client: WsClient, sessions: Session[]): void {
    if (client.readyState !== OPEN) return;
    client.send(JSON.stringify({ type: 'sessions', sessions }));
  }
}
