import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runningIdsFromTasks, useTaskStore } from '@/store/task';

const baseTask = {
  id: 't1',
  name: 'seg',
  kind: 'Segment' as const,
  status: 'Pending' as const,
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
  useTaskStore.setState({
    runningIds: [],
    formDraft: null,
    draggingId: null,
  });
});

describe('runningIdsFromTasks', () => {
  it('extracts only Running task ids', () => {
    const tasks = [
      baseTask,
      { ...baseTask, id: 't2', status: 'Running' as const },
      { ...baseTask, id: 't3', status: 'Done' as const },
    ];
    expect(runningIdsFromTasks(tasks)).toEqual(['t2']);
  });

  it('handles undefined', () => {
    expect(runningIdsFromTasks(undefined)).toEqual([]);
  });

  it('handles empty array', () => {
    expect(runningIdsFromTasks([])).toEqual([]);
  });

  it('handles multiple Running tasks', () => {
    const tasks = [
      { ...baseTask, id: 't1', status: 'Running' as const },
      { ...baseTask, id: 't2', status: 'Pending' as const },
      { ...baseTask, id: 't3', status: 'Running' as const },
      { ...baseTask, id: 't4', status: 'Failed' as const },
    ];
    expect(runningIdsFromTasks(tasks)).toEqual(['t1', 't3']);
  });

  it('handles all non-Running', () => {
    const tasks = [
      { ...baseTask, id: 't1', status: 'Pending' as const },
      { ...baseTask, id: 't2', status: 'Done' as const },
      { ...baseTask, id: 't3', status: 'Cancelled' as const },
    ];
    expect(runningIdsFromTasks(tasks)).toEqual([]);
  });
});

describe('useTaskStore', () => {
  it('setRunningIds replaces the set', () => {
    useTaskStore.getState().setRunningIds(['a', 'b']);
    expect(useTaskStore.getState().runningIds).toEqual(['a', 'b']);
  });

  it('setFormDraft stores a draft', () => {
    const draft = {
      name: 'new',
      kind: 'Detect' as const,
      rangeStart: 0,
      rangeEnd: 3,
      usePrevMask: false,
      multimaskOutput: true,
      targets: [],
    };
    useTaskStore.getState().setFormDraft(draft);
    expect(useTaskStore.getState().formDraft?.name).toBe('new');
    useTaskStore.getState().setFormDraft(null);
    expect(useTaskStore.getState().formDraft).toBeNull();
  });

  it('setDraggingId toggles drag state', () => {
    useTaskStore.getState().setDraggingId('t1');
    expect(useTaskStore.getState().draggingId).toBe('t1');
    useTaskStore.getState().setDraggingId(null);
    expect(useTaskStore.getState().draggingId).toBeNull();
  });
});
