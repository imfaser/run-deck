import { useState } from 'react';
import { useMemoizedFn } from 'ahooks';
import { Pause, Play, Trash2, Download, Search, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useLogStream } from '@/hooks/useLogStream';
import { LogVirtualList } from './LogVirtualList';
import { LOG_RETENTION_CAP } from '@/store/logs';
import { buildTerms } from '@/lib/logHighlight';
import { LABELS } from '@/constants/labels';

const LEVEL_ORDER = ['error', 'warn', 'info', 'debug', 'trace'] as const;

interface LogViewerProps {
  onOpenLogDir?: () => void;
}

function matchesAll(
  entry: { message: string; ts: string; level: string },
  terms: RegExp[]
): boolean {
  if (terms.length === 0) {
    return true;
  }
  const haystack = `${entry.ts}\n${entry.level}\n${entry.message}`;
  return terms.every((re) => re.test(haystack));
}

export function LogViewer({ onOpenLogDir }: LogViewerProps) {
  const { entries, paused, setPaused, clear } = useLogStream();
  const [query, setQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState<string>('all');

  const terms = buildTerms(query);

  const filtered = entries.filter(
    (e) => (levelFilter === 'all' || e.level === levelFilter) && matchesAll(e, terms)
  );

  // 级别选项由数据动态推导（error→trace 顺序）
  const presentLevels = new Set(entries.map((e) => e.level));
  const levelOptions = LEVEL_ORDER.filter((l) => presentLevels.has(l));

  const handleExport = useMemoizedFn(async () => {
    try {
      const text = filtered.map((e) => `${e.ts} ${e.level.toUpperCase()} ${e.message}`).join('\n');
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `run-deck-logs-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.log`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(`${LABELS.logViewer.exportFailed}: ${e}`);
    }
  });

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col rounded-lg border border-border bg-background">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border p-2">
        <Search data-icon="inline-start" className="text-muted-foreground" />
        <Input
          className="h-7 w-56 text-xs"
          placeholder={LABELS.logViewer.searchPlaceholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <Select value={levelFilter} onValueChange={(v) => setLevelFilter(v ?? 'all')}>
          <SelectTrigger
            className="h-7 w-28 text-xs"
            size="sm"
            aria-label={LABELS.settings.logLevel}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="all">{LABELS.logViewer.levelAll}</SelectItem>
              {levelOptions.map((l) => (
                <SelectItem key={l} value={l}>
                  {LABELS.logLevel[l as keyof typeof LABELS.logLevel]}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        <div className="ml-auto flex items-center gap-1">
          <Button
            size="xs"
            variant="outline"
            onClick={() => setPaused(!paused)}
            title={paused ? LABELS.logViewer.resume : LABELS.logViewer.pause}
          >
            {paused ? <Play data-icon="inline-start" /> : <Pause data-icon="inline-start" />}
            {paused ? LABELS.logViewer.resume : LABELS.logViewer.pause}
          </Button>
          <Button size="xs" variant="outline" onClick={clear} title={LABELS.logViewer.clear}>
            <Trash2 data-icon="inline-start" />
            {LABELS.logViewer.clear}
          </Button>
          <Button
            size="xs"
            variant="outline"
            onClick={handleExport}
            title={LABELS.logViewer.export}
          >
            <Download data-icon="inline-start" />
            {LABELS.logViewer.export}
          </Button>
          {onOpenLogDir && (
            <Button size="xs" variant="outline" onClick={onOpenLogDir}>
              <FileText data-icon="inline-start" />
              {LABELS.settings.openLogsDir}
            </Button>
          )}
        </div>
      </div>

      <LogVirtualList entries={filtered} terms={terms} />

      <div className="shrink-0 border-t border-border px-2 py-1 text-[10px] text-muted-foreground">
        {filtered.length} / {entries.length} / {LOG_RETENTION_CAP}
      </div>
    </div>
  );
}
