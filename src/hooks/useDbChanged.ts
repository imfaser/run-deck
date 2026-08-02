import { useEffect } from 'react';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useSWRConfig } from 'swr';
import { logMessage } from '@/services/cmds';
import { LABELS_KEY } from './useLabels';
import { TASKS_KEY } from './useTasks';

export const DB_CHANGED_EVENT = 'run-deck://db-changed';

const SLICE_SUMMARIES_PREFIX = 'slice-summaries';
const SLICE_ANNOTATIONS_PREFIX = 'slice-annotations';

/** 命中 labels / slice-summaries / slice-annotations / tasks 前缀的 SWR key */
function isRevalidatableKey(key: unknown): boolean {
  return (
    key === LABELS_KEY ||
    key === TASKS_KEY ||
    key === 'current-volume' ||
    (Array.isArray(key) && String(key[0]) === SLICE_SUMMARIES_PREFIX) ||
    (Array.isArray(key) && String(key[0]) === SLICE_ANNOTATIONS_PREFIX)
  );
}

/** 命中时打印调试日志，返回是否命中 */
function debugMatcher(key: unknown): boolean {
  if (isRevalidatableKey(key)) {
    logMessage('debug', `[db] db-changed revalidating key=${String(key)}`).catch(() => {});
  }
  return isRevalidatableKey(key);
}

/**
 * 监听全局 `run-deck://db-changed` 事件并定向重验证 SWR 缓存。
 * 主窗口：labels + slice-summaries + slice-annotations 前缀；标签窗口：labels。
 */
export function useDbChanged() {
  const { mutate } = useSWRConfig();

  useEffect(() => {
    let unlisten: UnlistenFn | undefined;
    let cancelled = false;

    listen(DB_CHANGED_EVENT, () => {
      logMessage('debug', `[db] db-changed received in ${getCurrentWindow().label}`).catch(
        () => {}
      );
      mutate(debugMatcher, undefined, { revalidate: true }).catch(() => {
        // 静默：重验证失败由各 hook 的 onError 兜底
      });
    })
      .then((fn) => {
        if (cancelled) {
          fn();
        } else {
          unlisten = fn;
        }
      })
      .catch((e) => {
        logMessage('error', `[db] listen db-changed failed: ${e}`).catch(() => {});
      });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [mutate]);
}
