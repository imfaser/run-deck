import { useRef, type ReactNode } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { match } from 'ts-pattern';
import { Badge } from '@/components/ui/badge';
import { LABELS } from '@/constants/labels';
import { cn } from '@/lib/utils';
import { collectHighlightRanges } from '@/lib/logHighlight';
import type { LogEntry } from '@/services/cmds';

const ROW_HEIGHT = 24;

const levelBadgeClass = (level: string) =>
  match(level)
    .with('error', () => 'bg-destructive/10 text-destructive border-destructive/30')
    .with(
      'warn',
      () => 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30 dark:text-yellow-400'
    )
    .with('info', () => 'bg-primary/10 text-primary border-primary/30')
    .with('debug', 'trace', () => 'bg-muted text-muted-foreground border-border')
    .otherwise(() => 'bg-muted text-muted-foreground border-border');

interface LogVirtualListProps {
  entries: LogEntry[];
  terms: RegExp[];
}

export function LogVirtualList({ entries, terms }: LogVirtualListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: entries.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 20,
  });

  const virtualItems = virtualizer.getVirtualItems();

  if (entries.length === 0) {
    return <p className="p-3 text-muted-foreground">{LABELS.logViewer.empty}</p>;
  }

  return (
    <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto font-mono text-xs">
      <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
        {virtualItems.map((item) => {
          const entry = entries[item.index];
          return (
            <div
              key={item.key}
              className="absolute left-0 flex w-full items-center gap-2 px-2"
              style={{
                height: ROW_HEIGHT,
                transform: `translateY(${item.start}px)`,
              }}
            >
              <Badge
                variant="outline"
                className={cn(
                  'w-12 shrink-0 justify-center text-[10px] uppercase',
                  levelBadgeClass(entry.level)
                )}
              >
                {entry.level}
              </Badge>
              <span className="shrink-0 text-muted-foreground">{entry.ts}</span>
              <span className="truncate">
                <Highlight text={entry.message} terms={terms} />
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** 把命中的搜索词用 <mark> 包起来渲染 */
function Highlight({ text, terms }: { text: string; terms: RegExp[] }) {
  const merged = collectHighlightRanges(text, terms);
  if (merged.length === 0) {
    return text;
  }
  const nodes: ReactNode[] = [];
  let cursor = 0;
  for (const r of merged) {
    if (r.start > cursor) {
      nodes.push(text.slice(cursor, r.start));
    }
    nodes.push(
      <mark key={r.start} className="rounded-sm bg-yellow-300/40 text-inherit">
        {text.slice(r.start, r.end)}
      </mark>
    );
    cursor = r.end;
  }
  if (cursor < text.length) {
    nodes.push(text.slice(cursor));
  }
  return nodes;
}
