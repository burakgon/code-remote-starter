import { useEffect, useState } from 'react';

/** Force a re-render on an interval, so relative timestamps stay fresh. */
export function useTick(intervalMs: number): void {
  const [, setN] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setN((n) => n + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
}
