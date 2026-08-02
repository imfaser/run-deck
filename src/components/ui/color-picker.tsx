import React, { useState } from 'react';
import { useMemoizedFn, useUpdateEffect } from 'ahooks';
import { Check, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const hslToHex = (h: number, s: number, l: number): string => {
  l /= 100;
  const a = (s * Math.min(l, 1 - l)) / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`.toUpperCase();
};

const hexToHsl = (hex: string): [number, number, number] => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) {
    return [0, 0, 0];
  }

  const r = parseInt(result[1], 16) / 255;
  const g = parseInt(result[2], 16) / 255;
  const b = parseInt(result[3], 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
};

const normalizeColor = (color: string): string => {
  if (color.startsWith('#')) {
    return color.toUpperCase();
  } else if (color.startsWith('hsl')) {
    const [h, s, l] = color.match(/\d+(\.\d+)?/g)?.map(Number) || [0, 0, 0];
    return hslToHex(h, s, l);
  }
  return color;
};

const trimColorString = (color: string, maxLength = 20): string => {
  if (color.length <= maxLength) {
    return color;
  }
  return `${color.slice(0, maxLength - 3)}...`;
};

export function ColorPicker({
  color,
  onChange,
}: {
  color: string;
  onChange: (color: string) => void;
}) {
  const [hsl, setHsl] = useState<[number, number, number]>(() => hexToHsl(normalizeColor(color)));
  const [colorInput, setColorInput] = useState(() => normalizeColor(color));

  useUpdateEffect(() => {
    handleColorChange(color);
  }, [color]);

  const handleColorChange = useMemoizedFn((newColor: string) => {
    const normalizedColor = normalizeColor(newColor);
    setColorInput(normalizedColor);

    let h = 0;
    let s = 0;
    let l = 0;
    if (normalizedColor.startsWith('#')) {
      [h, s, l] = hexToHsl(normalizedColor);
    } else {
      [h, s, l] = normalizedColor.match(/\d+(\.\d+)?/g)?.map(Number) || [0, 0, 0];
    }

    setHsl([h, s, l]);
    onChange(hslToHex(h, s, l));
  });

  const handleHueChange = (hue: number) => {
    const newHsl: [number, number, number] = [hue, hsl[1], hsl[2]];
    setHsl(newHsl);
    handleColorChange(`hsl(${newHsl[0]}, ${newHsl[1]}%, ${newHsl[2]}%)`);
  };

  const handleSaturationLightnessChange = (
    clientX: number,
    clientY: number,
    el: HTMLDivElement | null
  ) => {
    if (!el) {
      return;
    }
    const rect = el.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const s = Math.round((x / rect.width) * 100);
    const l = Math.round(100 - (y / rect.height) * 100);
    const newHsl: [number, number, number] = [hsl[0], s, l];
    setHsl(newHsl);
    handleColorChange(`hsl(${newHsl[0]}, ${newHsl[1]}%, ${newHsl[2]}%)`);
  };

  const handleSaturationPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    handleSaturationLightnessChange(event.clientX, event.clientY, event.currentTarget);
  };

  const handleSaturationPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      handleSaturationLightnessChange(event.clientX, event.clientY, event.currentTarget);
    }
  };

  const handleSaturationPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleColorInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newColor = event.target.value;
    setColorInput(newColor);
    if (/^#[0-9A-Fa-f]{6}$/.test(newColor) || /^hsl\(\d+,\s*\d+%,\s*\d+%\)$/.test(newColor)) {
      handleColorChange(newColor);
    }
  };

  const colorPresets = [
    '#FF3B30',
    '#FF9500',
    '#FFCC00',
    '#4CD964',
    '#5AC8FA',
    '#007AFF',
    '#5856D6',
    '#FF2D55',
    '#8E8E93',
    '#EFEFF4',
    '#E5E5EA',
    '#D1D1D6',
  ];

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant="outline" className="w-full justify-start text-left font-normal">
            <span
              className="mr-2 size-4 rounded-full shadow-sm"
              style={{ backgroundColor: colorInput }}
            />
            <span className="flex-grow truncate">{trimColorString(colorInput)}</span>
            <ChevronDown className="size-4 opacity-50" />
          </Button>
        }
      />
      <PopoverContent className="w-60 p-3">
        <div className="flex flex-col gap-3">
          <div
            className="relative h-40 w-full cursor-crosshair overflow-hidden rounded-lg"
            style={{
              background: `
                linear-gradient(to top, rgba(0, 0, 0, 1), transparent),
                linear-gradient(to right, rgba(255, 255, 255, 1), rgba(255, 0, 0, 0)),
                hsl(${hsl[0]}, 100%, 50%)
              `,
            }}
            onPointerDown={handleSaturationPointerDown}
            onPointerMove={handleSaturationPointerMove}
            onPointerUp={handleSaturationPointerUp}
            onPointerCancel={handleSaturationPointerUp}
          >
            <div
              className="absolute size-4 rounded-full border-2 border-white shadow-md"
              style={{
                left: `${hsl[1]}%`,
                top: `${100 - hsl[2]}%`,
                backgroundColor: hslToHex(hsl[0], hsl[1], hsl[2]),
              }}
            />
          </div>
          <input
            type="range"
            min="0"
            max="360"
            value={hsl[0]}
            onChange={(e) => handleHueChange(Number(e.target.value))}
            className="h-3 w-full cursor-pointer appearance-none rounded-full"
            style={{
              background: `linear-gradient(to right,
                hsl(0, 100%, 50%), hsl(60, 100%, 50%), hsl(120, 100%, 50%),
                hsl(180, 100%, 50%), hsl(240, 100%, 50%), hsl(300, 100%, 50%), hsl(360, 100%, 50%)
              )`,
            }}
          />
          <div className="flex items-center gap-2">
            <Input
              type="text"
              value={colorInput}
              onChange={handleColorInputChange}
              className="h-8 flex-grow bg-white text-sm dark:bg-input/30"
              placeholder="#RRGGBB"
            />
            <div
              className="size-8 shrink-0 rounded-md shadow-sm"
              style={{ backgroundColor: colorInput }}
            />
          </div>
          <div className="grid grid-cols-6 gap-2">
            {colorPresets.map((preset) => (
              <button
                key={preset}
                className="relative size-8 rounded-full"
                style={{ backgroundColor: preset }}
                onClick={() => handleColorChange(preset)}
              >
                {colorInput === preset && (
                  <Check className="absolute inset-0 m-auto size-4 text-white" />
                )}
              </button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default ColorPicker;
