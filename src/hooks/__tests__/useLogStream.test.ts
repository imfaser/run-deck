import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useLogStream, LOG_LINE_EVENT } from '@/hooks/useLogStream';
import { useLogStreamStore, LOG_RETENTION_CAP } from '@/store/logs';
import { getLatestLogs, setLogEmit } from '@/services/cmds';
import { listen } from '@tauri-apps/api/event';

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(),
}));

vi.mock('@/services/cmds', () => ({
  getLatestLogs: vi.fn(),
  setLogEmit: vi.fn(),
  logMessage: vi.fn().mockResolvedValue(undefined),
}));

const mk = (ms: number, message?: string) => ({
  ts: `2026-08-02 13:42:20.${String(ms).padStart(3, '0')}`,
  level: 'info',
  message: message ?? `msg ${ms}`,
});

let emit: ((payload: unknown) => void) | undefined;
let unlisten: ReturnType<typeof vi.fn>;

beforeEach(() => {
  emit = undefined;
  unlisten = vi.fn();
  vi.mocked(listen).mockImplementation(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((_event: string, handler: (e: any) => void) => {
      emit = (payload) => handler({ payload });
      return Promise.resolve(unlisten);
    }) as never
  );
  vi.mocked(getLatestLogs).mockResolvedValue([]);
  vi.mocked(setLogEmit).mockResolvedValue(undefined);
  useLogStreamStore.setState({ entries: [], paused: false });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('useLogStream', () => {
  it('enables emit and loads history on mount, disables on unmount', async () => {
    const { unmount } = renderHook(() => useLogStream());

    await waitFor(() => expect(setLogEmit).toHaveBeenCalledWith(true));
    expect(getLatestLogs).toHaveBeenCalled();
    expect(listen).toHaveBeenCalledWith(LOG_LINE_EVENT, expect.any(Function));

    unmount();
    await waitFor(() => expect(setLogEmit).toHaveBeenCalledWith(false));
    expect(unlisten).toHaveBeenCalled();
  });

  it('merges history first then realtime events', async () => {
    vi.mocked(getLatestLogs).mockResolvedValue([mk(100), mk(200)]);
    renderHook(() => useLogStream());

    await waitFor(() => expect(useLogStreamStore.getState().entries).toEqual([mk(100), mk(200)]));

    act(() => {
      emit?.(mk(300));
    });
    await vi.waitFor(() =>
      expect(useLogStreamStore.getState().entries).toEqual([mk(100), mk(200), mk(300)])
    );
  });

  it('does not flush realtime events buffered before history is ready, and dedups overlap', async () => {
    let resolveHistory!: (v: ReturnType<typeof mk>[]) => void;
    vi.mocked(getLatestLogs).mockReturnValue(
      new Promise((resolve) => {
        resolveHistory = resolve;
      })
    );
    renderHook(() => useLogStream());

    act(() => {
      emit?.(mk(100));
    });

    act(() => {
      resolveHistory([mk(100), mk(200)]);
    });

    await waitFor(() => expect(useLogStreamStore.getState().entries).toEqual([mk(100), mk(200)]));
  });

  it('appends realtime after history ready without dedup within realtime', async () => {
    vi.mocked(getLatestLogs).mockResolvedValue([mk(100)]);
    renderHook(() => useLogStream());
    await waitFor(() => expect(useLogStreamStore.getState().entries).toEqual([mk(100)]));

    act(() => {
      emit?.(mk(100));
      emit?.(mk(200));
    });
    await waitFor(() =>
      expect(useLogStreamStore.getState().entries).toEqual([mk(100), mk(100), mk(200)])
    );
  });

  it('respects retention cap', async () => {
    vi.mocked(getLatestLogs).mockResolvedValue(
      Array.from({ length: LOG_RETENTION_CAP }, (_, i) => mk(i))
    );
    renderHook(() => useLogStream());
    await waitFor(() =>
      expect(useLogStreamStore.getState().entries).toHaveLength(LOG_RETENTION_CAP)
    );

    act(() => {
      emit?.(mk(LOG_RETENTION_CAP));
    });
    await waitFor(() =>
      expect(useLogStreamStore.getState().entries).toHaveLength(LOG_RETENTION_CAP)
    );
    expect(
      useLogStreamStore.getState().entries[useLogStreamStore.getState().entries.length - 1].message
    ).toBe(`msg ${LOG_RETENTION_CAP}`);
  });

  it('streams realtime only when not paused', async () => {
    vi.mocked(getLatestLogs).mockResolvedValue([]);
    renderHook(() => useLogStream());
    await waitFor(() => expect(useLogStreamStore.getState().paused).toBe(false));

    act(() => {
      useLogStreamStore.getState().setPaused(true);
    });

    act(() => {
      emit?.(mk(100));
    });
    await vi.waitFor(() => {
      // 暂停时事件仍被缓冲但不 flush，store 为空
      expect(useLogStreamStore.getState().entries).toEqual([]);
    });

    act(() => {
      useLogStreamStore.getState().setPaused(false);
    });
    await waitFor(() => expect(useLogStreamStore.getState().entries).toEqual([mk(100)]));
  });
});
