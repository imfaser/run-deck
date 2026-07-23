import type { AnnotationObject } from '@/schemas/annotation';
import type { MCPRequest, MCPObject } from '@/schemas/sam3';
import { isPointInBox } from '@/utils/spatialConstraint';

export function toMCPRequest(
  objects: AnnotationObject[],
  image: string,
  prevMask?: string
): MCPRequest {
  const mcpObjects: MCPObject[] = [];

  for (const obj of objects) {
    if (obj.points.length === 0 && obj.boxes.length === 0) continue;

    if (obj.boxes.length === 0) {
      // No boxes — all points go into one MCP Object
      mcpObjects.push({
        points: obj.points.map((p) => ({ coords: [p.x, p.y] as [number, number], label: p.label })),
      });
    } else {
      // For each box, collect points inside it
      for (const box of obj.boxes) {
        const pointsInBox = obj.points.filter((p) => isPointInBox(p, box));
        mcpObjects.push({
          points: pointsInBox.map((p) => ({
            coords: [p.x, p.y] as [number, number],
            label: p.label,
          })),
          box: { coords: [box.x1, box.y1, box.x2, box.y2] },
        });
      }

      // Points not in any box — shouldn't happen due to spatial constraint,
      // but handle gracefully: put them in a separate object with no box
      const orphanPoints = obj.points.filter((p) => !obj.boxes.some((box) => isPointInBox(p, box)));
      if (orphanPoints.length > 0) {
        mcpObjects.push({
          points: orphanPoints.map((p) => ({
            coords: [p.x, p.y] as [number, number],
            label: p.label,
          })),
        });
      }
    }
  }

  const req: MCPRequest = {
    image,
    objects: mcpObjects,
  };
  if (prevMask) req.prev_mask = prevMask;

  return req;
}
