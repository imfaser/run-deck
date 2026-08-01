import { useEffect } from 'react';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { useSWRConfig } from 'swr';
import { logMessage } from '@/services/cmds';
import { LABELS_KEY } from './useLabels';

export const DB_CHANGED_EVENT = 'run-deck://db-changed';

const SLICE_SUMMARIES_PREFIX = 'slice-summaries';

/**
 * 监听全局 `run-deck://db-changed` 事件并定向重验证 SWR 缓存。
 * 主窗口：labels + slice-summaries 前缀；标签窗口：labels。
 */
export function useDbChanged() {
  const { mutate } = useSWRConfig();

  useEffect(() => {
    let unlisten: UnlistenFn | undefined;
    let cancelled = false;

    listen(DB_CHANGED_EVENT, () => {
      mutate(
        (key) => {
          if (key === LABELS_KEY) {
            return true;
          }
          return Array.isArray(key) && String(key[0]) === SLICE_SUMMARIES_PREFIX;
        },
        undefined,
        { revalidate: true }
      ).catch(() => {
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
