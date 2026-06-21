interface ThrottleOptions {
  maxFailures?: number;
  windowMs?: number;
  lockMs?: number;
  now?: () => number;
}

/**
 * Per-IP brute-force lock for the access token. More than `maxFailures` wrong
 * attempts within `windowMs` locks that IP for `lockMs`.
 */
export class LoginThrottle {
  private readonly failures = new Map<string, number[]>();
  private readonly lockedUntil = new Map<string, number>();
  private readonly maxFailures: number;
  private readonly windowMs: number;
  private readonly lockMs: number;
  private readonly now: () => number;

  constructor(opts: ThrottleOptions = {}) {
    this.maxFailures = opts.maxFailures ?? 5;
    this.windowMs = opts.windowMs ?? 60 * 60 * 1000; // 1 hour
    this.lockMs = opts.lockMs ?? 30 * 60 * 1000; // 30 minutes
    this.now = opts.now ?? (() => Date.now());
  }

  /** Remaining lock time for an IP in ms, or 0 if not locked. */
  lockedFor(ip: string): number {
    const until = this.lockedUntil.get(ip);
    if (until === undefined) return 0;
    const remaining = until - this.now();
    if (remaining <= 0) {
      this.lockedUntil.delete(ip);
      return 0;
    }
    return remaining;
  }

  /** Record a wrong-token attempt; returns true if the IP is now locked. */
  recordFailure(ip: string): boolean {
    const now = this.now();
    const recent = (this.failures.get(ip) ?? []).filter((t) => now - t < this.windowMs);
    recent.push(now);
    this.failures.set(ip, recent);
    if (recent.length > this.maxFailures) {
      this.lockedUntil.set(ip, now + this.lockMs);
      this.failures.delete(ip);
      return true;
    }
    return false;
  }

  /** Clear an IP's failures and lock after a successful auth. */
  recordSuccess(ip: string): void {
    this.failures.delete(ip);
    this.lockedUntil.delete(ip);
  }
}
