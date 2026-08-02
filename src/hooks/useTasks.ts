import useSWR from 'swr';
import { taskList } from '@/services/tasks';
import type { Task } from '@/schemas/task';

export const TASKS_KEY = 'tasks';

export function useTasks() {
  return useSWR<Task[]>(TASKS_KEY, taskList, {
    revalidateOnFocus: false,
    dedupingInterval: 3_000,
  });
}
