import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, wsUrl } from './api.ts';
import type { Session } from './types.ts';

interface SessionsMessage {
  type: 'sessions';
  sessions: Session[];
}

/** Sessions with a live WebSocket feed, seeded by an initial fetch. */
export function useSessions(): { sessions: Session[]; isLoading: boolean; connected: boolean } {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ['sessions'], queryFn: api.listSessions });
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let closed = false;
    let socket: WebSocket | null = null;
    let retry: ReturnType<typeof setTimeout> | undefined;

    const connect = () => {
      socket = new WebSocket(wsUrl());
      socket.onopen = () => setConnected(true);
      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data as string) as SessionsMessage;
          if (data.type === 'sessions') {
            qc.setQueryData(['sessions'], { sessions: data.sessions });
          }
        } catch {
          // ignore malformed frame
        }
      };
      socket.onclose = () => {
        setConnected(false);
        if (!closed) retry = setTimeout(connect, 1500);
      };
      socket.onerror = () => socket?.close();
    };

    connect();
    return () => {
      closed = true;
      if (retry) clearTimeout(retry);
      socket?.close();
    };
  }, [qc]);

  return { sessions: query.data?.sessions ?? [], isLoading: query.isLoading, connected };
}
