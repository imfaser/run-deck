import { useEffect, useState } from 'react';
import { useMemoizedFn, useLockFn } from 'ahooks';
import { FolderOpen, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { openPath } from '@tauri-apps/plugin-opener';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useConfig } from '@/hooks/useConfig';
import { cleanupLogs, getLogDir } from '@/services/cmds';
import { LABELS } from '@/constants/labels';
import type { LogLevel } from '@/schemas/config';

const LOG_LEVEL_ITEMS: Record<LogLevel, string> = {
  error: LABELS.logLevel.error,
  warn: LABELS.logLevel.warn,
  info: LABELS.logLevel.info,
  debug: LABELS.logLevel.debug,
  trace: LABELS.logLevel.trace,
};

export default function LogSettings() {
  const { config, updateLogLevel, updateLogMaxSizeMb, updateLogKeepFiles, updateLogRetentionDays } =
    useConfig();
  const [maxSize, setMaxSize] = useState<string>('');
  const [keepFiles, setKeepFiles] = useState<string>('');
  const [retentionDays, setRetentionDays] = useState<string>('');

  useEffect(() => {
    setMaxSize(String(config?.log_max_size_mb ?? ''));
    setKeepFiles(String(config?.log_keep_files ?? ''));
    setRetentionDays(String(config?.log_retention_days ?? ''));
  }, [config?.log_max_size_mb, config?.log_keep_files, config?.log_retention_days]);

  const handleOpenDir = useMemoizedFn(async () => {
    try {
      const dir = await getLogDir();
      await openPath(dir);
    } catch (e) {
      toast.error(`${LABELS.settings.openDirFailed}: ${e}`);
    }
  });

  const handleCleanup = useLockFn(async () => {
    try {
      const n = await cleanupLogs();
      toast.success(LABELS.settings.cleanupDone(n));
    } catch (e) {
      toast.error(`${LABELS.settings.cleanupFailed}: ${e}`);
    }
  });

  const commitMaxSize = useMemoizedFn(() => {
    if (!config) {
      return;
    }
    const n = Number(maxSize);
    if (!Number.isNaN(n) && n > 0 && n !== config.log_max_size_mb) {
      updateLogMaxSizeMb(n);
    }
  });

  const commitKeepFiles = useMemoizedFn(() => {
    if (!config) {
      return;
    }
    const n = Number(keepFiles);
    if (!Number.isNaN(n) && n > 0 && n !== config.log_keep_files) {
      updateLogKeepFiles(n);
    }
  });

  const commitRetentionDays = useMemoizedFn(() => {
    if (!config) {
      return;
    }
    const n = Number(retentionDays);
    if (!Number.isNaN(n) && n > 0 && n !== config.log_retention_days) {
      updateLogRetentionDays(n);
    }
  });

  if (!config) {
    return null;
  }

  return (
    <Card className="shrink-0">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{LABELS.settings.logTitle}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">{LABELS.settings.logLevel}</span>
          <Select
            value={config.log_level}
            onValueChange={(v) => {
              if (v) {
                updateLogLevel(v as LogLevel);
              }
            }}
          >
            <SelectTrigger className="w-40" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>{LABELS.settings.logLevel}</SelectLabel>
                {Object.entries(LOG_LEVEL_ITEMS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">{LABELS.settings.logMaxSizeMb}</span>
          <Input
            className="h-7 w-28 text-xs"
            type="number"
            min={1}
            value={maxSize}
            onChange={(e) => setMaxSize(e.target.value)}
            onBlur={commitMaxSize}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                commitMaxSize();
              }
            }}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">{LABELS.settings.logKeepFiles}</span>
          <Input
            className="h-7 w-28 text-xs"
            type="number"
            min={1}
            value={keepFiles}
            onChange={(e) => setKeepFiles(e.target.value)}
            onBlur={commitKeepFiles}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                commitKeepFiles();
              }
            }}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">{LABELS.settings.logRetentionDays}</span>
          <Input
            className="h-7 w-28 text-xs"
            type="number"
            min={1}
            value={retentionDays}
            onChange={(e) => setRetentionDays(e.target.value)}
            onBlur={commitRetentionDays}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                commitRetentionDays();
              }
            }}
          />
        </label>

        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={handleOpenDir}>
            <FolderOpen data-icon="inline-start" />
            {LABELS.settings.openLogsDir}
          </Button>
          <Button size="sm" variant="outline" onClick={handleCleanup}>
            <Trash2 data-icon="inline-start" />
            {LABELS.settings.cleanupLogs}
          </Button>
        </div>
      </CardContent>
      <div className="px-6 pb-3 text-[10px] text-muted-foreground">
        {LABELS.settings.logRestartHint}
      </div>
    </Card>
  );
}
