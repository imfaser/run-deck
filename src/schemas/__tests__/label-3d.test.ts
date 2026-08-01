import { describe, it, expect } from 'vitest';
import { AnnotationSchema, AnnotationCountSchema, NearestVisualSchema } from '@/schemas/annotation';
import { ImageSchema } from '@/schemas/image';
import { LabelSchema } from '@/schemas/label';
import { SliceResponseSchema, OpenVolumeResponseSchema } from '@/schemas/volume';

describe('LabelSchema', () => {
  it('accepts a valid label', () => {
    expect(
      LabelSchema.parse({ id: 'x', name: 'tumor', color: '#ff0000', order: 1, sub_labels: [] })
    ).toEqual({ id: 'x', name: 'tumor', color: '#ff0000', order: 1, sub_labels: [] });
  });

  it('rejects missing name', () => {
    expect(() => LabelSchema.parse({ id: 'x', color: '#ff0000', order: 1 })).toThrow();
  });
});

describe('AnnotationSchema', () => {
  it('accepts an annotation with nested boxes and points', () => {
    const result = AnnotationSchema.parse({
      id: 'a1',
      image_id: 'img-1',
      label_id: 'l1',
      boxes: [
        { id: 'b1', annotation_id: 'a1', box_type: 'Annotate', x1: 0, y1: 0, x2: 10, y2: 10 },
      ],
      points: [{ id: 'p1', annotation_id: 'a1', x: 5, y: 5, sign: 'Positive' }],
    });
    expect(result.boxes[0].box_type).toBe('Annotate');
    expect(result.points[0].sign).toBe('Positive');
  });

  it('accepts Visual box type', () => {
    const result = AnnotationSchema.parse({
      id: 'a1',
      image_id: 'img-1',
      label_id: 'l1',
      boxes: [{ id: 'b1', annotation_id: 'a1', box_type: 'Visual', x1: 0, y1: 0, x2: 10, y2: 10 }],
      points: [],
    });
    expect(result.boxes[0].box_type).toBe('Visual');
  });

  it('rejects unknown point sign', () => {
    expect(() =>
      AnnotationSchema.parse({
        id: 'a1',
        image_id: 'img-1',
        label_id: 'l1',
        boxes: [],
        points: [{ id: 'p1', annotation_id: 'a1', x: 5, y: 5, sign: 'Maybe' }],
      })
    ).toThrow();
  });
});

describe('ImageSchema', () => {
  it('accepts a slice image', () => {
    expect(
      ImageSchema.parse({
        hash: 'h1',
        image_name: null,
        width: 512,
        height: 512,
        image_type: 'Slice',
        volume_id: 'v1',
        slice_index: 3,
        mask_hash: null,
      }).image_type
    ).toBe('Slice');
  });
});

describe('SliceResponseSchema / OpenVolumeResponseSchema', () => {
  it('accepts a slice response', () => {
    const result = SliceResponseSchema.parse({
      data: [0, 1, 2],
      width: 3,
      height: 1,
      min: 0,
      max: 2,
      imageHash: 'abc',
    });
    expect(result.imageHash).toBe('abc');
  });

  it('accepts an open volume response', () => {
    expect(
      OpenVolumeResponseSchema.parse({
        volumeId: 'v1',
        totalSlices: 10,
        sliceWidth: 512,
        sliceHeight: 512,
      }).totalSlices
    ).toBe(10);
  });
});

describe('AnnotationCountSchema / NearestVisualSchema', () => {
  it('accepts annotation count', () => {
    expect(
      AnnotationCountSchema.parse({ imageHash: 'h1', sliceIndex: 2, annotationCount: 3 })
        .annotationCount
    ).toBe(3);
  });

  it('accepts nearest visual', () => {
    expect(
      NearestVisualSchema.parse({
        box_id: 'b1',
        x1: 0,
        y1: 0,
        x2: 10,
        y2: 10,
        image_hash: 'h2',
        slice_index: 5,
        image_name: null,
      }).image_hash
    ).toBe('h2');
  });
});
