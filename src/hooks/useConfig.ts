import useSWR from 'swr';
import { useMemoizedFn } from 'ahooks';
import { toast } from 'sonner';
import { getConfig, updateConfig, setLogLevel } from '@/services/cmds';
import { setLogLevelFilter } from '@/services/cmds';
import { type Config } from '@/schemas/config';

export function useConfig() {
  const { data: config, mutate } = useSWR<Config>('config', getConfig, {
    revalidateOnFocus: false,
  });

  const patchConfig = useMemoizedFn(async (updater: (draft: Config) => void) => {
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
      toast.error('配置同步失败，已回滚');
    });
  });

  const updateLogLevel = useMemoizedFn((level: Config['log_level']) => {
    patchConfig((c) => {
      c.log_level = level;
    });
    setLogLevel(level);
    setLogLevelFilter(level);
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
    document.documentElement.classList.toggle('dark', mode === 'dark');
  });

  const updateShell = useMemoizedFn((shell: Config['shell']) => {
    patchConfig((c) => {
      c.shell = shell;
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
    updateMcp,
  };
}
