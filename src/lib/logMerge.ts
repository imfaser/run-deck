import type { LogEntry } from '@/services/cmds';

/** 去重键：ts + level + message。日志时间戳精确到毫秒，同毫秒同内容视为同一事件 */
const keyOf = (e: LogEntry) => `${e.ts}|${e.level}|${e.message}`;

/**
 * 合并历史与实时日志，保证历史在前、实时在后（时间正序）。
 * - 实时中与历史同键（ts+level+message 完全相同）的条目视为「历史与实时重叠」
 *   （同一毫秒被 emit 且被历史文件读取），丢弃，避免重复显示。
 * - 超出 cap 时截断保留最新。
 */
export function mergeLogEntries(
  history: LogEntry[],
  realtime: LogEntry[],
  cap: number
): LogEntry[] {
  const seen = new Set(history.map(keyOf));
  const uniqueRealtime = realtime.filter((e) => !seen.has(keyOf(e)));
  const merged = history.concat(uniqueRealtime);
  if (merged.length <= cap) {
    return merged;
  }
  return cap > 0 ? merged.slice(-cap) : [];
}
