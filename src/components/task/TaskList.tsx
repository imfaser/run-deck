import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Play, Pencil, Trash, Square, Plus } from 'lucide-react';
import { useLockFn } from 'ahooks';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { SortableList } from '@/components/ui/sortable-list';
import { TaskStatusBadge } from './TaskStatusBadge';
import { TaskProgress } from './TaskProgress';
import { taskDelete, taskReorder, taskRun, taskCancel, taskUpdate } from '@/services/tasks';
import { runningIdsFromTasks, useTaskStore } from '@/store/task';
import { logMessage } from '@/services/cmds';
import { LABELS } from '@/constants/labels';
import type { CurrentVolume, Task } from '@/schemas/task';

interface TaskListProps {
  tasks: Task[];
  currentVolume: CurrentVolume | null;
  onEdit: (task: Task) => void;
  onOpenForm: () => void;
}

export function TaskList({ tasks, currentVolume, onEdit, onOpenForm }: TaskListProps) {
  const [ordered, setOrdered] = useState<Task[]>(tasks);
  const [deleting, setDeleting] = useState<Task | null>(null);

  const runningIds = useTaskStore((s) => s.runningIds);
  const setRunningIds = useTaskStore((s) => s.setRunningIds);
  const anyRunning = runningIds.length > 0;

  useEffect(() => {
    setRunningIds(runningIdsFromTasks(tasks));
  }, [tasks, setRunningIds]);

  useEffect(() => {
    setOrdered(tasks);
  }, [tasks]);

  const handleReorder = useLockFn(async (next: Task[]) => {
    setOrdered(next);
    try {
      await taskReorder(next.map((t, i) => ({ id: t.id, order: i + 1 })));
    } catch (e) {
      await logMessage('error', `[task] reorder failed: ${e}`);
      toast.error(String(e));
    }
  });

  const handleRunAll = useLockFn(async () => {
    const candidates = tasks.filter((t) => t.enabled && t.status !== 'Running');
    const results = await Promise.allSettled(candidates.map((t) => taskRun(t.id)));
    const failures = results.filter((r) => r.status === 'rejected');
    await Promise.all(
      failures.map((r) => logMessage('error', `[task] run all failed: ${r.reason}`))
    );
    toast.success(LABELS.tasks.started(`${candidates.length} 个任务`));
  });

  const handleRun = useLockFn(async (task: Task) => {
    try {
      await taskRun(task.id);
      toast.success(LABELS.tasks.started(task.name));
    } catch (e) {
      await logMessage('error', `[task] run failed: ${e}`);
      toast.error(String(e));
    }
  });

  const handleCancel = useLockFn(async (task: Task) => {
    try {
      await taskCancel(task.id);
      toast.success(LABELS.tasks.cancelRequested);
    } catch (e) {
      await logMessage('error', `[task] cancel failed: ${e}`);
      toast.error(String(e));
    }
  });

  const handleToggleEnabled = useLockFn(async (task: Task, enabled: boolean) => {
    try {
      await taskUpdate(task.id, { enabled });
    } catch (e) {
      await logMessage('error', `[task] toggle enabled failed: ${e}`);
      toast.error(String(e));
    }
  });

  const handleDelete = useLockFn(async () => {
    if (!deleting) {
      return;
    }
    try {
      await taskDelete(deleting.id);
      toast.success(LABELS.tasks.deleted(deleting.name));
      setDeleting(null);
    } catch (e) {
      await logMessage('error', `[task] delete failed: ${e}`);
      toast.error(String(e));
    }
  });

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border p-3">
        <h1 className="text-base font-semibold">{LABELS.tasks.title}</h1>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleRunAll}
            disabled={
              anyRunning || tasks.filter((t) => t.enabled && t.status !== 'Running').length === 0
            }
          >
            <Play data-icon="inline-start" />
            {LABELS.tasks.runAll}
          </Button>
          <Button size="sm" onClick={onOpenForm} disabled={!currentVolume}>
            <Plus data-icon="inline-start" />
            {LABELS.tasks.add}
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {ordered.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">{LABELS.tasks.noTasks}</p>
        ) : (
          <SortableList
            items={ordered}
            onReorder={handleReorder}
            disabled={anyRunning}
            className="gap-2"
            renderItem={(task, index) => (
              <TaskRow
                task={task}
                order={index}
                anyRunning={anyRunning}
                volumeLoaded={currentVolume !== null}
                onEdit={() => onEdit(task)}
                onRun={() => handleRun(task)}
                onCancel={() => handleCancel(task)}
                onToggleEnabled={(v) => handleToggleEnabled(task, v)}
                onDelete={() => setDeleting(task)}
              />
            )}
          />
        )}
      </div>

      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{LABELS.tasks.deleteConfirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting ? LABELS.tasks.deleteConfirmDesc(deleting.name) : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{LABELS.common.cancel}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={handleDelete}
            >
              {LABELS.common.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function TaskRow({
  task,
  order,
  anyRunning,
  volumeLoaded,
  onEdit,
  onRun,
  onCancel,
  onToggleEnabled,
  onDelete,
}: {
  task: Task;
  order: number;
  anyRunning: boolean;
  volumeLoaded: boolean;
  onEdit: () => void;
  onRun: () => void;
  onCancel: () => void;
  onToggleEnabled: (v: boolean) => void;
  onDelete: () => void;
}) {
  const running = task.status === 'Running';

  return (
    <div className="rounded-lg border border-border bg-card p-2">
      <div className="flex items-center gap-2">
        <span className="w-5 shrink-0 text-right font-mono text-xs text-muted-foreground">
          {order + 1}
        </span>
        <Switch
          checked={task.enabled}
          onCheckedChange={onToggleEnabled}
          disabled={running}
          size="sm"
          aria-label={LABELS.tasks.enabled}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-medium">{task.name}</span>
            <Badge variant="outline" className="shrink-0">
              {task.kind === 'Segment' ? LABELS.tasks.kindSegment : LABELS.tasks.kindDetect}
            </Badge>
          </div>
          {running ? (
            <TaskProgress current={task.progress_current} total={task.progress_total} visible />
          ) : task.status === 'Failed' && task.error ? (
            <p className="truncate text-xs text-destructive" title={task.error}>
              {LABELS.tasks.errorLabel}: {task.error}
            </p>
          ) : null}
        </div>
        <TaskStatusBadge status={task.status} />
        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onEdit}
            disabled={running}
            title={LABELS.tasks.edit(task.name)}
          >
            <Pencil />
          </Button>
          {running ? (
            <Button variant="ghost" size="icon-xs" onClick={onCancel} title={LABELS.tasks.cancel}>
              <Square className="fill-current" />
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={onRun}
              disabled={anyRunning || !volumeLoaded}
              title={LABELS.tasks.run}
            >
              <Play />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon-xs"
            className="hover:bg-destructive hover:text-destructive-foreground"
            onClick={onDelete}
            title={LABELS.common.delete}
          >
            <Trash />
          </Button>
        </div>
      </div>
    </div>
  );
}
