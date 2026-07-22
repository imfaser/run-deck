import { pickBy } from 'es-toolkit';
import { mcpCallTool, mcpStoreContent, type CallToolResult } from './cmd';
import { SegmentOptionsSchema, type SegmentOptions } from '@/schemas/sam3';

export type { SegmentOptions };

export async function segmentImage(
  imagePath: string,
  opts: SegmentOptions
): Promise<CallToolResult> {
  const validated = SegmentOptionsSchema.parse(opts);
  const { p_point, n_point, boxes, prev_mask, multimask_output } = validated;

  const isMcpUrl =
    imagePath.startsWith('mcp://localhost/') || imagePath.startsWith('http://mcp.localhost/');
  const mcpUrl = isMcpUrl ? imagePath : await mcpStoreContent(imagePath);

  const args: Record<string, unknown> = {
    image: mcpUrl,
    ...pickBy(
      {
        p_point: p_point && p_point.length > 0 ? p_point : undefined,
        n_point: n_point && n_point.length > 0 ? n_point : undefined,
        boxes: boxes && boxes.length > 0 ? boxes : undefined,
        prev_mask,
        multimask_output,
      },
      (_v, _k) => _v !== undefined
    ),
  };

  return mcpCallTool('sam3', 'segment_image', { req: args });
}
