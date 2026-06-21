import { describe, it, expect } from 'vitest';
import { LoginThrottle } from './throttle.ts';

describe('LoginThrottle', () => {
  it('locks after more than 5 failures within the window', () => {
    const th = new LoginThrottle({ now: () => 0 });
    for (let i = 0; i < 5; i++) {
      expect(th.recordFailure('1.2.3.4')).toBe(false);
    }
    expect(th.lockedFor('1.2.3.4')).toBe(0);
    expect(th.recordFailure('1.2.3.4')).toBe(true); // 6th attempt
    expect(th.lockedFor('1.2.3.4')).toBe(30 * 60 * 1000);
  });

  it('the lock expires after lockMs', () => {
    let t = 0;
    const th = new LoginThrottle({ now: () => t });
    for (let i = 0; i < 6; i++) th.recordFailure('1.2.3.4');
    expect(th.lockedFor('1.2.3.4')).toBeGreaterThan(0);
    t += 30 * 60 * 1000 + 1;
    expect(th.lockedFor('1.2.3.4')).toBe(0);
  });

  it('drops failures older than the 1h window', () => {
    let t = 0;
    const th = new LoginThrottle({ now: () => t });
    for (let i = 0; i < 5; i++) th.recordFailure('1.2.3.4');
    t += 60 * 60 * 1000 + 1; // an hour passes
    expect(th.recordFailure('1.2.3.4')).toBe(false); // the earlier five expired
  });

  it('tracks IPs independently', () => {
    const th = new LoginThrottle({ now: () => 0 });
    for (let i = 0; i < 6; i++) th.recordFailure('1.1.1.1');
    expect(th.lockedFor('1.1.1.1')).toBeGreaterThan(0);
    expect(th.lockedFor('2.2.2.2')).toBe(0);
  });

  it('success clears failures and the lock', () => {
    const th = new LoginThrottle({ now: () => 0 });
    for (let i = 0; i < 4; i++) th.recordFailure('1.2.3.4');
    th.recordSuccess('1.2.3.4');
    expect(th.recordFailure('1.2.3.4')).toBe(false); // counter reset
  });
});
