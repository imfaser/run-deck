import { match } from 'ts-pattern';

export const POSITIVE_COLOR = '#22c55e';
export const NEGATIVE_COLOR = '#ef4444';

export interface PointLike {
  x: number;
  y: number;
  sign?: 'Positive' | 'Negative' | 0 | 1;
}

export function getPointConfig(ann: PointLike, isSelected: boolean) {
  const isPositive = ann.sign === 'Positive' || ann.sign === 1;
  const labelColor = isPositive ? POSITIVE_COLOR : NEGATIVE_COLOR;
  return {
    x: ann.x,
    y: ann.y,
    radius: match(isSelected)
      .with(true, () => 8)
      .otherwise(() => 6),
    fill: match(isSelected)
      .with(true, () => labelColor)
      .otherwise(() => (isPositive ? labelColor : 'transparent')),
    stroke: match(isSelected)
      .with(true, () => '#ffffff')
      .otherwise(() => labelColor),
    strokeWidth: match(isSelected)
      .with(true, () => 3)
      .otherwise(() => 2),
    shadowColor: match(isSelected)
      .with(true, () => labelColor)
      .otherwise(() => undefined),
    shadowBlur: match(isSelected)
      .with(true, () => 12)
      .otherwise(() => 0),
    shadowOpacity: match(isSelected)
      .with(true, () => 0.8)
      .otherwise(() => 0),
    draggable: false,
    hitStrokeWidth: 12,
  };
}

export interface BoxLike {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  boxType?: 'visual_ref';
  box_type?: 'Annotate' | 'Visual';
}

export function getBoxConfig(ann: BoxLike, isSelected: boolean, objectColor: string) {
  const isVisual = ann.boxType === 'visual_ref' || ann.box_type === 'Visual';
  return {
    x: ann.x1,
    y: ann.y1,
    width: ann.x2 - ann.x1,
    height: ann.y2 - ann.y1,
    stroke: match(isSelected)
      .with(true, () => '#ffffff')
      .otherwise(() => (isVisual ? '#a855f7' : objectColor)),
    strokeWidth: match(isSelected)
      .with(true, () => 3)
      .otherwise(() => 2),
    strokeScaleEnabled: false,
    dash: match(isVisual)
      .with(true, () => [6, 4])
      .otherwise(() => undefined),
    fill: 'rgba(0,0,0,0.05)',
    draggable: false,
    hitStrokeWidth: 12,
  };
}
