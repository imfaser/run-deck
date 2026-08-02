import { createPortal } from 'react-dom';
import { useState } from 'react';
import { useMount, useUpdateEffect } from 'ahooks';
import { X, Plus } from 'lucide-react';
import { useLabel3DCanvasStore } from '@/store/label-3d-canvas';
import { Button } from '@/components/ui/button';
import { openLabelSettings } from '@/lib/window';
import { LABELS } from '@/constants/labels';
import type { Label } from '@/schemas/label';

export interface Label3DObjectSelectPopupProps {
  labels: Label[];
}

/** 标注归属弹层：点击标签创建对象并接收当前 pending 标注。 */
export function Label3DObjectSelectPopup({ labels }: Label3DObjectSelectPopupProps) {
  const show = useLabel3DCanvasStore((s) => s.showObjectSelectPopup);
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);

  // 打开时固定锚点：读当前 store 的屏幕坐标快照，避免弹层跟随鼠标移动导致按钮无法点中
  useUpdateEffect(() => {
    if (show) {
      const cursorPos = useLabel3DCanvasStore.getState().cursorScreenPos;
      setAnchor(cursorPos ?? { x: window.innerWidth / 2, y: window.innerHeight / 2 });
    } else {
      setAnchor(null);
    }
  }, [show]);

  // ESC 关闭弹层（注册一次，handler 只调 store 不依赖局部 state）
  useMount(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        useLabel3DCanvasStore.getState().setShowObjectSelectPopup(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  if (!show) {
    return null;
  }

  const close = () => {
    useLabel3DCanvasStore.getState().setShowObjectSelectPopup(false);
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

  const handleNewLabel = () => {
    openLabelSettings();
  };

  const position = anchor ?? { x: window.innerWidth / 2, y: window.innerHeight / 2 };

  return createPortal(
    <div
      className="fixed z-[100] flex w-56 flex-col gap-1 rounded-lg border border-border bg-background p-1.5 shadow-lg"
      style={{
        left: Math.min(position.x, window.innerWidth - 240),
        top: Math.min(position.y + 16, window.innerHeight - 120),
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-1 border-b border-border pb-1">
        <span className="flex flex-1 px-1 text-xs font-medium text-muted-foreground">
          {LABELS.label3d.selectLabel}
        </span>
        <Button size="icon-xs" variant="ghost" onClick={close} title={LABELS.common.cancel}>
          <X className="size-3.5" />
        </Button>
      </div>

      <div className="flex max-h-56 flex-col gap-0.5 overflow-y-auto">
        {labels.length === 0 ? (
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
        )}
      </div>

      <Button size="xs" variant="outline" className="mt-1" onClick={handleNewLabel}>
        <Plus data-icon="inline-start" />
        {LABELS.label3d.newLabel}
      </Button>
    </div>,
    document.body
  );
}
