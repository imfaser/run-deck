import { describe, it, expect } from 'vitest';
import { boxesToAnnotationObjects } from '../useLocateAnything';
import type { BoundingBox } from '@/services/locate-anything';
import type { SubLabel } from '@/schemas/label';

function makeMockStore(labelMap: Map<string, { id: string; name: string }>) {
  return {
    labelById: (id: string) => labelMap.get(id),
    labels: Array.from(labelMap.values()),
  } as Parameters<typeof boxesToAnnotationObjects>[3];
}

describe('boxesToAnnotationObjects', () => {
  const sublabels: SubLabel[] = [
    { id: 'sl-1', parentId: 'label-1', name: '白色矩形' },
    { id: 'sl-2', parentId: 'label-1', name: '大矩形' },
  ];
  const store = makeMockStore(new Map([['label-1', { id: 'label-1', name: 'cat' }]]));

  it('groups boxes by name and matches sublabels', () => {
    const boxes: BoundingBox[] = [
      { name: '白色矩形', x1: 100, y1: 200, x2: 500, y2: 600 },
      { name: '白色矩形', x1: 600, y1: 200, x2: 900, y2: 600 },
      { name: '大矩形', x1: 50, y1: 50, x2: 800, y2: 900 },
    ];

    const result = boxesToAnnotationObjects(boxes, 'cat', sublabels, store, 1000, 1000);

    expect(result).toHaveLength(2);

    const whiteRect = result.find((r) => r.subLabelId === 'sl-1');
    expect(whiteRect).toBeDefined();
    expect(whiteRect!.labelId).toBe('label-1');
    expect(whiteRect!.boxes).toHaveLength(2);

    const bigRect = result.find((r) => r.subLabelId === 'sl-2');
    expect(bigRect).toBeDefined();
    expect(bigRect!.labelId).toBe('label-1');
    expect(bigRect!.boxes).toHaveLength(1);
  });

  it('groups multiple boxes of the same name into one annotation object', () => {
    const boxes: BoundingBox[] = [
      { name: '白色矩形', x1: 0, y1: 0, x2: 100, y2: 100 },
      { name: '白色矩形', x1: 200, y1: 200, x2: 300, y2: 300 },
      { name: '白色矩形', x1: 400, y1: 400, x2: 500, y2: 500 },
    ];

    const result = boxesToAnnotationObjects(boxes, 'cat', sublabels, store, 1000, 1000);

    expect(result).toHaveLength(1);
    expect(result[0].subLabelId).toBe('sl-1');
    expect(result[0].boxes).toHaveLength(3);
  });

  it('handles unknown box names with empty labelId', () => {
    const boxes: BoundingBox[] = [{ name: 'unknown_class', x1: 100, y1: 200, x2: 500, y2: 600 }];

    const result = boxesToAnnotationObjects(boxes, 'unknown', sublabels, store, 1000, 1000);

    expect(result).toHaveLength(1);
    expect(result[0].labelId).toBe('');
    expect(result[0].subLabelId).toBeUndefined();
  });

  it('converts normalized_1000 coordinates to pixels', () => {
    const boxes: BoundingBox[] = [{ name: '白色矩形', x1: 100, y1: 200, x2: 500, y2: 600 }];

    const result = boxesToAnnotationObjects(boxes, 'cat', sublabels, store, 1024, 768);

    expect(result[0].boxes[0]).toMatchObject({
      x1: (100 / 1000) * 1024,
      y1: (200 / 1000) * 768,
      x2: (500 / 1000) * 1024,
      y2: (600 / 1000) * 768,
    });
  });

  it('handles empty boxes array', () => {
    const result = boxesToAnnotationObjects([], 'cat', sublabels, store, 1000, 1000);
    expect(result).toHaveLength(0);
  });

  it('handles zero coordinates', () => {
    const boxes: BoundingBox[] = [{ name: '白色矩形', x1: 0, y1: 0, x2: 0, y2: 0 }];

    const result = boxesToAnnotationObjects(boxes, 'cat', sublabels, store, 1000, 1000);

    expect(result[0].boxes[0]).toMatchObject({ x1: 0, y1: 0, x2: 0, y2: 0 });
  });

  it('sets labelId from store when parent label exists', () => {
    const customStore = makeMockStore(new Map([['parent-A', { id: 'parent-A', name: 'item' }]]));
    const customSublabels: SubLabel[] = [{ id: 'sl-x', parentId: 'parent-A', name: 'item' }];

    const boxes: BoundingBox[] = [{ name: 'item', x1: 0, y1: 0, x2: 100, y2: 100 }];
    const result = boxesToAnnotationObjects(boxes, 'item', customSublabels, customStore, 500, 500);

    expect(result[0].labelId).toBe('parent-A');
    expect(result[0].subLabelId).toBe('sl-x');
  });

  it('falls back to parentLabelName when no sublabels match', () => {
    const boxes: BoundingBox[] = [{ name: 'cat', x1: 0, y1: 0, x2: 100, y2: 100 }];
    const result = boxesToAnnotationObjects(boxes, 'cat', [], store, 1000, 1000);

    expect(result).toHaveLength(1);
    expect(result[0].labelId).toBe('label-1');
    expect(result[0].subLabelId).toBeUndefined();
  });

  it('sets empty labelId when parent label not found in store', () => {
    const emptyStore = makeMockStore(new Map());
    const customSublabels: SubLabel[] = [
      { id: 'sl-orphan', parentId: 'missing-label', name: 'orphan' },
    ];

    const boxes: BoundingBox[] = [{ name: 'orphan', x1: 0, y1: 0, x2: 100, y2: 100 }];
    const result = boxesToAnnotationObjects(boxes, 'orphan', customSublabels, emptyStore, 500, 500);

    expect(result[0].labelId).toBe('');
    expect(result[0].subLabelId).toBe('sl-orphan');
  });
});
