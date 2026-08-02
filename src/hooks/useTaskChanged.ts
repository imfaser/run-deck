import { useEffect } from 'react';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { useSWRConfig } from 'swr';
import { TASKS_KEY } from './useTasks';
import { logMessage } from '@/services/cmds';

export const TASK_CHANGED_EVENT = 'run-deck://task-changed';

/**
 * 监听 `run-deck://task-changed` 事件并重验证任务列表缓存。
 */
export function useTaskChanged() {
  const { mutate } = useSWRConfig();

  useEffect(() => {
    let unlisten: UnlistenFn | undefined;
    let cancelled = false;

    listen(TASK_CHANGED_EVENT, () => {
      logMessage('debug', `[task] task-changed received, revalidating ${TASKS_KEY}`).catch(
        () => {}
      );
      mutate(TASKS_KEY).catch(() => {
        // 静默：重验证失败由 hook 的 onError 兜底
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
        logMessage('error', `[task] listen task-changed failed: ${e}`).catch(() => {});
      });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [mutate]);
}
