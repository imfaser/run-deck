import { describe, it, expect } from 'vitest';
import {
  dbAnnotationToObject,
  dbAnnotationsToObjects,
  objectToDbAnnotation,
  objectsToDbAnnotations,
  type AnnotationObject,
} from '@/lib/annotationMapping';
import { objectColor } from '@/lib/objectColor';
import { isPointInBox, isPointInAnyBox } from '@/lib/spatialConstraint';
import { getPointConfig, getBoxConfig } from '@/lib/annotationConfig';
import type { Annotation } from '@/schemas/annotation';

describe('dbAnnotationToObject', () => {
  it('maps sign and box_type to frontend model', () => {
    const db: Annotation = {
      id: 'a1',
      image_id: 'img-1',
      label_id: 'l1',
      boxes: [
        { id: 'b1', annotation_id: 'a1', box_type: 'Visual', x1: 0, y1: 0, x2: 10, y2: 10 },
        { id: 'b2', annotation_id: 'a1', box_type: 'Annotate', x1: 5, y1: 5, x2: 15, y2: 15 },
      ],
      points: [
        { id: 'p1', annotation_id: 'a1', x: 1, y: 2, sign: 'Positive' },
        { id: 'p2', annotation_id: 'a1', x: 3, y: 4, sign: 'Negative' },
      ],
    };
    const obj = dbAnnotationToObject(db);
    expect(obj.id).toBe('a1');
    expect(obj.labelId).toBe('l1');
    expect(obj.boxes[0].boxType).toBe('visual_ref');
    expect(obj.boxes[1].boxType).toBeUndefined();
    expect(obj.points[0].label).toBe(1);
    expect(obj.points[1].label).toBe(0);
  });
});

describe('objectToDbAnnotation', () => {
  it('maps frontend model back to db input', () => {
    const obj: AnnotationObject = {
      id: 'a1',
      labelId: 'l1',
      boxes: [{ id: 'b1', x1: 0, y1: 0, x2: 10, y2: 10, boxType: 'visual_ref' }],
      points: [{ id: 'p1', x: 1, y: 2, label: 1 }],
    };
    const db = objectToDbAnnotation(obj);
    expect(db.id).toBe('a1');
    expect(db.label_id).toBe('l1');
    expect(db.boxes[0].box_type).toBe('Visual');
    expect(db.points[0].sign).toBe('Positive');
  });

  it('drops empty objects in bulk conversion', () => {
    const objs: AnnotationObject[] = [
      { id: 'a1', labelId: 'l1', boxes: [], points: [] },
      { id: 'a2', labelId: 'l1', boxes: [], points: [{ id: 'p1', x: 1, y: 2, label: 1 }] },
    ];
    const result = objectsToDbAnnotations(objs);
    expect(result.length).toBe(1);
    expect(result[0].id).toBe('a2');
  });
});

describe('round-trip', () => {
  it('preserves structure through both mappings', () => {
    const db: Annotation = {
      id: 'a1',
      image_id: 'img-1',
      label_id: 'l1',
      boxes: [
        { id: 'b1', annotation_id: 'a1', box_type: 'Visual', x1: 0, y1: 0, x2: 10, y2: 10 },
        { id: 'b2', annotation_id: 'a1', box_type: 'Annotate', x1: 5, y1: 5, x2: 15, y2: 15 },
      ],
      points: [
        { id: 'p1', annotation_id: 'a1', x: 1, y: 2, sign: 'Positive' },
        { id: 'p2', annotation_id: 'a1', x: 3, y: 4, sign: 'Negative' },
      ],
    };
    const objects = dbAnnotationsToObjects([db]);
    const inputs = objectsToDbAnnotations(objects);
    expect(inputs.length).toBe(1);
    expect(inputs[0].id).toBe('a1');
    expect(inputs[0].label_id).toBe('l1');
    expect(inputs[0].boxes[0].box_type).toBe('Visual');
    expect(inputs[0].boxes[1].box_type).toBe('Annotate');
    expect(inputs[0].points[0].sign).toBe('Positive');
    expect(inputs[0].points[1].sign).toBe('Negative');
  });
});

describe('objectColor', () => {
  it('returns a stable palette color for the same name', () => {
    expect(objectColor('tumor')).toBe(objectColor('tumor'));
  });

  it('returns different colors for different names (not always)', () => {
    expect(objectColor('a')).toBeTypeOf('string');
    expect(objectColor('a')).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe('spatialConstraint', () => {
  it('isPointInBox checks bounds', () => {
    expect(isPointInBox({ x: 5, y: 5 }, { x1: 0, y1: 0, x2: 10, y2: 10 })).toBe(true);
    expect(isPointInBox({ x: 11, y: 5 }, { x1: 0, y1: 0, x2: 10, y2: 10 })).toBe(false);
  });

  it('isPointInAnyBox checks across boxes', () => {
    const boxes = [
      {
        id: 'b1',
        annotation_id: 'a1',
        box_type: 'Annotate' as const,
        x1: 0,
        y1: 0,
        x2: 10,
        y2: 10,
      },
    ];
    expect(isPointInAnyBox({ x: 5, y: 5 }, boxes)).toBe(true);
    expect(isPointInAnyBox({ x: 50, y: 50 }, boxes)).toBe(false);
  });
});

describe('annotationConfig', () => {
  it('getPointConfig reflects selection and sign', () => {
    const unselected = getPointConfig({ x: 1, y: 2, sign: 'Positive' }, false);
    expect(unselected.radius).toBe(6);
    expect(unselected.fill).toBe('#22c55e');
    expect(unselected.strokeWidth).toBe(2);

    const selected = getPointConfig({ x: 1, y: 2, sign: 'Negative' }, true);
    expect(selected.radius).toBe(8);
    expect(selected.stroke).toBe('#ffffff');
    expect(selected.strokeWidth).toBe(3);
  });

  it('getBoxConfig uses purple dashed stroke for Visual', () => {
    const cfg = getBoxConfig({ x1: 0, y1: 0, x2: 10, y2: 10, box_type: 'Visual' }, false, '#fff');
    expect(cfg.stroke).toBe('#a855f7');
    expect(cfg.dash).toEqual([6, 4]);
  });
});
