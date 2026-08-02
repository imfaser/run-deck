import { describe, it, expect, beforeEach } from 'vitest';
import { useLogStreamStore, LOG_RETENTION_CAP } from '@/store/logs';

function makeEntry(i: number) {
  return { ts: `2026-08-02 00:00:00.000`, level: 'info', message: `msg ${i}` };
}

beforeEach(() => {
  useLogStreamStore.setState({ entries: [], paused: false });
});

describe('logs store', () => {
  it('appends entries in order', () => {
    useLogStreamStore.getState().append([makeEntry(1), makeEntry(2)]);
    expect(useLogStreamStore.getState().entries).toEqual([makeEntry(1), makeEntry(2)]);
  });

  it('truncates to LOG_RETENTION_CAP keeping newest', () => {
    const bulk = Array.from({ length: LOG_RETENTION_CAP + 5 }, (_, i) => makeEntry(i));
    useLogStreamStore.getState().append(bulk);
    const entries = useLogStreamStore.getState().entries;
    expect(entries).toHaveLength(LOG_RETENTION_CAP);
    expect(entries[0].message).toBe(`msg ${5}`);
    expect(entries[entries.length - 1].message).toBe(`msg ${LOG_RETENTION_CAP + 4}`);
  });

  it('ignores empty append', () => {
    useLogStreamStore.getState().append([makeEntry(1)]);
    useLogStreamStore.getState().append([]);
    expect(useLogStreamStore.getState().entries).toHaveLength(1);
  });

  it('clear resets entries', () => {
    useLogStreamStore.getState().append([makeEntry(1)]);
    useLogStreamStore.getState().clear();
    expect(useLogStreamStore.getState().entries).toEqual([]);
  });

  it('setPaused toggles paused', () => {
    useLogStreamStore.getState().setPaused(true);
    expect(useLogStreamStore.getState().paused).toBe(true);
  });
});
