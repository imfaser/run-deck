import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Minus, X } from 'lucide-react';
import useSWR from 'swr';
import { Button } from '@/components/ui/button';
import { TaskList } from '@/components/task/TaskList';
import { TaskForm } from '@/components/task/TaskForm';
import { useTasks } from '@/hooks/useTasks';
import { useTaskChanged } from '@/hooks/useTaskChanged';
import { useDbChanged } from '@/hooks/useDbChanged';
import { getCurrentVolume } from '@/services/tasks';
import { LABELS } from '@/constants/labels';
import type { CurrentVolume, Task } from '@/schemas/task';

const appWindow = getCurrentWindow();

export const Route = createFileRoute('/tasks')({
  component: TasksRouteComponent,
});

function TasksRouteComponent() {
  const { data: tasks, mutate } = useTasks();
  const { data: currentVolume } = useSWR<CurrentVolume | null>('current-volume', getCurrentVolume, {
    revalidateOnFocus: false,
    dedupingInterval: 5_000,
  });
  useTaskChanged();
  useDbChanged();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <MiniTitleBar />
      <div className="min-h-0 flex-1">
        <TaskList
          tasks={tasks ?? []}
          currentVolume={currentVolume ?? null}
          onEdit={(task) => {
            setEditing(task);
            setFormOpen(true);
          }}
          onOpenForm={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        />
      </div>
      <TaskForm
        open={formOpen}
        onOpenChange={setFormOpen}
        editing={editing}
        currentVolume={currentVolume ?? null}
        onSaved={mutate}
      />
    </div>
  );
}

function MiniTitleBar() {
  return (
    <div
      className="flex h-9 shrink-0 items-center justify-between border-b border-border pl-3 select-none"
      data-tauri-drag-region
    >
      <span className="text-xs text-muted-foreground">{LABELS.tasks.title}</span>
      <div className="flex items-center gap-0.5 pr-1">
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => appWindow.minimize()}
          data-tauri-drag-region={false}
        >
          <Minus />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          className="hover:bg-destructive hover:text-destructive-foreground"
          onClick={() => appWindow.close()}
          data-tauri-drag-region={false}
        >
          <X />
        </Button>
      </div>
    </div>
  );
}
