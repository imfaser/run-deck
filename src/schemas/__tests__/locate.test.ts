import { describe, it, expect } from 'vitest';
import { LocateConfigSchema, DetectProgressSchema } from '@/schemas/locate';

describe('LocateConfigSchema', () => {
  it('parses valid data', () => {
    const data = {
      labelId: 'label-1',
      mode: 'detect' as const,
      visualType: 'slice_crop' as const,
      visualRefObjectId: null,
      visualRefImagePath: null,
      rangeStart: 0,
      rangeEnd: 100,
    };
    expect(LocateConfigSchema.parse(data)).toEqual(data);
  });

  it('parses detect_visual mode', () => {
    const data = {
      labelId: 'label-1',
      mode: 'detect_visual' as const,
      visualType: 'external_image' as const,
      visualRefObjectId: 'obj-1',
      visualRefImagePath: '/path/to/image.png',
      rangeStart: 10,
      rangeEnd: 50,
    };
    expect(LocateConfigSchema.parse(data)).toEqual(data);
  });
});

describe('DetectProgressSchema', () => {
  it('parses valid data with all statuses', () => {
    const statuses = ['idle', 'running', 'done', 'error'] as const;
    for (const status of statuses) {
      const data = {
        labelId: 'label-1',
        current: 10,
        total: 100,
        status,
      };
      expect(DetectProgressSchema.parse(data).status).toBe(status);
    }
  });

  it('parses with optional error', () => {
    const data = {
      labelId: 'label-1',
      current: 10,
      total: 100,
      status: 'error' as const,
      error: 'something went wrong',
    };
    expect(DetectProgressSchema.parse(data).error).toBe('something went wrong');
  });
});
