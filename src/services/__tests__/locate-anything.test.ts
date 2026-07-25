import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CallToolResult } from '../cmd';

const mcpCallTool = vi.fn();
const mcpStoreContent = vi.fn().mockResolvedValue('mcp://localhost/uploaded');
const logMessage = vi.fn().mockResolvedValue(undefined);

vi.mock('../cmd', () => ({
  mcpCallTool: (...args: unknown[]) => mcpCallTool(...args),
  mcpStoreContent: (...args: unknown[]) => mcpStoreContent(...args),
  logMessage: (...args: unknown[]) => logMessage(...args),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

function makeResult(boxes: unknown[], isError = false): CallToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify({ boxes }) }],
    isError,
  };
}

function makeTextResult(text: string, isError = false): CallToolResult {
  return {
    content: [{ type: 'text', text }],
    isError,
  };
}

function makeEmptyContentResult(): CallToolResult {
  return { content: [] };
}

describe('detectObjects', () => {
  it('returns parsed boxes on success', async () => {
    const { detectObjects } = await import('../locate-anything');
    const boxes = [
      { name: 'cat', x1: 10, y1: 20, x2: 100, y2: 200 },
      { name: 'dog', x1: 300, y1: 400, x2: 500, y2: 600 },
    ];
    mcpCallTool.mockResolvedValue(makeResult(boxes));

    const result = await detectObjects('/path/to/image.png', ['cat', 'dog']);

    expect(mcpStoreContent).toHaveBeenCalledWith('/path/to/image.png');
    expect(mcpCallTool).toHaveBeenCalledWith('locate-anything', 'locate', {
      req: {
        image: 'mcp://localhost/uploaded',
        task: 'detect',
        categories: ['cat', 'dog'],
        generation_mode: 'hybrid',
        max_new_tokens: 8192,
      },
    });
    expect(result).toEqual(boxes);
  });

  it('skips mcpStoreContent for mcp:// URLs', async () => {
    const { detectObjects } = await import('../locate-anything');
    mcpCallTool.mockResolvedValue(makeResult([]));

    await detectObjects('mcp://localhost/abc123', ['cat']);

    expect(mcpStoreContent).not.toHaveBeenCalled();
    expect(mcpCallTool).toHaveBeenCalledWith(
      'locate-anything',
      'locate',
      expect.objectContaining({ req: expect.objectContaining({ image: 'mcp://localhost/abc123' }) })
    );
  });

  it('skips mcpStoreContent for http://mcp.localhost/ URLs', async () => {
    const { detectObjects } = await import('../locate-anything');
    mcpCallTool.mockResolvedValue(makeResult([]));

    await detectObjects('http://mcp.localhost/abc123', ['cat']);

    expect(mcpStoreContent).not.toHaveBeenCalled();
  });

  it('throws on result.isError', async () => {
    const { detectObjects } = await import('../locate-anything');
    mcpCallTool.mockResolvedValue(makeTextResult('model overloaded', true));

    await expect(detectObjects('/img.png', ['cat'])).rejects.toThrow(
      'Locate Anything detect error: model overloaded'
    );
  });

  it('throws with "unknown error" when isError and no text block', async () => {
    const { detectObjects } = await import('../locate-anything');
    mcpCallTool.mockResolvedValue({
      content: [{ type: 'image', data: 'base64', mimeType: 'image/png' }],
      isError: true,
    });

    await expect(detectObjects('/img.png', ['cat'])).rejects.toThrow(
      'Locate Anything detect error: unknown error'
    );
  });

  it('returns empty array when content has no text block', async () => {
    const { detectObjects } = await import('../locate-anything');
    mcpCallTool.mockResolvedValue(makeEmptyContentResult());

    const result = await detectObjects('/img.png', ['cat']);
    expect(result).toEqual([]);
  });

  it('returns empty array when JSON is invalid', async () => {
    const { detectObjects } = await import('../locate-anything');
    mcpCallTool.mockResolvedValue(makeTextResult('not json'));

    const result = await detectObjects('/img.png', ['cat']);
    expect(result).toEqual([]);
    expect(logMessage).toHaveBeenCalledWith(
      'error',
      expect.stringContaining('parseDetectionResult failed')
    );
  });

  it('returns empty array when schema validation fails', async () => {
    const { detectObjects } = await import('../locate-anything');
    mcpCallTool.mockResolvedValue(makeTextResult(JSON.stringify({ not_boxes: [] })));

    const result = await detectObjects('/img.png', ['cat']);
    expect(result).toEqual([]);
    expect(logMessage).toHaveBeenCalledWith(
      'error',
      expect.stringContaining('parseDetectionResult failed')
    );
  });

  it('returns empty array for valid JSON with empty boxes', async () => {
    const { detectObjects } = await import('../locate-anything');
    mcpCallTool.mockResolvedValue(makeResult([]));

    const result = await detectObjects('/img.png', ['cat']);
    expect(result).toEqual([]);
  });
});

describe('detectVisual', () => {
  it('returns parsed boxes on success', async () => {
    const { detectVisual } = await import('../locate-anything');
    const boxes = [{ name: 'target', x1: 50, y1: 50, x2: 200, y2: 200 }];
    mcpCallTool.mockResolvedValue(makeResult(boxes));

    const result = await detectVisual('/path/to/image.png', [10, 20, 30, 40]);

    expect(mcpCallTool).toHaveBeenCalledWith('locate-anything', 'locate', {
      req: {
        image: 'mcp://localhost/uploaded',
        task: 'detect_visual',
        visual_prompt_box: [10, 20, 30, 40],
        generation_mode: 'hybrid',
        max_new_tokens: 8192,
      },
    });
    expect(result).toEqual(boxes);
  });

  it('skips mcpStoreContent for mcp:// URLs', async () => {
    const { detectVisual } = await import('../locate-anything');
    mcpCallTool.mockResolvedValue(makeResult([]));

    await detectVisual('mcp://localhost/xyz', [0, 0, 100, 100]);

    expect(mcpStoreContent).not.toHaveBeenCalled();
  });

  it('throws on result.isError', async () => {
    const { detectVisual } = await import('../locate-anything');
    mcpCallTool.mockResolvedValue(makeTextResult('visual prompt too large', true));

    await expect(detectVisual('/img.png', [0, 0, 100, 100])).rejects.toThrow(
      'Locate Anything detect_visual error: visual prompt too large'
    );
  });
});
