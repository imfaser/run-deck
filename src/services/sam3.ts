import { mcpCallTool, mcpStoreContent, type CallToolResult } from './cmd';
import { MCPRequestSchema } from '@/schemas/sam3';
import type { AnnotationObject } from '@/schemas/annotation';
import { toMCPRequest } from './annotationTransform';

export async function segmentImage(
  imagePath: string,
  objects: AnnotationObject[],
  prevMask?: string
): Promise<CallToolResult> {
  const isMcpUrl =
    imagePath.startsWith('mcp://localhost/') || imagePath.startsWith('http://mcp.localhost/');
  const mcpUrl = isMcpUrl ? imagePath : await mcpStoreContent(imagePath);

  const mcpReq = toMCPRequest(objects, mcpUrl, prevMask);
  const validated = MCPRequestSchema.parse(mcpReq);

  return mcpCallTool('sam3', 'segment_image', { req: validated });
}
