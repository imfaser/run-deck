import { describe, it, expect } from 'vitest';
import { KeyframeSchema, KeyframeRecordSchema, SliceSummarySchema } from '@/schemas/keyframe';

describe('KeyframeSchema', () => {
  it('parses valid data with AnnotationObjectSchema', () => {
    const data = {
      objects: [
        {
          id: 'obj-1',
          labelId: 'label-1',
          points: [{ id: 'pt-1', x: 10, y: 20, label: 1 as const }],
          boxes: [],
        },
      ],
      maskUrl: 'blob:http://localhost/mask.png',
      maskVisible: true,
      rawMaskHash: 'abc123',
    };
    expect(KeyframeSchema.parse(data)).toEqual(data);
  });

  it('parses with null mask fields', () => {
    const data = {
      objects: [],
      maskUrl: null,
      maskVisible: false,
      rawMaskHash: null,
    };
    expect(KeyframeSchema.parse(data)).toEqual(data);
  });
});

describe('KeyframeRecordSchema', () => {
  it('extends KeyframeSchema with id/volumeId/sliceIndex', () => {
    const data = {
      objects: [],
      maskUrl: null,
      maskVisible: false,
      rawMaskHash: null,
      volumeId: 'vol-1',
      sliceIndex: 42,
    };
    const result = KeyframeRecordSchema.parse(data);
    expect(result.volumeId).toBe('vol-1');
    expect(result.sliceIndex).toBe(42);
  });

  it('allows optional id', () => {
    const data = {
      objects: [],
      maskUrl: null,
      maskVisible: false,
      rawMaskHash: null,
      id: 7,
      volumeId: 'vol-1',
      sliceIndex: 0,
    };
    expect(KeyframeRecordSchema.parse(data).id).toBe(7);
  });
});

describe('SliceSummarySchema', () => {
  it('parses valid data', () => {
    const data = {
      sliceIndex: 5,
      annotationCount: 3,
      hasMask: true,
      maskVisible: false,
    };
    expect(SliceSummarySchema.parse(data)).toEqual(data);
  });
});
