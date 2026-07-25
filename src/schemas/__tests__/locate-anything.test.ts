import { describe, it, expect } from 'vitest';
import {
  LocateRequestSchema,
  BoundingBoxSchema,
  DetectionResultSchema,
} from '@/schemas/locate-anything';

describe('LocateRequestSchema', () => {
  it('parses detect request', () => {
    const result = LocateRequestSchema.parse({
      image: 'mcp://localhost/abc123',
      task: 'detect',
      categories: ['白色矩形', '大矩形'],
    });
    expect(result.task).toBe('detect');
    expect(result.categories).toEqual(['白色矩形', '大矩形']);
    expect(result.generation_mode).toBe('hybrid');
    expect(result.max_new_tokens).toBe(8192);
  });

  it('parses detect_visual request', () => {
    const result = LocateRequestSchema.parse({
      image: 'mcp://localhost/abc123',
      task: 'detect_visual',
      visual_prompt_box: [100, 200, 300, 400],
    });
    expect(result.task).toBe('detect_visual');
    expect(result.visual_prompt_box).toEqual([100, 200, 300, 400]);
  });

  it('rejects invalid task', () => {
    expect(() =>
      LocateRequestSchema.parse({
        image: 'mcp://localhost/abc123',
        task: 'invalid',
      })
    ).toThrow();
  });
});

describe('BoundingBoxSchema', () => {
  it('parses valid bounding box', () => {
    const result = BoundingBoxSchema.parse({
      name: '白色矩形',
      x1: 100,
      y1: 200,
      x2: 500,
      y2: 600,
    });
    expect(result.name).toBe('白色矩形');
    expect(result.x1).toBe(100);
    expect(result.y2).toBe(600);
  });

  it('rejects missing fields', () => {
    expect(() =>
      BoundingBoxSchema.parse({
        name: '白色矩形',
        x1: 100,
        y1: 200,
      })
    ).toThrow();
  });
});

describe('DetectionResultSchema', () => {
  it('parses result with multiple boxes', () => {
    const result = DetectionResultSchema.parse({
      boxes: [
        { name: '白色矩形', x1: 100, y1: 200, x2: 500, y2: 600 },
        { name: '大矩形', x1: 50, y1: 50, x2: 800, y2: 900 },
      ],
    });
    expect(result.boxes).toHaveLength(2);
    expect(result.boxes[0].name).toBe('白色矩形');
    expect(result.boxes[1].name).toBe('大矩形');
  });

  it('parses empty result', () => {
    const result = DetectionResultSchema.parse({ boxes: [] });
    expect(result.boxes).toHaveLength(0);
  });

  it('parses result with large number of boxes', () => {
    const boxes = Array.from({ length: 100 }, (_, i) => ({
      name: `box-${i}`,
      x1: i,
      y1: i,
      x2: i + 10,
      y2: i + 10,
    }));
    const result = DetectionResultSchema.parse({ boxes });
    expect(result.boxes).toHaveLength(100);
    expect(result.boxes[99].name).toBe('box-99');
  });
});

describe('LocateRequestSchema - edge cases', () => {
  it('parses request with all optional fields', () => {
    const result = LocateRequestSchema.parse({
      image: 'mcp://localhost/abc123',
      task: 'detect_visual',
      categories: ['cat1', 'cat2'],
      visual_prompt_box: [0, 0, 500, 500],
      generation_mode: 'precise',
      max_new_tokens: 4096,
    });
    expect(result.task).toBe('detect_visual');
    expect(result.categories).toEqual(['cat1', 'cat2']);
    expect(result.visual_prompt_box).toEqual([0, 0, 500, 500]);
    expect(result.generation_mode).toBe('precise');
    expect(result.max_new_tokens).toBe(4096);
  });

  it('applies defaults for generation_mode and max_new_tokens', () => {
    const result = LocateRequestSchema.parse({
      image: 'mcp://localhost/abc',
      task: 'detect',
    });
    expect(result.generation_mode).toBe('hybrid');
    expect(result.max_new_tokens).toBe(8192);
  });

  it('rejects missing image field', () => {
    expect(() => LocateRequestSchema.parse({ task: 'detect' })).toThrow();
  });
});

describe('BoundingBoxSchema - edge cases', () => {
  it('parses box with zero coordinates', () => {
    const result = BoundingBoxSchema.parse({
      name: 'point',
      x1: 0,
      y1: 0,
      x2: 0,
      y2: 0,
    });
    expect(result.x1).toBe(0);
    expect(result.y1).toBe(0);
    expect(result.x2).toBe(0);
    expect(result.y2).toBe(0);
  });

  it('parses box with negative coordinates', () => {
    const result = BoundingBoxSchema.parse({
      name: 'neg',
      x1: -10,
      y1: -20,
      x2: 100,
      y2: 200,
    });
    expect(result.x1).toBe(-10);
    expect(result.y1).toBe(-20);
  });

  it('parses box with fractional coordinates', () => {
    const result = BoundingBoxSchema.parse({
      name: 'frac',
      x1: 0.5,
      y1: 1.3,
      x2: 99.9,
      y2: 100.1,
    });
    expect(result.x1).toBe(0.5);
    expect(result.y2).toBe(100.1);
  });
});
