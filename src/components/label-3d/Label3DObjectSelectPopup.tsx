import { createPortal } from 'react-dom';
import { useState } from 'react';
import { match } from 'ts-pattern';
import { useLabel3DCanvasStore } from '@/store/label-3d-canvas';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { LABELS } from '@/constants/labels';
import type { Label } from '@/schemas/label';

export interface Label3DObjectSelectPopupProps {
  labels: Label[];
}

type PopupMode = 'select' | 'create';

/** 光标位置对象选择弹层：选已有对象或新建对象。 */
export function Label3DObjectSelectPopup({ labels }: Label3DObjectSelectPopupProps) {
  const show = useLabel3DCanvasStore((s) => s.showObjectSelectPopup);
  const objects = useLabel3DCanvasStore((s) => s.objects);
  const cursorPos = useLabel3DCanvasStore((s) => s.cursorImagePos);
  const [mode, setMode] = useState<PopupMode>('select');

  if (!show) {
    return null;
  }

  const commitToObject = (objectId: string) => {
    const s = useLabel3DCanvasStore.getState();
    if (!s.pendingAnnotation) {
      return;
    }
    if (s.pendingAnnotation.type === 'point') {
      s.addPointToObject(objectId, s.pendingAnnotation.point);
    } else {
      s.addBoxToObject(objectId, s.pendingAnnotation.box);
    }
    s.setPendingAnnotation(null);
  };

  const commitNewObject = (labelId: string) => {
    const s = useLabel3DCanvasStore.getState();
    if (!s.pendingAnnotation) {
      return;
    }
    const obj = s.addObject(labelId);
    if (!obj) {
      return;
    }
    if (s.pendingAnnotation.type === 'point') {
      s.addPointToObject(obj.id, s.pendingAnnotation.point);
    } else {
      s.addBoxToObject(obj.id, s.pendingAnnotation.box);
    }
    s.setPendingAnnotation(null);
  };

  const position = cursorPos ?? { x: 0, y: 0 };

  return createPortal(
    <div
      className="fixed z-[100] flex w-56 flex-col gap-1 rounded-lg border border-border bg-background p-1.5 shadow-lg"
      style={{
        left: Math.min(position.x, window.innerWidth - 240),
        top: Math.min(position.y + 16, window.innerHeight - 120),
      }}
    >
      <div className="flex gap-1 border-b border-border pb-1">
        <Button
          size="xs"
          variant={mode === 'select' ? 'secondary' : 'ghost'}
          onClick={() => setMode('select')}
        >
          {LABELS.label3d.select}
        </Button>
        <Button
          size="xs"
          variant={mode === 'create' ? 'secondary' : 'ghost'}
          onClick={() => setMode('create')}
        >
          {LABELS.common.add}
        </Button>
      </div>

      <div className="flex max-h-56 flex-col gap-0.5 overflow-y-auto">
        {match(mode)
          .with('select', () =>
            objects.length === 0 ? (
              <p className="px-2 py-1 text-xs text-muted-foreground">{LABELS.label3d.noObjects}</p>
            ) : (
              objects.map((obj) => (
                <button
                  key={obj.id}
                  className={cn(
                    'flex items-center gap-2 rounded px-2 py-1 text-left text-xs hover:bg-muted'
                  )}
                  onClick={() => commitToObject(obj.id)}
                >
                  <span className="truncate">{obj.id.slice(0, 8)}</span>
                </button>
              ))
            )
          )
          .with('create', () =>
            labels.length === 0 ? (
              <p className="px-2 py-1 text-xs text-muted-foreground">{LABELS.label3d.noLabels}</p>
            ) : (
              labels.map((label) => (
                <button
                  key={label.id}
                  className="flex items-center gap-2 rounded px-2 py-1 text-left text-xs hover:bg-muted"
                  onClick={() => commitNewObject(label.id)}
                >
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: label.color }}
                  />
                  <span className="truncate">{label.name}</span>
                </button>
              ))
            )
          )
          .exhaustive()}
      </div>
    </div>,
    document.body
  );
}
