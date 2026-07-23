import { describe, it, expect, vi } from 'vitest';
import type { CallToolResult } from '../cmd';
import type { AnnotationObject } from '@/schemas/annotation';

const mockResult: CallToolResult = {
  content: [{ type: 'text', text: 'mocked mask result' }],
  isError: false,
};

const mcpCallTool = vi.fn().mockResolvedValue(mockResult);
const mcpStoreContent = vi.fn().mockResolvedValue('mcp://localhost/abc123');

vi.mock('../cmd', () => ({
  mcpCallTool: (...args: unknown[]) => mcpCallTool(...args),
  mcpStoreContent: (...args: unknown[]) => mcpStoreContent(...args),
}));

describe('sam3 segmentImage', () => {
  it('calls mcpCallTool with objects transformed to MCPRequest format', async () => {
    const { segmentImage } = await import('../sam3');
    const tmpFile = 'src/services/__tests__/tmp/test-circle.png';

    const objects: AnnotationObject[] = [
      {
        id: 'obj-1',
        name: 'car',
        color: '#ff3b30',
        points: [{ id: 'p1', x: 5, y: 5, label: 1 }],
        boxes: [],
      },
    ];

    const result = await segmentImage(tmpFile, objects);

    expect(mcpStoreContent).toHaveBeenCalledWith(tmpFile);
    expect(mcpCallTool).toHaveBeenCalledWith('sam3', 'segment_image', {
      req: {
        image: 'mcp://localhost/abc123',
        objects: [
          {
            points: [{ coords: [5, 5], label: 1 }],
          },
        ],
      },
    });
    expect(result.isError).toBeFalsy();
  });

  it('transforms box and points into MCPRequest correctly', async () => {
    const { segmentImage } = await import('../sam3');
    mcpCallTool.mockClear();

    const objects: AnnotationObject[] = [
      {
        id: 'obj-1',
        name: 'car',
        color: '#ff3b30',
        points: [
          { id: 'p1', x: 50, y: 50, label: 1 },
          { id: 'p2', x: 200, y: 200, label: 0 },
        ],
        boxes: [{ id: 'b1', x1: 0, y1: 0, x2: 100, y2: 100 }],
      },
    ];

    await segmentImage('test.png', objects);

    const callArgs = mcpCallTool.mock.calls[0][2] as { req: { objects: unknown[] } };
    const mcpObjects = callArgs.req.objects;

    // p1 (50,50) is inside box (0,0,100,100), p2 (200,200) is outside
    expect(mcpObjects).toHaveLength(2); // one for box+points inside, one for orphan points
    expect(mcpObjects[0]).toEqual({
      points: [{ coords: [50, 50], label: 1 }],
      box: { coords: [0, 0, 100, 100] },
    });
    expect(mcpObjects[1]).toEqual({
      points: [{ coords: [200, 200], label: 0 }],
    });
  });

  it('empty objects throws validation error', async () => {
    const { segmentImage } = await import('../sam3');
    await expect(segmentImage('test.png', [])).rejects.toThrow();
  });
});
