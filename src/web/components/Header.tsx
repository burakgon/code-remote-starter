export function Header({ runningCount, connected }: { runningCount: number; connected: boolean }) {
  return (
    <header className="flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <div className="accent-gradient size-[22px] rounded-[7px]" />
        <span className="text-[15px] font-semibold tracking-[-0.01em]">Code Remote Starter</span>
      </div>
      <span
        className="flex items-center gap-1.5 font-mono text-[11px] tabular-nums text-dim"
        title={connected ? 'Live' : 'Reconnecting…'}
      >
        {!connected && <span className="size-1.5 rounded-full bg-warn" />}
        {runningCount} running
      </span>
    </header>
  );
}
