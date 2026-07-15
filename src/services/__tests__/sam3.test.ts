import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { Client, type CallToolResult } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';

let client: Client;
let transport: StdioClientTransport;

vi.mock('../cmd', () => ({
  mcpCallTool: async (
    serverName: string,
    toolName: string,
    args?: Record<string, unknown>
  ): Promise<CallToolResult> => {
    return client.callTool({ name: toolName, arguments: args });
  },
}));

beforeAll(async () => {
  transport = new StdioClientTransport({
    command: 'sam3-tracker',
    args: [],
  });
  client = new Client({ name: 'test-harness', version: '1.0.0' });
  await client.connect(transport);
}, 30000);

afterAll(async () => {
  if (client) {
    await client.close();
  }
});

describe('sam3 segmentImage', () => {
  it('valid params call mcpCallTool correctly', async () => {
    const { segmentImage } = await import('../sam3');
    const fs = require('fs');
    const path = require('path');
    const tmpFile = path.join(
      process.cwd(),
      'src',
      'services',
      '__tests__',
      'tmp',
      'test-circle.png'
    );

    if (!fs.existsSync(tmpFile)) {
      throw new Error(
        `Test PNG not found at ${tmpFile}. Run: python -c "from PIL import Image; Image.new('RGB', (10, 10), (255, 0, 0)).save('src/services/__tests__/tmp/test-circle.png')"`
      );
    }

    const result = await segmentImage(tmpFile, { p_point: [[5, 5]] });

    expect(result.isError).toBeFalsy();
    expect(result.content).toBeDefined();
    expect(Array.isArray(result.content)).toBe(true);
    expect(result.content.length).toBeGreaterThan(0);

    const textItem = result.content.find((c) => c.type === 'text');
    expect(textItem).toBeDefined();
    expect(textItem!.type).toBe('text');
    expect((textItem as { type: 'text'; text: string }).text).toBeTruthy();
  }, 30000);

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
