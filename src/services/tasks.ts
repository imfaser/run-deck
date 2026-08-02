import { invoke } from '@tauri-apps/api/core';
import {
  AiObjectInputSchema,
  AiRecognizeResponseSchema,
  CurrentVolumeSchema,
  TaskCreateInputSchema,
  TaskOrderInputSchema,
  TaskPatchSchema,
  TaskSchema,
  type AiObjectInput,
  type AiRecognizeResponse,
  type CurrentVolume,
  type Task,
  type TaskCreateInput,
  type TaskOrderInput,
  type TaskPatch,
} from '@/schemas/task';

export async function taskCreate(input: TaskCreateInput): Promise<Task> {
  const raw = await invoke<unknown>('task_create', { input: TaskCreateInputSchema.parse(input) });
  return TaskSchema.parse(raw);
}

export async function taskList(): Promise<Task[]> {
  const raw = await invoke<unknown>('task_list');
  return TaskSchema.array().parse(raw);
}

export async function taskUpdate(id: string, patch: TaskPatch): Promise<Task> {
  const raw = await invoke<unknown>('task_update', { id, patch: TaskPatchSchema.parse(patch) });
  return TaskSchema.parse(raw);
}

export async function taskReorder(inputs: TaskOrderInput[]): Promise<void> {
  await invoke('task_reorder', { inputs: inputs.map((i) => TaskOrderInputSchema.parse(i)) });
}

export async function taskDelete(id: string): Promise<void> {
  await invoke('task_delete', { id });
}

export async function taskRun(id: string): Promise<void> {
  await invoke('task_run', { id });
}

export async function taskCancel(id: string): Promise<void> {
  await invoke('task_cancel', { id });
}

export async function getCurrentVolume(): Promise<CurrentVolume | null> {
  const raw = await invoke<unknown>('get_current_volume');
  if (raw === null || raw === undefined) {
    return null;
  }
  return CurrentVolumeSchema.parse(raw);
}

export async function aiRecognizeSlice(
  volumeId: string,
  index: number,
  objects: AiObjectInput[]
): Promise<AiRecognizeResponse> {
  const raw = await invoke<unknown>('ai_recognize_slice', {
    volumeId,
    index,
    objects: objects.map((o) => AiObjectInputSchema.parse(o)),
  });
  return AiRecognizeResponseSchema.parse(raw);
}
