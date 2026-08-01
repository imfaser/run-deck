import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { LABELS } from '@/constants/labels';

export interface Label3DSliceSliderProps {
  totalSlices: number;
  currentIndex: number;
  onSelect: (index: number) => void;
  disabled?: boolean;
}

export function Label3DSliceSlider({
  totalSlices,
  currentIndex,
  onSelect,
  disabled,
}: Label3DSliceSliderProps) {
  const max = Math.max(0, totalSlices - 1);

  return (
    <div className="flex h-11 shrink-0 items-center gap-3 border-t border-border px-3">
      <span className="shrink-0 text-xs text-muted-foreground">{LABELS.label3d.slice}</span>
      <Slider
        className="flex-1"
        min={0}
        max={max}
        step={1}
        value={disabled ? 0 : currentIndex}
        onValueChange={(v) => onSelect(Number(v))}
        disabled={disabled}
      />
      <Input
        type="number"
        className="h-7 w-20 shrink-0 text-xs"
        min={0}
        max={max}
        value={currentIndex}
        disabled={disabled}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (!Number.isNaN(v)) {
            onSelect(Math.max(0, Math.min(max, v)));
          }
        }}
      />
      <span className="shrink-0 text-xs text-muted-foreground">/ {max}</span>
    </div>
  );
}
