import { create } from 'zustand';
import type { LogEntry } from '@/services/cmds';

/** 前端保留的最大日志条数，超出丢弃最旧 */
export const LOG_RETENTION_CAP = 1000;

interface LogStreamState {
  entries: LogEntry[];
  paused: boolean;
  append: (entries: LogEntry[]) => void;
  setPaused: (paused: boolean) => void;
  clear: () => void;
}

export const useLogStreamStore = create<LogStreamState>((set) => ({
  entries: [],
  paused: false,
  append: (incoming) =>
    set((s) => {
      const merged = s.entries.concat(incoming);
      const entries = merged.length > LOG_RETENTION_CAP ? merged.slice(-LOG_RETENTION_CAP) : merged;
      return { entries };
    }),
  setPaused: (paused) => set({ paused }),
  clear: () => set({ entries: [] }),
}));
