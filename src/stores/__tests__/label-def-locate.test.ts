import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useLabelDefStore } from '@/stores/label-def';

describe('useLabelDefStore - SubLabel CRUD', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('adds a sublabel', () => {
    const store = useLabelDefStore();
    const label = store.addLabel('矩形', '#3b82f6');
    const subLabel = store.addSubLabel(label.id, '白色矩形');

    expect(subLabel.parentId).toBe(label.id);
    expect(subLabel.name).toBe('白色矩形');
    expect(store.sublabels).toHaveLength(1);
  });

  it('rejects duplicate sublabel name under same parent', () => {
    const store = useLabelDefStore();
    const label = store.addLabel('矩形', '#3b82f6');
    store.addSubLabel(label.id, '白色矩形');

    expect(() => store.addSubLabel(label.id, '白色矩形')).toThrow('子标签 "白色矩形" 已存在');
  });

  it('allows same sublabel name under different parents', () => {
    const store = useLabelDefStore();
    const label1 = store.addLabel('矩形', '#3b82f6');
    const label2 = store.addLabel('圆形', '#22c55e');

    store.addSubLabel(label1.id, '大');
    store.addSubLabel(label2.id, '大');

    expect(store.sublabels).toHaveLength(2);
  });

  it('removes a sublabel', () => {
    const store = useLabelDefStore();
    const label = store.addLabel('矩形', '#3b82f6');
    const subLabel = store.addSubLabel(label.id, '白色矩形');

    store.removeSubLabel(subLabel.id);
    expect(store.sublabels).toHaveLength(0);
  });

  it('updates sublabel name', () => {
    const store = useLabelDefStore();
    const label = store.addLabel('矩形', '#3b82f6');
    const subLabel = store.addSubLabel(label.id, '白色矩形');

    store.updateSubLabel(subLabel.id, { name: '白色大矩形' });
    expect(store.sublabels[0].name).toBe('白色大矩形');
  });

  it('rejects updating sublabel to duplicate name', () => {
    const store = useLabelDefStore();
    const label = store.addLabel('矩形', '#3b82f6');
    store.addSubLabel(label.id, '白色矩形');
    store.addSubLabel(label.id, '大矩形');

    expect(() => store.updateSubLabel(store.sublabels[1].id, { name: '白色矩形' })).toThrow(
      '子标签 "白色矩形" 已存在'
    );
  });

  it('returns sublabels by parent', () => {
    const store = useLabelDefStore();
    const label1 = store.addLabel('矩形', '#3b82f6');
    const label2 = store.addLabel('圆形', '#22c55e');

    store.addSubLabel(label1.id, '白色矩形');
    store.addSubLabel(label1.id, '大矩形');
    store.addSubLabel(label2.id, '小圆形');

    const rectSubLabels = store.subLabelsByParent(label1.id);
    expect(rectSubLabels).toHaveLength(2);
    expect(rectSubLabels.map((s) => s.name)).toEqual(['白色矩形', '大矩形']);

    const circleSubLabels = store.subLabelsByParent(label2.id);
    expect(circleSubLabels).toHaveLength(1);
    expect(circleSubLabels[0].name).toBe('小圆形');
  });

  it('finds sublabel by name', () => {
    const store = useLabelDefStore();
    const label = store.addLabel('矩形', '#3b82f6');
    store.addSubLabel(label.id, '白色矩形');

    const found = store.subLabelByName('白色矩形');
    expect(found).toBeDefined();
    expect(found!.name).toBe('白色矩形');
    expect(found!.parentId).toBe(label.id);
  });

  it('subLabelByName returns undefined for non-existent name', () => {
    const store = useLabelDefStore();
    const label = store.addLabel('矩形', '#3b82f6');
    store.addSubLabel(label.id, '白色矩形');

    expect(store.subLabelByName('不存在')).toBeUndefined();
  });

  it('subLabelByName returns undefined when no sublabels exist', () => {
    const store = useLabelDefStore();
    expect(store.subLabelByName('anything')).toBeUndefined();
  });
});

describe('useLabelDefStore - LocateConfig', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('updates locate config', () => {
    const store = useLabelDefStore();
    const label = store.addLabel('矩形', '#3b82f6');

    store.updateLocateConfig(label.id, { mode: 'detect_visual' });
    const config = store.getLocateConfig(label.id);

    expect(config).toBeDefined();
    expect(config!.mode).toBe('detect_visual');
    expect(config!.labelId).toBe(label.id);
  });

  it('updates existing locate config', () => {
    const store = useLabelDefStore();
    const label = store.addLabel('矩形', '#3b82f6');

    store.updateLocateConfig(label.id, { mode: 'detect' });
    store.updateLocateConfig(label.id, { rangeStart: 10, rangeEnd: 50 });

    const config = store.getLocateConfig(label.id);
    expect(config!.mode).toBe('detect');
    expect(config!.rangeStart).toBe(10);
    expect(config!.rangeEnd).toBe(50);
  });

  it('returns undefined for non-existent config', () => {
    const store = useLabelDefStore();
    expect(store.getLocateConfig('non-existent')).toBeUndefined();
  });
});

describe('useLabelDefStore - DetectProgress', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('updates detect progress', () => {
    const store = useLabelDefStore();
    const label = store.addLabel('矩形', '#3b82f6');

    store.updateDetectProgress(label.id, { status: 'running', current: 10, total: 100 });
    const progress = store.getDetectProgress(label.id);

    expect(progress).toBeDefined();
    expect(progress!.status).toBe('running');
    expect(progress!.current).toBe(10);
    expect(progress!.total).toBe(100);
  });

  it('resets detect progress', () => {
    const store = useLabelDefStore();
    const label = store.addLabel('矩形', '#3b82f6');

    store.updateDetectProgress(label.id, { status: 'done' });
    store.resetDetectProgress(label.id);

    expect(store.getDetectProgress(label.id)).toBeUndefined();
  });

  it('getDetectProgress returns undefined for non-existent label', () => {
    const store = useLabelDefStore();
    expect(store.getDetectProgress('non-existent')).toBeUndefined();
  });

  it('updateDetectProgress merges with existing progress', () => {
    const store = useLabelDefStore();
    const label = store.addLabel('矩形', '#3b82f6');

    store.updateDetectProgress(label.id, { status: 'running', current: 0, total: 100 });
    store.updateDetectProgress(label.id, { current: 50 });

    const progress = store.getDetectProgress(label.id);
    expect(progress).toBeDefined();
    expect(progress!.current).toBe(50);
    expect(progress!.total).toBe(100);
    expect(progress!.status).toBe('running');
  });

  it('updateDetectProgress creates with defaults when no existing progress', () => {
    const store = useLabelDefStore();
    const label = store.addLabel('矩形', '#3b82f6');

    store.updateDetectProgress(label.id, { current: 5 });

    const progress = store.getDetectProgress(label.id);
    expect(progress).toBeDefined();
    expect(progress!.current).toBe(5);
    expect(progress!.total).toBe(0);
    expect(progress!.status).toBe('idle');
  });
});
