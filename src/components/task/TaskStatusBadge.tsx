import { Badge, type BadgeProps } from '@/components/ui/badge';
import { LABELS } from '@/constants/labels';
import type { TaskStatus } from '@/schemas/task';

const STATUS_KEY: Record<TaskStatus, keyof typeof LABELS.tasks.status> = {
  Pending: 'pending',
  Running: 'running',
  Done: 'done',
  Failed: 'failed',
  Cancelled: 'cancelled',
};

const STATUS_STYLE: Record<TaskStatus, { variant: BadgeProps['variant']; className?: string }> = {
  Pending: { variant: 'secondary' },
  Running: { variant: 'default' },
  Done: { variant: 'secondary', className: 'border-transparent bg-success text-white' },
  Failed: { variant: 'destructive' },
  Cancelled: { variant: 'outline' },
};

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const style = STATUS_STYLE[status];
  return (
    <Badge variant={style.variant} className={style.className}>
      {LABELS.tasks.status[STATUS_KEY[status]]}
    </Badge>
  );
}
