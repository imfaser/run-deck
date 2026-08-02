import { useEffect } from 'react';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { useSWRConfig } from 'swr';
import { logMessage } from '@/services/cmds';

export const CONFIG_CHANGED_EVENT = 'run-deck://config-changed';

/**
 * 监听全局 `run-deck://config-changed` 事件，触发 SWR `config` 重验证（重新 getConfig 拉取）。
 * 事件不带 payload：Rust 是唯一 truth，各窗口自行拉取最新 config。
 */
export function useConfigChanged() {
  const { mutate } = useSWRConfig();

  useEffect(() => {
    let unlisten: UnlistenFn | undefined;
    let cancelled = false;

    listen(CONFIG_CHANGED_EVENT, () => {
      mutate('config').catch(() => {
        // 静默：重验证失败由 useConfig 的 onError 兜底
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
        logMessage('error', `[config] listen config-changed failed: ${e}`).catch(() => {});
      });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [mutate]);
}
