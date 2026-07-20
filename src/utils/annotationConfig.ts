import type { Annotation } from '@/schemas/annotation';

export function getPointConfig(
  ann: Annotation & { type: 'p_point' | 'n_point' },
  isSelected: boolean
) {
  const isPositive = ann.type === 'p_point';
  return {
    x: ann.x,
    y: ann.y,
    radius: isSelected ? 8 : 6,
    fill: isPositive ? '#22c55e' : '#ef4444',
    stroke: isSelected ? '#ffffff' : isPositive ? '#16a34a' : '#dc2626',
    strokeWidth: isSelected ? 3 : 2,
    shadowColor: isSelected ? (isPositive ? '#22c55e' : '#ef4444') : undefined,
    shadowBlur: isSelected ? 12 : 0,
    shadowOpacity: isSelected ? 0.8 : 0,
    name: ann.id,
    draggable: false,
    hitStrokeWidth: 12,
  };
}

export function getBoxConfig(ann: Annotation & { type: 'box' }, isSelected: boolean) {
  return {
    x: ann.x1,
    y: ann.y1,
    width: ann.x2 - ann.x1,
    height: ann.y2 - ann.y1,
    stroke: isSelected ? '#ffffff' : '#eab308',
    strokeWidth: isSelected ? 3 : 2,
    strokeScaleEnabled: false,
    fill: 'transparent',
    name: ann.id,
    draggable: false,
    hitStrokeWidth: 12,
  };
}
