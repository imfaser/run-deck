import useSWR from 'swr';
import { useMemoizedFn, useLockFn } from 'ahooks';
import { toast } from 'sonner';
import { getConfig, updateConfig, setLogLevel } from '@/services/cmds';
import { type Config } from '@/schemas/config';
import { LABELS } from '@/constants/labels';

export function useConfig() {
  const { data: config, mutate } = useSWR<Config>('config', getConfig, {
    revalidateOnFocus: false,
    revalidateOnMount: false,
  });

  const patchConfig = useLockFn(async (updater: (draft: Config) => void) => {
    if (!config) {
      return;
    }

    const newConfig = structuredClone(config);
    updater(newConfig);

    await mutate(
      updateConfig(newConfig).then(() => newConfig),
      {
        optimisticData: newConfig,
        rollbackOnError: true,
        populateCache: true,
        revalidate: false,
      }
    ).catch(() => {
      toast.error(LABELS.validation.configSyncFailed);
    });
  });

  const updateLogLevel = useMemoizedFn((level: Config['log_level']) => {
    patchConfig((c) => {
      c.log_level = level;
    });
    setLogLevel(level);
  });

  const updateHome = useMemoizedFn((home: Config['frontend']['home']) => {
    patchConfig((c) => {
      c.frontend.home = home;
    });
  });

  const updateMode = useMemoizedFn((mode: Config['frontend']['mode']) => {
    patchConfig((c) => {
      c.frontend.mode = mode;
    });
  });

  const updateShell = useMemoizedFn((shell: Config['shell']) => {
    patchConfig((c) => {
      c.shell = shell;
    });
  });

  const updateLogMaxSizeMb = useMemoizedFn((value: number) => {
    patchConfig((c) => {
      c.log_max_size_mb = value;
    });
  });

  const updateLogKeepFiles = useMemoizedFn((value: number) => {
    patchConfig((c) => {
      c.log_keep_files = value;
    });
  });

  const updateLogRetentionDays = useMemoizedFn((value: number) => {
    patchConfig((c) => {
      c.log_retention_days = value;
    });
  });

  const updateMcp = useMemoizedFn((mcp: Config['mcp']) => {
    patchConfig((c) => {
      c.mcp = mcp;
    });
  });

  return {
    config,
    updateLogLevel,
    updateHome,
    updateMode,
    updateShell,
    updateLogMaxSizeMb,
    updateLogKeepFiles,
    updateLogRetentionDays,
    updateMcp,
  };
}
