import { describe, expect, it, vi } from 'vitest';
import { StudentAuthRecovery } from './studentAuthRecovery';

describe('StudentAuthRecovery', () => {
  it('terminates on refresh 401/failure and blocks protected student calls', async () => {
    const runRefresh = vi.fn().mockResolvedValue(false);
    const clearLocalSession = vi.fn().mockResolvedValue(undefined);
    const onReauthRequired = vi.fn();

    const recovery = new StudentAuthRecovery({
      runRefresh,
      clearLocalSession,
      onReauthRequired,
    });

    await expect(recovery.refreshSingleFlight()).resolves.toBe(false);

    expect(recovery.isTerminated()).toBe(true);
    expect(recovery.shouldBlockRequest('/api/students/me/preferences')).toBe(true);

    await expect(recovery.refreshSingleFlight()).resolves.toBe(false);

    expect(runRefresh).toHaveBeenCalledTimes(1);
    expect(clearLocalSession).toHaveBeenCalledTimes(1);
    expect(onReauthRequired).toHaveBeenCalledTimes(1);
  });

  it('uses single-flight refresh for concurrent 401s', async () => {
    const runRefresh = vi.fn().mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 15));
      return true;
    });

    const recovery = new StudentAuthRecovery({
      runRefresh,
      clearLocalSession: vi.fn().mockResolvedValue(undefined),
      onReauthRequired: vi.fn(),
    });

    const attempts = await Promise.all([
      recovery.refreshSingleFlight(),
      recovery.refreshSingleFlight(),
      recovery.refreshSingleFlight(),
      recovery.refreshSingleFlight(),
      recovery.refreshSingleFlight(),
    ]);

    expect(attempts).toEqual([true, true, true, true, true]);
    expect(runRefresh).toHaveBeenCalledTimes(1);
  });
});
