import { Progress } from '@/components/ui/progress';
import { LABELS } from '@/constants/labels';

export function TaskProgress({
  current,
  total,
  visible,
}: {
  current: number;
  total: number;
  visible: boolean;
}) {
  if (!visible) {
    return null;
  }
  const percent = total > 0 ? Math.round((current / total) * 100) : 0;
  return (
    <div className="flex w-full max-w-40 items-center gap-2">
      <Progress value={percent} className="h-1.5" />
      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
        {LABELS.tasks.progress(current, total)}
      </span>
    </div>
  );
}
