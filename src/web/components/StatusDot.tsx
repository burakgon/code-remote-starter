import type { SessionStatus } from '../lib/types.ts';

export function StatusDot({ status }: { status: SessionStatus }) {
  const color = status === 'running' ? 'var(--color-good)' : 'var(--color-faint)';
  return (
    <span
      className="inline-block size-[7px] shrink-0 rounded-full"
      style={{
        background: color,
        boxShadow:
          status === 'running'
            ? `0 0 0 3px color-mix(in oklab, ${color} 16%, transparent)`
            : 'none',
      }}
    />
  );
}
