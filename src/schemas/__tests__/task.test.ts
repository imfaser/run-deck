import { describe, it, expect } from 'vitest';
import {
  TaskSchema,
  TaskKindSchema,
  TaskStatusSchema,
  TaskCreateInputSchema,
  TaskPatchSchema,
  TaskOrderInputSchema,
  DetectTargetSchema,
  AiObjectInputSchema,
  AiRecognizeResponseSchema,
} from '@/schemas/task';

describe('TaskKindSchema', () => {
  it('accepts valid kinds', () => {
    expect(TaskKindSchema.parse('Segment')).toBe('Segment');
    expect(TaskKindSchema.parse('Detect')).toBe('Detect');
  });

  it('rejects invalid kinds', () => {
    expect(() => TaskKindSchema.parse('segment')).toThrow();
    expect(() => TaskKindSchema.parse('Foo')).toThrow();
  });
});

describe('TaskStatusSchema', () => {
  it('accepts valid statuses', () => {
    for (const s of ['Pending', 'Running', 'Done', 'Failed', 'Cancelled']) {
      expect(TaskStatusSchema.parse(s)).toBe(s);
    }
  });

  it('rejects invalid statuses', () => {
    expect(() => TaskStatusSchema.parse('pending')).toThrow();
  });
});

describe('TaskSchema', () => {
  it('parses a full task (snake_case from Rust)', () => {
    const task = TaskSchema.parse({
      id: 't1',
      name: 'seg-01',
      kind: 'Segment',
      status: 'Running',
      enabled: true,
      order: 1,
      volume_id: 'vol-1',
      range_start: 0,
      range_end: 9,
      params: {
        use_prev_mask: true,
        targets: [],
      },
      error: null,
      progress_current: 3,
      progress_total: 10,
      created_at: 1700000000000,
      updated_at: 1700000000000,
    });
    expect(task.params.use_prev_mask).toBe(true);
    expect(task.progress_current).toBe(3);
  });

  it('parses detect targets', () => {
    const task = TaskSchema.parse({
      id: 't2',
      name: 'det-01',
      kind: 'Detect',
      status: 'Pending',
      enabled: true,
      order: 2,
      volume_id: 'vol-1',
      range_start: 0,
      range_end: 5,
      params: {
        use_prev_mask: false,
        targets: [{ label_id: 'L1', sub_labels: ['nucleus'] }],
      },
      error: null,
      progress_current: 0,
      progress_total: 0,
      created_at: 0,
      updated_at: 0,
    });
    expect(task.params.targets[0].label_id).toBe('L1');
    expect(task.params.targets[0].sub_labels).toEqual(['nucleus']);
  });

  it('rejects missing required fields', () => {
    expect(() => TaskSchema.parse({ id: 't1' })).toThrow();
  });

  it('rejects invalid status enum', () => {
    expect(() =>
      TaskSchema.parse({
        id: 't1',
        name: 'seg',
        kind: 'Segment',
        status: 'InvalidStatus',
        enabled: true,
        order: 1,
        volume_id: 'v',
        range_start: 0,
        range_end: 5,
        params: { use_prev_mask: true, targets: [] },
        error: null,
        progress_current: 0,
        progress_total: 0,
        created_at: 0,
        updated_at: 0,
      })
    ).toThrow();
  });
});

describe('TaskCreateInputSchema', () => {
  it('accepts camelCase input', () => {
    const input = TaskCreateInputSchema.parse({
      name: 'seg',
      kind: 'Segment',
      volumeId: 'vol-1',
      rangeStart: 0,
      rangeEnd: 5,
      params: { use_prev_mask: true, targets: [] },
    });
    expect(input.volumeId).toBe('vol-1');
    expect(input.rangeEnd).toBe(5);
  });

  it('rejects empty name', () => {
    expect(() =>
      TaskCreateInputSchema.parse({
        name: '',
        kind: 'Segment',
        volumeId: 'v',
        rangeStart: 0,
        rangeEnd: 1,
        params: { use_prev_mask: true, targets: [] },
      })
    ).toThrow();
  });

  it('rejects negative range', () => {
    expect(() =>
      TaskCreateInputSchema.parse({
        name: 'x',
        kind: 'Segment',
        volumeId: 'v',
        rangeStart: -1,
        rangeEnd: 1,
        params: { use_prev_mask: true, targets: [] },
      })
    ).toThrow();
  });

  it('rejects non-integer range', () => {
    expect(() =>
      TaskCreateInputSchema.parse({
        name: 'x',
        kind: 'Segment',
        volumeId: 'v',
        rangeStart: 0.5,
        rangeEnd: 5,
        params: { use_prev_mask: true, targets: [] },
      })
    ).toThrow();
  });
});

describe('TaskPatchSchema', () => {
  it('accepts partial patch with name only', () => {
    const patch = TaskPatchSchema.parse({ name: 'renamed' });
    expect(patch.name).toBe('renamed');
    expect(patch.enabled).toBeUndefined();
    expect(patch.order).toBeUndefined();
  });

  it('accepts empty patch', () => {
    const patch = TaskPatchSchema.parse({});
    expect(patch.name).toBeUndefined();
    expect(patch.enabled).toBeUndefined();
  });

  it('accepts full patch', () => {
    const patch = TaskPatchSchema.parse({
      name: 'x',
      enabled: false,
      order: 5,
      rangeStart: 1,
      rangeEnd: 10,
      params: { use_prev_mask: false, targets: [] },
    });
    expect(patch.name).toBe('x');
    expect(patch.enabled).toBe(false);
    expect(patch.order).toBe(5);
  });
});

describe('TaskOrderInputSchema', () => {
  it('accepts valid order input', () => {
    const input = TaskOrderInputSchema.parse({ id: 't1', order: 3 });
    expect(input.id).toBe('t1');
    expect(input.order).toBe(3);
  });

  it('rejects missing id', () => {
    expect(() => TaskOrderInputSchema.parse({ order: 1 })).toThrow();
  });

  it('rejects missing order', () => {
    expect(() => TaskOrderInputSchema.parse({ id: 't1' })).toThrow();
  });
});

describe('DetectTargetSchema', () => {
  it('accepts target with sub_labels', () => {
    const target = DetectTargetSchema.parse({
      label_id: 'L1',
      sub_labels: ['nucleus', 'cytoplasm'],
    });
    expect(target.label_id).toBe('L1');
    expect(target.sub_labels).toHaveLength(2);
  });

  it('accepts target with empty sub_labels', () => {
    const target = DetectTargetSchema.parse({ label_id: 'L1', sub_labels: [] });
    expect(target.sub_labels).toEqual([]);
  });

  it('rejects missing label_id', () => {
    expect(() => DetectTargetSchema.parse({ sub_labels: [] })).toThrow();
  });
});

describe('AiObjectInputSchema', () => {
  it('parses object with points and boxes', () => {
    const obj = AiObjectInputSchema.parse({
      id: 'o1',
      label_id: 'L1',
      points: [{ id: 'p1', x: 1, y: 2, sign: 'Positive' }],
      boxes: [{ id: 'b1', box_type: 'Annotate', x1: 0, y1: 0, x2: 10, y2: 10 }],
    });
    expect(obj.points[0].sign).toBe('Positive');
    expect(obj.boxes[0].box_type).toBe('Annotate');
  });

  it('accepts object with empty points and boxes', () => {
    const obj = AiObjectInputSchema.parse({
      id: 'o1',
      label_id: 'L1',
      points: [],
      boxes: [],
    });
    expect(obj.points).toEqual([]);
    expect(obj.boxes).toEqual([]);
  });
});

describe('AiRecognizeResponseSchema', () => {
  it('parses valid response', () => {
    const res = AiRecognizeResponseSchema.parse({ maskHash: 'abc123' });
    expect(res.maskHash).toBe('abc123');
  });

  it('rejects missing maskHash', () => {
    expect(() => AiRecognizeResponseSchema.parse({})).toThrow();
  });
});
