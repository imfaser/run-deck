import type Konva from 'konva';

export function canvasToImage(
  canvasX: number,
  canvasY: number,
  group: Konva.Group
): { x: number; y: number } {
  return {
    x: Math.round((canvasX - group.x()) / group.scaleX()),
    y: Math.round((canvasY - group.y()) / group.scaleY()),
  };
}

export function imageToCanvas(
  imageX: number,
  imageY: number,
  group: Konva.Group
): { x: number; y: number } {
  return {
    x: imageX * group.scaleX() + group.x(),
    y: imageY * group.scaleY() + group.y(),
  };
}

export function getPointerImagePos(
  stage: Konva.Stage | null,
  group: Konva.Group | null
): { x: number; y: number } | null {
  if (!stage || !group) {
    return null;
  }
  const pos = stage.getPointerPosition();
  if (!pos) {
    return null;
  }
  return canvasToImage(pos.x, pos.y, group);
}
