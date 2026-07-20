import { describe, it, expect } from 'vitest';
import {
  PointAnnotationSchema,
  BoxAnnotationSchema,
  AnnotationSchema,
  LabelModeSchema,
  AnnotationTypeSchema,
} from '@/schemas/annotation';

describe('PointAnnotationSchema', () => {
  it('parses positive point', () => {
    const result = PointAnnotationSchema.parse({ id: 'p1', type: 'p_point', x: 10, y: 20 });
    expect(result.type).toBe('p_point');
    expect(result.x).toBe(10);
    expect(result.y).toBe(20);
  });

  it('parses negative point', () => {
    const result = PointAnnotationSchema.parse({ id: 'n1', type: 'n_point', x: 5, y: 15 });
    expect(result.type).toBe('n_point');
  });

  it('rejects missing fields', () => {
    expect(() => PointAnnotationSchema.parse({ id: 'p1', type: 'p_point', x: 10 })).toThrow();
  });
});

describe('BoxAnnotationSchema', () => {
  it('parses valid box', () => {
    const result = BoxAnnotationSchema.parse({
      id: 'b1',
      type: 'box',
      x1: 0,
      y1: 0,
      x2: 100,
      y2: 100,
    });
    expect(result.type).toBe('box');
    expect(result.x2).toBe(100);
  });
});

describe('AnnotationSchema', () => {
  it('discriminates on type field', () => {
    const point = AnnotationSchema.parse({ id: 'p1', type: 'p_point', x: 1, y: 2 });
    expect(point.type).toBe('p_point');

    const box = AnnotationSchema.parse({ id: 'b1', type: 'box', x1: 0, y1: 0, x2: 10, y2: 10 });
    expect(box.type).toBe('box');
  });

  it('rejects unknown type', () => {
    expect(() => AnnotationSchema.parse({ id: 'x', type: 'unknown', x: 0, y: 0 })).toThrow();
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
