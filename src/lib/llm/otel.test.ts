import { describe, it, expect, vi, beforeEach } from 'vitest';
import { startOtel, flushOtel, __resetStartedForTest } from './otel';

function makeSdkMock() {
  return {
    start: vi.fn(),
    shutdown: vi.fn().mockResolvedValue(undefined),
  };
}

describe('startOtel', () => {
  beforeEach(() => {
    __resetStartedForTest();
  });

  it('calls sdk.start() exactly once across N invocations (idempotence — Pitfall 6)', () => {
    const sdk = makeSdkMock();
    startOtel(sdk as never);
    startOtel(sdk as never);
    startOtel(sdk as never);
    expect(sdk.start).toHaveBeenCalledTimes(1);
  });

  it('calls sdk.start() on the first invocation', () => {
    const sdk = makeSdkMock();
    startOtel(sdk as never);
    expect(sdk.start).toHaveBeenCalledTimes(1);
  });

  it('does not call start again after a second call with a different mock', () => {
    const sdk1 = makeSdkMock();
    const sdk2 = makeSdkMock();
    startOtel(sdk1 as never);
    startOtel(sdk2 as never);
    expect(sdk1.start).toHaveBeenCalledTimes(1);
    expect(sdk2.start).toHaveBeenCalledTimes(0); // idempotent: second call is no-op
  });
});

describe('flushOtel', () => {
  it('awaits sdk.shutdown() (flushes pending spans before worker recycle — LLM-13 contract)', async () => {
    const sdk = makeSdkMock();
    await flushOtel(sdk as never);
    expect(sdk.shutdown).toHaveBeenCalledTimes(1);
  });

  it('resolves without error when shutdown resolves', async () => {
    const sdk = makeSdkMock();
    await expect(flushOtel(sdk as never)).resolves.toBeUndefined();
  });
});
