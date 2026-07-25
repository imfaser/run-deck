import { mcpCallTool, mcpStoreContent, mcpStoreImageBytes, type CallToolResult } from './cmd';
import {
  DetectionResultSchema,
  type BoundingBox,
  type DetectionResult,
} from '@/schemas/locate-anything';
import { logMessage } from '@/services/cmd';

export type { BoundingBox, DetectionResult };

interface PixelBoundingBox {
  name: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

async function parseDetectionResult(result: CallToolResult): Promise<PixelBoundingBox[]> {
  const textBlock = result.content.find((b) => b.type === 'text');
  if (!textBlock || !('text' in textBlock)) {
    await logMessage('warn', '[locate-anything] no text block in result');
    return [];
  }

  try {
    await logMessage(
      'debug',
      `[locate-anything] raw response: ${textBlock.text.substring(0, 200)}...`
    );
    const parsed = JSON.parse(textBlock.text);
    const validated = DetectionResultSchema.parse(parsed);
    await logMessage('info', `[locate-anything] parsed ${validated.boxes.length} boxes`);
    return validated.boxes;
  } catch (e) {
    await logMessage('error', `[locate-anything] parseDetectionResult failed: ${e}`);
    return [];
  }
}

async function ensureMcpUrl(imagePath: string): Promise<string> {
  const isMcpUrl =
    imagePath.startsWith('mcp://localhost/') || imagePath.startsWith('http://mcp.localhost/');
  if (isMcpUrl) {
    await logMessage(
      'debug',
      `[locate-anything] image already MCP URL: ${imagePath.substring(0, 50)}...`
    );
    return imagePath;
  }
  await logMessage(
    'info',
    `[locate-anything] storing local image to MCP: ${imagePath.substring(0, 50)}...`
  );
  const mcpUrl = await mcpStoreContent(imagePath);
  await logMessage('info', `[locate-anything] stored as MCP URL: ${mcpUrl.substring(0, 50)}...`);
  return mcpUrl;
}

export async function cropImageRegion(
  imagePath: string,
  box: { x1: number; y1: number; x2: number; y2: number }
): Promise<string> {
  await logMessage(
    'info',
    `[locate-anything] cropImageRegion: box=[${box.x1},${box.y1},${box.x2},${box.y2}]`
  );
  const isMcpUrl =
    imagePath.startsWith('mcp://localhost/') || imagePath.startsWith('http://mcp.localhost/');

  let imageSource: string;
  if (isMcpUrl) {
    imageSource = imagePath;
  } else {
    imageSource = await mcpStoreContent(imagePath);
  }

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = async () => {
      const x = Math.max(0, Math.round(box.x1));
      const y = Math.max(0, Math.round(box.y1));
      const w = Math.min(Math.round(box.x2 - box.x1), img.width - x);
      const h = Math.min(Math.round(box.y2 - box.y1), img.height - y);

      await logMessage(
        'info',
        `[locate-anything] cropping: src=[${x},${y},${w},${h}] imgSize=[${img.width},${img.height}]`
      );

      canvas.width = w;
      canvas.height = h;
      ctx.drawImage(img, x, y, w, h, 0, 0, w, h);

      try {
        const dataUrl = canvas.toDataURL('image/png');
        const base64 = dataUrl.split(',')[1];
        const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
        const mcpUrl = await mcpStoreImageBytes(Array.from(bytes), 'image/png');
        await logMessage(
          'info',
          `[locate-anything] cropped image stored as: ${mcpUrl.substring(0, 50)}...`
        );
        resolve(mcpUrl);
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = () => reject(new Error('Failed to load image for cropping'));
    img.src = imageSource;
  });
}

export async function detectObjects(
  imagePath: string,
  categories: string[]
): Promise<PixelBoundingBox[]> {
  await logMessage(
    'info',
    `[locate-anything] detectObjects called: categories=${JSON.stringify(categories)}`
  );
  const mcpUrl = await ensureMcpUrl(imagePath);

  await logMessage(
    'info',
    `[locate-anything] calling MCP locate with image=${mcpUrl.substring(0, 50)}...`
  );
  const result = await mcpCallTool('locate-anything', 'locate', {
    req: {
      image: mcpUrl,
      task: 'detect',
      categories,
      generation_mode: 'hybrid',
      max_new_tokens: 8192,
    },
  });

  if (result.isError) {
    const textBlock = result.content.find((b) => b.type === 'text');
    const msg = textBlock && 'text' in textBlock ? textBlock.text : 'unknown error';
    await logMessage('error', `[locate-anything] MCP detect error: ${msg}`);
    throw new Error(`Locate Anything detect error: ${msg}`);
  }

  return parseDetectionResult(result);
}

export async function detectVisual(
  imagePath: string,
  box: [number, number, number, number],
  visualPromptImage?: string
): Promise<PixelBoundingBox[]> {
  await logMessage(
    'info',
    `[locate-anything] detectVisual called: box=${JSON.stringify(box)} visualPromptImage=${visualPromptImage ? 'provided' : 'none'}`
  );
  const mcpUrl = await ensureMcpUrl(imagePath);

  const args: Record<string, unknown> = {
    image: mcpUrl,
    task: 'detect_visual',
    visual_prompt_box: box,
    generation_mode: 'hybrid',
    max_new_tokens: 8192,
  };

  if (visualPromptImage) {
    const promptMcpUrl = await ensureMcpUrl(visualPromptImage);
    args.visual_prompt = promptMcpUrl;
    await logMessage(
      'info',
      `[locate-anything] visual prompt image: ${promptMcpUrl.substring(0, 50)}...`
    );
  }

  await logMessage('info', `[locate-anything] calling MCP locate (visual)`);
  const result = await mcpCallTool('locate-anything', 'locate', { req: args });

  if (result.isError) {
    const textBlock = result.content.find((b) => b.type === 'text');
    const msg = textBlock && 'text' in textBlock ? textBlock.text : 'unknown error';
    await logMessage('error', `[locate-anything] MCP detect_visual error: ${msg}`);
    throw new Error(`Locate Anything detect_visual error: ${msg}`);
  }

  return parseDetectionResult(result);
}
