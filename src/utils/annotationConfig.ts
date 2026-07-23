import { match } from 'ts-pattern';
import type { PointAnnotation, BoxAnnotation } from '@/schemas/annotation';

export function getPointConfig(ann: PointAnnotation, isSelected: boolean, objectColor: string) {
  return {
    x: ann.x,
    y: ann.y,
    radius: match(isSelected)
      .with(true, () => 8)
      .otherwise(() => 6),
    fill: objectColor,
    stroke: match(isSelected)
      .with(true, () => '#ffffff')
      .otherwise(() => objectColor),
    strokeWidth: match(isSelected)
      .with(true, () => 3)
      .otherwise(() => 2),
    shadowColor: match(isSelected)
      .with(true, () => objectColor)
      .otherwise(() => undefined),
    shadowBlur: match(isSelected)
      .with(true, () => 12)
      .otherwise(() => 0),
    shadowOpacity: match(isSelected)
      .with(true, () => 0.8)
      .otherwise(() => 0),
    name: ann.id,
    draggable: false,
    hitStrokeWidth: 12,
  };
}

export function getBoxConfig(ann: BoxAnnotation, isSelected: boolean, objectColor: string) {
  return {
    x: ann.x1,
    y: ann.y1,
    width: ann.x2 - ann.x1,
    height: ann.y2 - ann.y1,
    stroke: match(isSelected)
      .with(true, () => '#ffffff')
      .otherwise(() => objectColor),
    strokeWidth: match(isSelected)
      .with(true, () => 3)
      .otherwise(() => 2),
    strokeScaleEnabled: false,
    fill: 'rgba(0,0,0,0.05)',
    name: ann.id,
    draggable: false,
    hitStrokeWidth: 12,
  };
}
