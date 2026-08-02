import { useEffect, useRef } from 'react';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { useMemoizedFn, useThrottleFn, useUpdateEffect } from 'ahooks';
import { getLatestLogs, logMessage, setLogEmit, type LogEntry } from '@/services/cmds';
import { useLogStreamStore, LOG_RETENTION_CAP } from '@/store/logs';
import { mergeLogEntries } from '@/lib/logMerge';

export const LOG_LINE_EVENT = 'run-deck://log-line';

const THROTTLE_WAIT = 500;
const HISTORY_LIMIT = 500;

/**
 * 实时日志流：
 * - 挂载：setLogEmit(true) + listen + 加载历史。实时事件先缓冲（pendingRef），
 *   历史加载完成后「历史 + 缓冲实时」去重合并一次性 append，保证历史永远在前。
 * - 事件：累加器 → 500ms 节流 flush 到 store（上限 1000 条，丢最旧）
 * - 暂停：事件仍进累加器但不 flush，恢复时立即合并
 * - 卸载：setLogEmit(false) + unlisten（Rust 端停止 emit，日志继续写文件）
 *
 * StrictMode / 竞态防护：
 * - 生命周期合并为单个 useEffect，用 generation counter 判定过期：cleanup 后
 *   所有在途异步（listen 注册、历史加载）都视为过期丢弃，防止双 listener / 双历史。
 * - setLogEmit 是 fire-and-forget invoke，StrictMode setup→cleanup→setup 的三次
 *   调用可能乱序到达后端导致 emit 停在 false；用 promise 链串行化，最终状态为
 *   最后一次调用的值。
 */
export function useLogStream() {
  const append = useLogStreamStore((s) => s.append);
  const paused = useLogStreamStore((s) => s.paused);

  const pendingRef = useRef<LogEntry[]>([]);
  const unlistenRef = useRef<UnlistenFn | undefined>(undefined);
  const genRef = useRef(0);
  /** 历史就绪前实时事件一律缓冲，避免实时早于历史 */
  const historyReadyRef = useRef(false);
  /** 串行化 setLogEmit：按调用顺序到达后端，保证最终 emit 状态正确 */
  const emitChainRef = useRef<Promise<void>>(Promise.resolve());

  const { run, cancel } = useThrottleFn(
    () => {
      const state = useLogStreamStore.getState();
      if (!historyReadyRef.current || state.paused) {
        return;
      }
      if (pendingRef.current.length === 0) {
        return;
      }
      const batch = pendingRef.current;
      pendingRef.current = [];
      append(batch);
    },
    { wait: THROTTLE_WAIT }
  );

  // 恢复时立即合并暂停期间缓冲的日志（跳过首次渲染）
  const flushIfResumed = useMemoizedFn(() => {
    const state = useLogStreamStore.getState();
    if (historyReadyRef.current && !state.paused && pendingRef.current.length > 0) {
      run();
    }
  });
  useUpdateEffect(() => {
    flushIfResumed();
  }, [paused]);

  useEffect(() => {
    const gen = ++genRef.current;
    let disposed = false;
    historyReadyRef.current = false;

    const isStale = () => disposed || gen !== genRef.current;

    const queueSetLogEmit = (enabled: boolean) => {
      emitChainRef.current = emitChainRef.current.then(() => setLogEmit(enabled)).catch(() => {});
      return emitChainRef.current;
    };

    queueSetLogEmit(true);

    // 先注册监听再读历史：历史读取前窗口内的日志既能被缓冲（emit 事件）又能被
    // 历史读到，合并时去重；避免「读历史后、监听就绪前」的事件丢失。
    listen<LogEntry>(LOG_LINE_EVENT, (event) => {
      pendingRef.current.push(event.payload);
      if (pendingRef.current.length > LOG_RETENTION_CAP) {
        pendingRef.current.splice(0, pendingRef.current.length - LOG_RETENTION_CAP);
      }
      if (historyReadyRef.current) {
        run();
      }
    })
      .then((fn) => {
        if (isStale()) {
          fn();
        } else {
          unlistenRef.current = fn;
        }
      })
      .catch((e) => {
        logMessage('error', `[logs] listen log-line failed: ${e}`).catch(() => {});
      });

    getLatestLogs(HISTORY_LIMIT)
      .then((history) => {
        if (isStale()) {
          return;
        }
        const buffered = pendingRef.current;
        append(mergeLogEntries(history, buffered, LOG_RETENTION_CAP));
        pendingRef.current = [];
        historyReadyRef.current = true;
      })
      .catch((e) => {
        if (isStale()) {
          return;
        }
        logMessage('warn', `[logs] load history failed: ${e}`).catch(() => {});
        // 历史加载失败不阻塞实时流：清空缓冲放行
        pendingRef.current = [];
        historyReadyRef.current = true;
      });

    return () => {
      disposed = true;
      genRef.current += 1;
      unlistenRef.current?.();
      unlistenRef.current = undefined;
      cancel();
      queueSetLogEmit(false);
    };
  }, [append, cancel, run]);

  const setPaused = useMemoizedFn((next: boolean) => {
    useLogStreamStore.getState().setPaused(next);
  });

  const clear = useMemoizedFn(() => {
    useLogStreamStore.getState().clear();
  });

  return {
    entries: useLogStreamStore((s) => s.entries),
    paused: useLogStreamStore((s) => s.paused),
    setPaused,
    clear,
  };
}
