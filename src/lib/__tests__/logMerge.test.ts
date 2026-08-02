import { describe, it, expect } from 'vitest';
import { mergeLogEntries } from '@/lib/logMerge';
import type { LogEntry } from '@/services/cmds';

function mk(ms: number, message?: string): LogEntry {
  return {
    ts: `2026-08-02 13:42:20.${String(ms).padStart(3, '0')}`,
    level: 'info',
    message: message ?? `msg ${ms}`,
  };
}

describe('mergeLogEntries', () => {
  it('returns history first, then realtime (chronological order)', () => {
    const history = [mk(100), mk(200)];
    const realtime = [mk(300), mk(400)];
    expect(mergeLogEntries(history, realtime, 100)).toEqual([mk(100), mk(200), mk(300), mk(400)]);
  });

  it('drops realtime entries duplicated in history (same ts+level+message)', () => {
    const history = [mk(100), mk(200)];
    const realtime = [mk(200), mk(300)];
    expect(mergeLogEntries(history, realtime, 100)).toEqual([mk(100), mk(200), mk(300)]);
  });

  it('keeps realtime entries that only differ in message even at same ts', () => {
    const history = [mk(100)];
    const realtime = [{ ts: mk(100).ts, level: 'info', message: 'different' }, mk(200)];
    expect(mergeLogEntries(history, realtime, 100)).toEqual([
      mk(100),
      { ts: mk(100).ts, level: 'info', message: 'different' },
      mk(200),
    ]);
  });

  it('respects retention cap keeping newest', () => {
    const history = [mk(100), mk(200), mk(300)];
    const realtime = [mk(400)];
    expect(mergeLogEntries(history, realtime, 3)).toEqual([mk(200), mk(300), mk(400)]);
  });

  it('truncates oversized history even without realtime', () => {
    const history = [mk(100), mk(200)];
    expect(mergeLogEntries(history, [], 1)).toEqual([mk(200)]);
  });

  it('keeps realtime internal order stable (no cross-dedup within realtime)', () => {
    const realtime = [mk(100), mk(100), mk(200)];
    expect(mergeLogEntries([], realtime, 100)).toEqual([mk(100), mk(100), mk(200)]);
  });

  it('returns empty for empty inputs', () => {
    expect(mergeLogEntries([], [], 100)).toEqual([]);
  });

  it('handles cap=0 returning empty', () => {
    expect(mergeLogEntries([mk(100)], [], 0)).toEqual([]);
    expect(mergeLogEntries([], [mk(100)], 0)).toEqual([]);
  });

  it('drops all realtime entries when all duplicated in history', () => {
    const history = [mk(100), mk(200)];
    const realtime = [mk(100), mk(200)];
    expect(mergeLogEntries(history, realtime, 100)).toEqual([mk(100), mk(200)]);
  });

  it('truncates exactly at cap boundary', () => {
    const history = [mk(100), mk(200)];
    const realtime = [mk(300)];
    expect(mergeLogEntries(history, realtime, 3)).toEqual([mk(100), mk(200), mk(300)]);
  });
});
