import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { Task } from '@/schemas/task';

/** 新建/编辑任务表单草稿（camelCase，提交时转换）。 */
export interface TaskFormDraft {
  id?: string;
  name: string;
  kind: 'Segment' | 'Detect';
  rangeStart: number;
  rangeEnd: number;
  usePrevMask: boolean;
  targets: { labelId: string; subLabels: string[] }[];
}

export interface TaskState {
  runningIds: string[];
  setRunningIds: (ids: string[]) => void;
  formDraft: TaskFormDraft | null;
  setFormDraft: (draft: TaskFormDraft | null) => void;
  draggingId: string | null;
  setDraggingId: (id: string | null) => void;
}

/** 从任务列表同步运行中 id 集合。 */
export function runningIdsFromTasks(tasks: Task[] | undefined): string[] {
  return (tasks ?? []).filter((t) => t.status === 'Running').map((t) => t.id);
}

export const useTaskStore = create<TaskState>()(
  immer((set) => ({
    runningIds: [],
    setRunningIds: (ids) =>
      set((s) => {
        s.runningIds = ids;
      }),
    formDraft: null,
    setFormDraft: (draft) =>
      set((s) => {
        s.formDraft = draft;
      }),
    draggingId: null,
    setDraggingId: (id) =>
      set((s) => {
        s.draggingId = id;
      }),
  }))
);
