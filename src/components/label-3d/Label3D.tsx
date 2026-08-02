import { useMemoizedFn, useThrottleFn, useUpdateEffect } from 'ahooks';
import { MousePointer2, CircleDot, CircleMinus, Square, Eraser, Hand } from 'lucide-react';
import { Label3DToolbar } from './Label3DToolbar';
import { Label3DCanvas } from './Label3DCanvas';
import { Label3DKeyframePanel } from './Label3DKeyframePanel';
import { Label3DSliceSlider } from './Label3DSliceSlider';
import { Label3DObjectSelectPopup } from './Label3DObjectSelectPopup';
import { useLabel3DVolume } from '@/hooks/useLabel3DVolume';
import { useCanvasInteraction } from '@/hooks/useCanvasInteraction';
import { useLabelKeyboard } from '@/hooks/useLabelKeyboard';
import { useLabels } from '@/hooks/useLabels';
import { useSliceSummaries } from '@/hooks/useSliceSummaries';
import { useLabel3DCanvasStore } from '@/store/label-3d-canvas';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { LABELS } from '@/constants/labels';

export interface Label3DProps {
  onReset?: () => void;
}

export function Label3D({ onReset }: Label3DProps) {
  const volume = useLabel3DVolume();
  const interaction = useCanvasInteraction();
  const { data: labels } = useLabels();
  const { data: summaries } = useSliceSummaries(volume.volume?.volumeId ?? null);

  const canEdit = volume.volume !== null;

  const handleSave = useMemoizedFn(() => {
    volume.saveCurrent();
  });

  useLabelKeyboard({
    enabled: canEdit,
    onSave: handleSave,
    onSpaceDown: interaction.spaceDown,
    onSpaceUp: interaction.spaceUp,
    onEscape: interaction.handleEscape,
  });

  const handleReset = interaction.handleReset;

  // 切片切换 → 状态机 RESET，清 tempBox 回 idle
  useUpdateEffect(() => {
    handleReset();
  }, [volume.currentIndex, handleReset]);

  const { run: throttledSliceSelect } = useThrottleFn(
    (index: number) => {
      volume.requestLoadSlice(index);
    },
    { wait: 200 }
  );

  function handleSliceSelect(index: number) {
    if (index === volume.currentIndex) {
      return;
    }
    throttledSliceSelect(index);
  }

  return (
    <div className="flex h-full flex-col">
      <Label3DToolbar
        volume={volume}
        labels={labels ?? []}
        onOpen={volume.openVolume}
        onReset={onReset}
        onSave={handleSave}
        canEdit={canEdit}
      />

      <div className="flex min-h-0 flex-1">
        <ModeToolsPanel />

        <div className="flex min-w-0 flex-1 flex-col">
          <Label3DSliceSlider
            totalSlices={volume.volume?.totalSlices ?? 0}
            currentIndex={volume.currentIndex}
            onSelect={handleSliceSelect}
            disabled={!volume.volume}
          />
          <div className="relative min-h-0 flex-1 bg-muted/30">
            <Label3DCanvas
              canEdit={canEdit}
              sliceImageUrl={volume.sliceImageUrl}
              maskHash={volume.currentMaskHash}
              interaction={interaction}
            />
          </div>
        </div>

        <Label3DKeyframePanel
          volume={volume}
          summaries={summaries ?? []}
          labels={labels ?? []}
          onSliceSelect={handleSliceSelect}
        />
      </div>

      <Label3DObjectSelectPopup labels={labels ?? []} />

      <AlertDialog
        open={volume.dirtyConfirm === 'save'}
        onOpenChange={(open) => {
          if (!open) {
            volume.cancelDirty();
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{LABELS.label3d.dirtyTitle}</AlertDialogTitle>
            <AlertDialogDescription>{LABELS.label3d.dirtyDesc}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => handleDirtyChoice(volume, 'discard')}>
              {LABELS.label3d.discard}
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => handleDirtyChoice(volume, 'save')}>
              {LABELS.label3d.save}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function handleDirtyChoice(
  volume: ReturnType<typeof useLabel3DVolume>,
  choice: 'save' | 'discard'
) {
  volume.confirmDirty(choice);
}

function ModeToolsPanel() {
  const mode = useLabel3DCanvasStore((s) => s.mode);
  const tool = useLabel3DCanvasStore((s) => s.tool);

  const tools = [
    {
      key: 'select',
      label: LABELS.label3d.select,
      icon: MousePointer2,
      active: mode === 'select',
      onClick: () => useLabel3DCanvasStore.getState().setMode('select'),
    },
    {
      key: 'move',
      label: LABELS.label3d.move,
      icon: Hand,
      active: mode === 'move',
      onClick: () => useLabel3DCanvasStore.getState().setMode('move'),
    },
    {
      key: 'p_point',
      label: LABELS.label3d.positivePoint,
      icon: CircleDot,
      active: mode === 'create' && tool === 'p_point',
      onClick: () => useLabel3DCanvasStore.getState().setTool('p_point'),
    },
    {
      key: 'n_point',
      label: LABELS.label3d.negativePoint,
      icon: CircleMinus,
      active: mode === 'create' && tool === 'n_point',
      onClick: () => useLabel3DCanvasStore.getState().setTool('n_point'),
    },
    {
      key: 'box',
      label: LABELS.label3d.box,
      icon: Square,
      active: mode === 'create' && tool === 'box',
      onClick: () => useLabel3DCanvasStore.getState().setTool('box'),
    },
    {
      key: 'delete',
      label: LABELS.label3d.delete,
      icon: Eraser,
      active: mode === 'delete',
      onClick: () => useLabel3DCanvasStore.getState().setMode('delete'),
    },
  ] as const;

  return (
    <div className="flex w-12 shrink-0 flex-col items-center gap-1 border-r border-border p-1">
      {tools.map((t) => {
        const Icon = t.icon;
        return (
          <Button
            key={t.key}
            variant="ghost"
            size="icon-sm"
            className={cn('w-full', t.active && 'bg-muted text-foreground')}
            onClick={t.onClick}
            title={t.label}
          >
            <Icon />
          </Button>
        );
      })}
    </div>
  );
}
