import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useLabel2dDefStore } from '@/stores/label-def-2d';
import { useLabel3dDefStore } from '@/stores/label-def-3d';

vi.mock('@/services/cmd', () => ({ logMessage: vi.fn() }));

describe('useLabel2dDefStore - SubLabel CRUD', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('adds a sublabel', async () => {
    const store = useLabel2dDefStore();
    const label = await store.addLabel('矩形', '#3b82f6');
    const subLabel = await store.addSubLabel(label.id, '白色矩形');

    expect(subLabel.parentId).toBe(label.id);
    expect(subLabel.name).toBe('白色矩形');
    expect(store.sublabels).toHaveLength(1);
  });

  it('rejects duplicate sublabel name under same parent', async () => {
    const store = useLabel2dDefStore();
    const label = await store.addLabel('矩形', '#3b82f6');
    await store.addSubLabel(label.id, '白色矩形');

    await expect(store.addSubLabel(label.id, '白色矩形')).rejects.toThrow(
      '子标签 "白色矩形" 已存在'
    );
  });

  it('allows same sublabel name under different parents', async () => {
    const store = useLabel2dDefStore();
    const label1 = await store.addLabel('矩形', '#3b82f6');
    const label2 = await store.addLabel('圆形', '#22c55e');

    await store.addSubLabel(label1.id, '大');
    await store.addSubLabel(label2.id, '大');

    expect(store.sublabels).toHaveLength(2);
  });

  it('removes a sublabel', async () => {
    const store = useLabel2dDefStore();
    const label = await store.addLabel('矩形', '#3b82f6');
    const subLabel = await store.addSubLabel(label.id, '白色矩形');

    await store.removeSubLabel(subLabel.id);
    expect(store.sublabels).toHaveLength(0);
  });

  it('updates sublabel name', async () => {
    const store = useLabel2dDefStore();
    const label = await store.addLabel('矩形', '#3b82f6');
    const subLabel = await store.addSubLabel(label.id, '白色矩形');

    store.updateSubLabel(subLabel.id, { name: '白色大矩形' });
    expect(store.sublabels[0].name).toBe('白色大矩形');
  });

  it('rejects updating sublabel to duplicate name', async () => {
    const store = useLabel2dDefStore();
    const label = await store.addLabel('矩形', '#3b82f6');
    await store.addSubLabel(label.id, '白色矩形');
    await store.addSubLabel(label.id, '大矩形');

    expect(() => store.updateSubLabel(store.sublabels[1].id, { name: '白色矩形' })).toThrow(
      '子标签 "白色矩形" 已存在'
    );
  });

  it('returns sublabels by parent', async () => {
    const store = useLabel2dDefStore();
    const label1 = await store.addLabel('矩形', '#3b82f6');
    const label2 = await store.addLabel('圆形', '#22c55e');

    await store.addSubLabel(label1.id, '白色矩形');
    await store.addSubLabel(label1.id, '大矩形');
    await store.addSubLabel(label2.id, '小圆形');

    const rectSubLabels = store.subLabelsByParent(label1.id);
    expect(rectSubLabels).toHaveLength(2);
    expect(rectSubLabels.map((s) => s.name)).toEqual(['白色矩形', '大矩形']);

    const circleSubLabels = store.subLabelsByParent(label2.id);
    expect(circleSubLabels).toHaveLength(1);
    expect(circleSubLabels[0].name).toBe('小圆形');
  });

  it('finds sublabel by name', async () => {
    const store = useLabel2dDefStore();
    const label = await store.addLabel('矩形', '#3b82f6');
    await store.addSubLabel(label.id, '白色矩形');

    const found = store.subLabelByName('白色矩形');
    expect(found).toBeDefined();
    expect(found!.name).toBe('白色矩形');
    expect(found!.parentId).toBe(label.id);
  });

  it('subLabelByName returns undefined for non-existent name', async () => {
    const store = useLabel2dDefStore();
    const label = await store.addLabel('矩形', '#3b82f6');
    await store.addSubLabel(label.id, '白色矩形');

    expect(store.subLabelByName('不存在')).toBeUndefined();
  });

  it('subLabelByName returns undefined when no sublabels exist', () => {
    const store = useLabel2dDefStore();
    expect(store.subLabelByName('anything')).toBeUndefined();
  });
});

describe('useLabel2dDefStore - LocateConfig', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('updates locate config', async () => {
    const store = useLabel2dDefStore();
    const label = await store.addLabel('矩形', '#3b82f6');

    store.updateLocateConfig(label.id, { mode: 'detect_visual' });
    const config = store.getLocateConfig(label.id);

    expect(config).toBeDefined();
    expect(config!.mode).toBe('detect_visual');
    expect(config!.labelId).toBe(label.id);
  });

  it('updates existing locate config', async () => {
    const store = useLabel2dDefStore();
    const label = await store.addLabel('矩形', '#3b82f6');

    store.updateLocateConfig(label.id, { mode: 'detect' });
    store.updateLocateConfig(label.id, { rangeStart: 10, rangeEnd: 50 });

    const config = store.getLocateConfig(label.id);
    expect(config!.mode).toBe('detect');
    expect(config!.rangeStart).toBe(10);
    expect(config!.rangeEnd).toBe(50);
  });

  it('returns undefined for non-existent config', () => {
    const store = useLabel2dDefStore();
    expect(store.getLocateConfig('non-existent')).toBeUndefined();
  });
});

describe('useLabel2dDefStore - DetectProgress', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('updates detect progress', async () => {
    const store = useLabel2dDefStore();
    const label = await store.addLabel('矩形', '#3b82f6');

    store.updateDetectProgress(label.id, { status: 'running', current: 10, total: 100 });
    const progress = store.getDetectProgress(label.id);

    expect(progress).toBeDefined();
    expect(progress!.status).toBe('running');
    expect(progress!.current).toBe(10);
    expect(progress!.total).toBe(100);
  });

  it('resets detect progress', async () => {
    const store = useLabel2dDefStore();
    const label = await store.addLabel('矩形', '#3b82f6');

    store.updateDetectProgress(label.id, { status: 'done' });
    store.resetDetectProgress(label.id);

    expect(store.getDetectProgress(label.id)).toBeUndefined();
  });

  it('getDetectProgress returns undefined for non-existent label', () => {
    const store = useLabel2dDefStore();
    expect(store.getDetectProgress('non-existent')).toBeUndefined();
  });

  it('updateDetectProgress merges with existing progress', async () => {
    const store = useLabel2dDefStore();
    const label = await store.addLabel('矩形', '#3b82f6');

    store.updateDetectProgress(label.id, { status: 'running', current: 0, total: 100 });
    store.updateDetectProgress(label.id, { current: 50 });

    const progress = store.getDetectProgress(label.id);
    expect(progress).toBeDefined();
    expect(progress!.current).toBe(50);
    expect(progress!.total).toBe(100);
    expect(progress!.status).toBe('running');
  });

  it('updateDetectProgress creates with defaults when no existing progress', async () => {
    const store = useLabel2dDefStore();
    const label = await store.addLabel('矩形', '#3b82f6');

    store.updateDetectProgress(label.id, { current: 5 });

    const progress = store.getDetectProgress(label.id);
    expect(progress).toBeDefined();
    expect(progress!.current).toBe(5);
    expect(progress!.total).toBe(0);
    expect(progress!.status).toBe('idle');
  });
});

describe('useLabel2dDefStore - Label CRUD', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('addLabel creates label with correct properties', async () => {
    const store = useLabel2dDefStore();
    const label = await store.addLabel('矩形', '#3b82f6');

    expect(label.name).toBe('矩形');
    expect(label.color).toBe('#3b82f6');
    expect(label.order).toBe(1);
    expect(label.id).toBeDefined();
    expect(store.labels).toHaveLength(1);
  });

  it('addLabel rejects duplicate name', async () => {
    const store = useLabel2dDefStore();
    await store.addLabel('矩形', '#3b82f6');

    await expect(store.addLabel('矩形', '#22c55e')).rejects.toThrow('Label "矩形" already exists');
  });

  it('addLabel rejects when 255 labels exist', async () => {
    const store = useLabel2dDefStore();
    for (let i = 0; i < 255; i++) {
      await store.addLabel(`label-${i}`);
    }
    expect(store.labels).toHaveLength(255);

    await expect(store.addLabel('label-256')).rejects.toThrow('Maximum 255 labels reached');
  });

  it('removeLabel removes label and cascades to sublabels and locateConfigs', async () => {
    const store = useLabel2dDefStore();
    const label = await store.addLabel('矩形', '#3b82f6');
    await store.addSubLabel(label.id, '白色矩形');
    store.updateLocateConfig(label.id, { mode: 'detect_visual' });

    expect(store.labels).toHaveLength(1);
    expect(store.sublabels).toHaveLength(1);
    expect(store.locateConfigs).toHaveLength(1);

    await store.removeLabel(label.id);

    expect(store.labels).toHaveLength(0);
    expect(store.sublabels).toHaveLength(0);
    expect(store.locateConfigs).toHaveLength(0);
  });

  it('updateLabel updates name, color, order', async () => {
    const store = useLabel2dDefStore();
    const label = await store.addLabel('矩形', '#3b82f6');

    await store.updateLabel(label.id, { name: '正方形', color: '#22c55e', order: 5 });

    expect(store.labels[0].name).toBe('正方形');
    expect(store.labels[0].color).toBe('#22c55e');
    expect(store.labels[0].order).toBe(5);
  });

  it('updateLabel rejects duplicate name', async () => {
    const store = useLabel2dDefStore();
    await store.addLabel('矩形', '#3b82f6');
    const label2 = await store.addLabel('圆形', '#22c55e');

    await expect(store.updateLabel(label2.id, { name: '矩形' })).rejects.toThrow(
      'Label "矩形" already exists'
    );
  });

  it('updateLabel rejects empty name', async () => {
    const store = useLabel2dDefStore();
    const label = await store.addLabel('矩形', '#3b82f6');

    await expect(store.updateLabel(label.id, { name: '  ' })).rejects.toThrow(
      'Label name cannot be empty'
    );
  });

  it('updateOrder swaps order on conflict', async () => {
    const store = useLabel2dDefStore();
    const l1 = await store.addLabel('A', '#ff0000');
    const l2 = await store.addLabel('B', '#00ff00');
    expect(l1.order).toBe(1);
    expect(l2.order).toBe(2);

    store.updateOrder(l1.id, 2);

    expect(store.labels.find((l) => l.id === l1.id)!.order).toBe(2);
    expect(store.labels.find((l) => l.id === l2.id)!.order).toBe(1);
  });

  it('reorder reorders and renumbers', async () => {
    const store = useLabel2dDefStore();
    await store.addLabel('A', '#ff0000');
    await store.addLabel('B', '#00ff00');
    await store.addLabel('C', '#0000ff');

    store.reorder(0, 2);

    expect(store.labels.map((l) => l.name)).toEqual(['B', 'C', 'A']);
    expect(store.labels.map((l) => l.order)).toEqual([1, 2, 3]);
  });

  it('sortedLabels returns sorted by order', async () => {
    const store = useLabel2dDefStore();
    await store.addLabel('C', '#ff0000');
    await store.addLabel('A', '#00ff00');
    await store.addLabel('B', '#0000ff');

    store.updateOrder(store.labels[0].id, 3);

    expect(store.sortedLabels.map((l) => l.name)).toEqual(['B', 'A', 'C']);
  });

  it('labelById finds by id', async () => {
    const store = useLabel2dDefStore();
    const label = await store.addLabel('矩形', '#3b82f6');

    expect(store.labelById(label.id)).toBeDefined();
    expect(store.labelById(label.id)!.name).toBe('矩形');
    expect(store.labelById('non-existent')).toBeUndefined();
  });

  it('labelByName finds by name', async () => {
    const store = useLabel2dDefStore();
    await store.addLabel('矩形', '#3b82f6');

    expect(store.labelByName('矩形')).toBeDefined();
    expect(store.labelByName('矩形')!.color).toBe('#3b82f6');
    expect(store.labelByName('不存在')).toBeUndefined();
  });

  it('nextOrder returns max+1', async () => {
    const store = useLabel2dDefStore();
    expect(store.nextOrder).toBe(1);

    await store.addLabel('A');
    await store.addLabel('B');
    expect(store.nextOrder).toBe(3);
  });
});

describe('useLabel3dDefStore - independence', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('works independently with correct initial state', () => {
    const store = useLabel3dDefStore();
    expect(store.labels).toEqual([]);
    expect(store.sublabels).toEqual([]);
    expect(store.locateConfigs).toEqual([]);
    expect(store.detectProgressList).toEqual([]);
  });

  it('3d def store is independent of 2d def store', async () => {
    const store3d = useLabel3dDefStore();
    const store2d = useLabel2dDefStore();

    await store3d.addLabel('3d-label', '#ff0000');
    await store2d.addLabel('2d-label', '#00ff00');

    expect(store3d.labels).toHaveLength(1);
    expect(store2d.labels).toHaveLength(1);
    expect(store3d.labels[0].name).toBe('3d-label');
    expect(store2d.labels[0].name).toBe('2d-label');
  });
});
