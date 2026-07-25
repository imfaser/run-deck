import { describe, it, expect } from 'vitest';
import {
  PointAnnotationSchema,
  BoxAnnotationSchema,
  AnnotationSchema,
  LabelModeSchema,
  AnnotationTypeSchema,
  AnnotationObjectSchema,
} from '@/schemas/annotation';

describe('PointAnnotationSchema', () => {
  it('parses positive point (label=1)', () => {
    const result = PointAnnotationSchema.parse({ id: 'p1', x: 10, y: 20, label: 1 });
    expect(result.label).toBe(1);
    expect(result.x).toBe(10);
    expect(result.y).toBe(20);
  });

  it('parses negative point (label=0)', () => {
    const result = PointAnnotationSchema.parse({ id: 'n1', x: 5, y: 15, label: 0 });
    expect(result.label).toBe(0);
  });

  it('rejects missing fields', () => {
    expect(() => PointAnnotationSchema.parse({ id: 'p1', x: 10, label: 1 })).toThrow();
  });

  it('rejects invalid label', () => {
    expect(() => PointAnnotationSchema.parse({ id: 'p1', x: 10, y: 20, label: 2 })).toThrow();
  });
});

describe('BoxAnnotationSchema', () => {
  it('parses valid box', () => {
    const result = BoxAnnotationSchema.parse({
      id: 'b1',
      x1: 0,
      y1: 0,
      x2: 100,
      y2: 100,
    });
    expect(result.x2).toBe(100);
  });
});

describe('AnnotationSchema', () => {
  it('parses point annotation', () => {
    const point = AnnotationSchema.parse({ id: 'p1', x: 1, y: 2, label: 1 });
    expect('label' in point).toBe(true);
  });

  it('parses box annotation', () => {
    const box = AnnotationSchema.parse({ id: 'b1', x1: 0, y1: 0, x2: 10, y2: 10 });
    expect('x1' in box).toBe(true);
  });
});

describe('AnnotationObjectSchema', () => {
  it('parses valid object', () => {
    const obj = AnnotationObjectSchema.parse({
      id: 'obj-1',
      labelId: 'label-car',
      points: [{ id: 'p1', x: 10, y: 20, label: 1 }],
      boxes: [{ id: 'b1', x1: 0, y1: 0, x2: 100, y2: 100 }],
    });
    expect(obj.labelId).toBe('label-car');
    expect(obj.points).toHaveLength(1);
    expect(obj.boxes).toHaveLength(1);
  });

  it('parses object with empty arrays', () => {
    const obj = AnnotationObjectSchema.parse({
      id: 'obj-1',
      labelId: 'label-car',
      points: [],
      boxes: [],
    });
    expect(obj.points).toHaveLength(0);
    expect(obj.boxes).toHaveLength(0);
  });
});

describe('LabelModeSchema', () => {
  it('accepts valid modes', () => {
    expect(LabelModeSchema.parse('select')).toBe('select');
    expect(LabelModeSchema.parse('create')).toBe('create');
    expect(LabelModeSchema.parse('delete')).toBe('delete');
  });

  it('rejects invalid mode', () => {
    expect(() => LabelModeSchema.parse('edit')).toThrow();
  });
});

describe('AnnotationTypeSchema', () => {
  it('accepts valid types', () => {
    expect(AnnotationTypeSchema.parse('p_point')).toBe('p_point');
    expect(AnnotationTypeSchema.parse('n_point')).toBe('n_point');
    expect(AnnotationTypeSchema.parse('box')).toBe('box');
  });
});
