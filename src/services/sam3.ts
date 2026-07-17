import { mcpCallTool, type CallToolResult } from './cmd';

export interface SegmentOptions {
  p_point?: [number, number][];
  n_point?: [number, number][];
  boxes?: [number, number, number, number][];
  prev_mask?: string;
  multimask_output?: boolean;
}

export async function segmentImage(
  imagePath: string,
  opts: SegmentOptions
): Promise<CallToolResult> {
  const { p_point, n_point, boxes, prev_mask, multimask_output } = opts;

  const hasPrompt =
    (p_point && p_point.length > 0) ||
    (n_point && n_point.length > 0) ||
    (boxes && boxes.length > 0) ||
    prev_mask;

  if (!hasPrompt) {
    throw new Error('至少需要一种提示：p_point, n_point, boxes, 或 prev_mask');
  }

  if (boxes) {
    for (let i = 0; i < boxes.length; i++) {
      if (boxes[i].length !== 4) {
        throw new Error(
          `boxes[${i}] 需要恰好 4 个值 [x1, y1, x2, y2]，实际为 ${boxes[i].length} 个`
        );
      }
    }
  }

  const args: Record<string, unknown> = { image: `base64://${imagePath}` };
  if (p_point && p_point.length > 0) args.p_point = p_point;
  if (n_point && n_point.length > 0) args.n_point = n_point;
  if (boxes && boxes.length > 0) args.boxes = boxes;
  if (prev_mask) args.prev_mask = prev_mask;
  if (multimask_output !== undefined) args.multimask_output = multimask_output;

  return mcpCallTool('sam3', 'segment_image', { req: args });
}
