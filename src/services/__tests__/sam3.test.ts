import { describe, it, expect, vi } from 'vitest';
import type { CallToolResult } from '../cmd';

const mockResult: CallToolResult = {
  content: [{ type: 'text', text: 'mocked mask result' }],
  isError: false,
};

const mcpCallTool = vi.fn().mockResolvedValue(mockResult);

vi.mock('../cmd', () => ({
  mcpCallTool: (...args: unknown[]) => mcpCallTool(...args),
}));

describe('sam3 segmentImage', () => {
  it('valid params call mcpCallTool correctly', async () => {
    const { segmentImage } = await import('../sam3');
    const tmpFile = 'src/services/__tests__/tmp/test-circle.png';

    const result = await segmentImage(tmpFile, { p_point: [[5, 5]] });

    expect(mcpCallTool).toHaveBeenCalledWith('sam3-tracker', 'segment_image', {
      req: {
        image: `base64://${tmpFile}`,
        p_point: [[5, 5]],
      },
    });
    expect(result.isError).toBeFalsy();
    expect(result.content).toBeDefined();
    expect(Array.isArray(result.content)).toBe(true);
    expect(result.content.length).toBeGreaterThan(0);

    const textItem = result.content.find((c) => c.type === 'text');
    expect(textItem).toBeDefined();
    expect(textItem!.type).toBe('text');
    expect((textItem as { type: 'text'; text: string }).text).toBeTruthy();
  });

  it('empty opts throws validation error', async () => {
    const { segmentImage } = await import('../sam3');
    await expect(segmentImage('test.png', {})).rejects.toThrow('至少需要一种提示');
  });

  it('invalid boxes format throws validation error', async () => {
    const { segmentImage } = await import('../sam3');
    await expect(
      segmentImage('test.png', {
        boxes: [[1, 2, 3]] as unknown as [number, number, number, number][],
      })
    ).rejects.toThrow('boxes');
  });
});
