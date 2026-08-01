import { useState } from 'react';
import { match } from 'ts-pattern';
import { range } from 'es-toolkit';
import { ChevronDown, ChevronRight, Camera, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useLabel3DCanvasStore } from '@/store/label-3d-canvas';
import { useSliceAnnotations } from '@/hooks/useSliceAnnotations';
import { logMessage } from '@/services/cmds';
import { dbAnnotationsToObjects } from '@/lib/annotationMapping';
import { LABELS } from '@/constants/labels';
import type { AnnotationCount } from '@/schemas/annotation';
import type { Label } from '@/schemas/label';
import type { Label3DVolume } from '@/hooks/useLabel3DVolume';
import type { AnnotationObject } from '@/lib/annotationMapping';

export interface Label3DKeyframePanelProps {
  volume: Label3DVolume;
  summaries: AnnotationCount[];
  labels: Label[];
  onSliceSelect: (index: number) => void;
}

type FilterMode = 'all' | 'annotated';

export function Label3DKeyframePanel({
  volume,
  summaries,
  labels,
  onSliceSelect,
}: Label3DKeyframePanelProps) {
  const [filter, setFilter] = useState<FilterMode>('all');
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const total = volume.volume?.totalSlices ?? 0;
  const countByIndex = new Map<number, number>();
  for (const s of summaries) {
    if (s.sliceIndex !== null) {
      countByIndex.set(s.sliceIndex, s.annotationCount);
    }
  }

  const allIndices = range(0, total);
  const filteredIndices = match(filter)
    .with('all', () => allIndices)
    .with('annotated', () => allIndices.filter((i) => (countByIndex.get(i) ?? 0) > 0))
    .exhaustive();

  const objects = useLabel3DCanvasStore((s) => s.objects);
  const currentIndex = volume.currentIndex;
  const isCurrentSlice = expandedIndex !== null && expandedIndex === currentIndex;

  // 展开非当前切片时按 summaries 中的 imageHash 拉取该切片标注
  const expandedSummary =
    expandedIndex !== null ? summaries.find((s) => s.sliceIndex === expandedIndex) : undefined;
  const expandedHash =
    expandedIndex !== null && !isCurrentSlice ? (expandedSummary?.imageHash ?? null) : null;
  const { data: expandedData } = useSliceAnnotations(expandedHash);
  const expandedObjects: AnnotationObject[] = isCurrentSlice
    ? objects
    : expandedData
      ? dbAnnotationsToObjects(expandedData)
      : [];

  return (
    <div className="flex w-64 shrink-0 flex-col border-l border-border">
      <div className="flex h-11 shrink-0 items-center justify-between gap-2 border-b border-border px-3">
        <span className="text-sm font-medium">{LABELS.label3d.slices}</span>
      </div>

      <div className="flex shrink-0 items-center gap-2 px-3 py-2">
        <RadioGroup
          value={filter}
          onValueChange={(v) => setFilter(v as FilterMode)}
          className="flex flex-row gap-3"
        >
          <RadioItem value="all" label={LABELS.label3d.allSlices} />
          <RadioItem value="annotated" label={LABELS.label3d.annotatedOnly} />
        </RadioGroup>
      </div>

      <Separator />

      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-0.5 p-1">
          {filteredIndices.map((index) => {
            const count = countByIndex.get(index) ?? 0;
            const active = index === currentIndex;
            const expanded = expandedIndex === index;
            return (
              <div key={index} className="flex flex-col">
                <div
                  className={
                    'flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-sm transition-colors ' +
                    (active ? 'bg-primary/15 text-foreground' : 'hover:bg-muted')
                  }
                  onClick={() => onSliceSelect(index)}
                >
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedIndex(expanded ? null : index);
                    }}
                    className="flex size-4 shrink-0 items-center justify-center"
                  >
                    {expanded ? <ChevronDown /> : <ChevronRight />}
                  </span>
                  <Camera className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate font-mono">
                    {LABELS.label3d.sliceLabel(index)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {LABELS.label3d.sliceCount(count)}
                  </span>
                  <Trash2
                    className="size-3.5 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      volume.deleteSlice(index);
                    }}
                  />
                </div>
                {expanded && (
                  <div className="ml-6 flex flex-col gap-0.5 py-0.5">
                    {expandedObjects.length === 0 ? (
                      <p className="px-2 text-xs text-muted-foreground italic">
                        {LABELS.label3d.noAnnotations}
                      </p>
                    ) : (
                      expandedObjects.map((obj) => (
                        <SliceObject
                          key={obj.id}
                          obj={obj}
                          labels={labels}
                          isCurrentSlice={isCurrentSlice}
                        />
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>

      <FooterActions />
    </div>
  );
}

function RadioItem({ value, label }: { value: FilterMode; label: string }) {
  return (
    <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
      <RadioGroupItem value={value} />
      {label}
    </label>
  );
}

function SliceObject({
  obj,
  labels,
  isCurrentSlice,
}: {
  obj: AnnotationObject;
  labels: Label[];
  isCurrentSlice: boolean;
}) {
  const label = labels.find((l) => l.id === obj.labelId);
  const color = label?.color ?? '#888';
  const name = label?.name ?? LABELS.label3d.unknownLabel;

  return (
    <div className="flex flex-col">
      <span className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium" style={{ color }}>
        <span className="size-1.5 rounded-full" style={{ backgroundColor: color }} />
        {name}
      </span>
      {[...obj.boxes, ...obj.points].map((ann) => (
        <button
          key={ann.id}
          className={
            'px-2 py-0.5 text-left font-mono text-[11px] transition-colors ' +
            (isCurrentSlice ? 'cursor-pointer hover:bg-muted' : 'opacity-70')
          }
          onClick={() => {
            if (!isCurrentSlice) {
              return;
            }
            useLabel3DCanvasStore.getState().selectAnnotation(ann.id);
          }}
        >
          {formatAnnotation(ann)}
        </button>
      ))}
    </div>
  );
}

function formatAnnotation(ann: {
  id: string;
  x?: number;
  y?: number;
  label?: number;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
}) {
  if ('label' in ann) {
    const icon = ann.label === 1 ? '+' : '-';
    return `${icon} ${ann.x}, ${ann.y}`;
  }
  if ('x1' in ann) {
    return `▭ ${ann.x1}, ${ann.y1} → ${ann.x2}, ${ann.y2}`;
  }
  return '?';
}

function FooterActions() {
  const selectedAnnotationId = useLabel3DCanvasStore((s) => s.selectedAnnotationId);
  const objects = useLabel3DCanvasStore((s) => s.objects);
  const selectedObjectId = useLabel3DCanvasStore((s) => s.selectedObjectId);

  if (!selectedAnnotationId) {
    return null;
  }

  const selectedInfo = findAnnotation(objects, selectedAnnotationId);
  if (!selectedInfo) {
    return null;
  }
  const { obj, type } = selectedInfo;
  const isVisual =
    type === 'box' &&
    obj.boxes.find((b) => b.id === selectedAnnotationId)?.boxType === 'visual_ref';

  const availableObjects = objects.filter(
    (o) => o.id !== selectedObjectId && !o.boxes.some((b) => b.boxType === 'visual_ref')
  );

  return (
    <div className="flex shrink-0 flex-col gap-1.5 border-t border-border p-2">
      {type === 'box' && !isVisual && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            useLabel3DCanvasStore.getState().setAsVisualBox(selectedAnnotationId);
            toast.success(LABELS.label3d.setVisualBox);
            logMessage('debug', `[panel] set visual box ${selectedAnnotationId}`).catch(() => {});
          }}
        >
          <Camera data-icon="inline-start" />
          {LABELS.label3d.setVisualBox}
        </Button>
      )}
      <Select
        value=""
        onValueChange={(targetId) => {
          if (targetId && selectedAnnotationId) {
            useLabel3DCanvasStore.getState().reassignAnnotation(selectedAnnotationId, targetId);
            toast.success(LABELS.label3d.reassign);
          }
        }}
        items={Object.fromEntries(availableObjects.map((o) => [o.id, 'object']))}
      >
        <SelectTrigger className="h-7 text-xs">
          <SelectValue placeholder={LABELS.label3d.reassign} />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>{LABELS.label3d.reassign}</SelectLabel>
            {availableObjects.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.id.slice(0, 8)}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      <Button
        size="sm"
        variant="destructive"
        onClick={() => {
          useLabel3DCanvasStore.getState().removeAnnotationFromObject(selectedAnnotationId);
          toast.success(LABELS.label3d.deleteAnnotation);
        }}
      >
        <Trash2 data-icon="inline-start" />
        {LABELS.label3d.deleteAnnotation}
      </Button>
    </div>
  );
}

function findAnnotation(
  objects: AnnotationObject[],
  id: string
): { obj: AnnotationObject; type: 'point' | 'box' } | null {
  for (const obj of objects) {
    if (obj.points.some((p) => p.id === id)) {
      return { obj, type: 'point' };
    }
    if (obj.boxes.some((b) => b.id === id)) {
      return { obj, type: 'box' };
    }
  }
  return null;
}
