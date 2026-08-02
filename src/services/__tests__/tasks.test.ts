import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

import { invoke } from '@tauri-apps/api/core';
import {
  taskCreate,
  taskList,
  taskUpdate,
  taskReorder,
  taskDelete,
  taskRun,
  taskCancel,
  getCurrentVolume,
  aiRecognizeSlice,
} from '@/services/tasks';

const mockInvoke = vi.mocked(invoke);

const taskJson = {
  id: 't1',
  name: 'seg',
  kind: 'Segment',
  status: 'Pending',
  enabled: true,
  order: 1,
  volume_id: 'v',
  range_start: 0,
  range_end: 5,
  params: { use_prev_mask: true, multimask_output: true, targets: [] },
  error: null,
  progress_current: 0,
  progress_total: 6,
  created_at: 0,
  updated_at: 0,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('task services', () => {
  it('taskCreate invokes task_create with parsed input', async () => {
    mockInvoke.mockResolvedValue(taskJson);
    await taskCreate({
      name: 'seg',
      kind: 'Segment',
      volumeId: 'v',
      rangeStart: 0,
      rangeEnd: 5,
      params: { use_prev_mask: true, multimask_output: true, targets: [] },
    });
    expect(mockInvoke).toHaveBeenCalledWith('task_create', {
      input: expect.objectContaining({ name: 'seg', volumeId: 'v' }),
    });
  });

  it('taskList returns parsed tasks', async () => {
    mockInvoke.mockResolvedValue([taskJson]);
    const tasks = await taskList();
    expect(tasks).toHaveLength(1);
    expect(tasks[0].kind).toBe('Segment');
    expect(tasks[0].status).toBe('Pending');
  });

  it('taskUpdate invokes task_update with id + patch', async () => {
    mockInvoke.mockResolvedValue(taskJson);
    await taskUpdate('t1', { enabled: false });
    expect(mockInvoke).toHaveBeenCalledWith('task_update', {
      id: 't1',
      patch: { enabled: false },
    });
  });

  it('taskReorder invokes task_reorder', async () => {
    mockInvoke.mockResolvedValue(undefined);
    await taskReorder([
      { id: 'a', order: 1 },
      { id: 'b', order: 2 },
    ]);
    expect(mockInvoke).toHaveBeenCalledWith('task_reorder', {
      inputs: [
        { id: 'a', order: 1 },
        { id: 'b', order: 2 },
      ],
    });
  });

  it('taskDelete / taskRun / taskCancel invoke with id', async () => {
    mockInvoke.mockResolvedValue(undefined);
    await taskDelete('t1');
    expect(mockInvoke).toHaveBeenCalledWith('task_delete', { id: 't1' });
    await taskRun('t1');
    expect(mockInvoke).toHaveBeenCalledWith('task_run', { id: 't1' });
    await taskCancel('t1');
    expect(mockInvoke).toHaveBeenCalledWith('task_cancel', { id: 't1' });
  });

  it('getCurrentVolume returns null when none', async () => {
    mockInvoke.mockResolvedValue(null);
    expect(await getCurrentVolume()).toBeNull();
  });

  it('getCurrentVolume parses volume response', async () => {
    mockInvoke.mockResolvedValue({
      volumeId: 'v1',
      totalSlices: 10,
      sliceWidth: 100,
      sliceHeight: 100,
    });
    const vol = await getCurrentVolume();
    expect(vol?.volumeId).toBe('v1');
  });

  it('aiRecognizeSlice invokes ai_recognize_slice and parses maskHash', async () => {
    mockInvoke.mockResolvedValue({ maskHash: 'abc123' });
    const res = await aiRecognizeSlice('v1', 3, [
      {
        id: 'o1',
        label_id: 'L1',
        points: [{ id: 'p1', x: 1, y: 2, sign: 'Positive' }],
        boxes: [],
      },
    ]);
    expect(res.maskHash).toBe('abc123');
    expect(mockInvoke).toHaveBeenCalledWith(
      'ai_recognize_slice',
      expect.objectContaining({ volumeId: 'v1', index: 3 })
    );
  });
});
