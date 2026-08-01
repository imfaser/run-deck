import { useState } from 'react';
import { open as openFileDialog } from '@tauri-apps/plugin-dialog';
import { toast } from 'sonner';
import { FolderOpen, Maximize2, Save, Tags, RotateCcw } from 'lucide-react';
import { useMemoizedFn, useLockFn } from 'ahooks';
import { createLocalStorageState } from 'foxact/create-local-storage-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { useLabel3DCanvasStore } from '@/store/label-3d-canvas';
import { openLabelSettings } from '@/lib/window';
import { logMessage } from '@/services/cmds';
import { LABELS } from '@/constants/labels';
import type { Label } from '@/schemas/label';
import type { VolumeConfig } from '@/schemas/volume';
import type { Label3DVolume } from '@/hooks/useLabel3DVolume';

const DEFAULT_CONFIG: VolumeConfig = {
  x: 512,
  y: 512,
  z: 64,
  dtype: 'uint8',
  endian: 'little',
  axis: 'z',
};

// 记住上次的 Volume 配置（foxact localStorage hook）
const [useLastConfig, , useSetLastConfig] = createLocalStorageState<VolumeConfig | null>(
  'run-deck:label-3d:volume-config',
  null
);

interface Label3DToolbarProps {
  volume: Label3DVolume;
  labels: Label[];
  canEdit: boolean;
  onOpen: (config: VolumeConfig, path: string) => Promise<unknown>;
  onReset?: () => void;
  onSave: () => void;
}

export function Label3DToolbar({ volume, canEdit, onOpen, onReset, onSave }: Label3DToolbarProps) {
  const [openDialog, setOpenDialog] = useState(false);
  const [lastConfig] = useLastConfig();
  const [config, setConfig] = useState<VolumeConfig>(lastConfig ?? DEFAULT_CONFIG);
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const setLastConfig = useSetLastConfig();

  const dirty = useLabel3DCanvasStore((s) => s.dirty);
  const isSaving = volume.isSaving;

  const handleChooseFile = useLockFn(async () => {
    try {
      const selected = await openFileDialog({
        title: LABELS.label3d.selectRawFile,
        multiple: false,
        directory: false,
        filters: [{ name: LABELS.label3d.rawData, extensions: ['raw'] }],
      });
      if (typeof selected === 'string') {
        setPendingPath(selected);
        setConfig(DEFAULT_CONFIG);
        setOpenDialog(true);
      }
    } catch (e) {
      await logMessage('error', `[toolbar] open file dialog failed: ${e}`);
    }
  });

  const handleConfirmOpen = useLockFn(async () => {
    if (!pendingPath) {
      return;
    }
    setOpenDialog(false);
    setLastConfig(config);
    const res = await onOpen(config, pendingPath);
    if (res) {
      toast.success(LABELS.label3d.volumeOpened);
    }
    setPendingPath(null);
  });

  const handleFitImage = useMemoizedFn(() => {
    useLabel3DCanvasStore.getState().setFitImageTrigger();
  });

  return (
    <div className="flex h-11 shrink-0 items-center justify-between gap-2 border-b border-border px-2">
      <div className="flex items-center gap-1">
        <Button size="sm" variant="outline" onClick={handleChooseFile}>
          <FolderOpen data-icon="inline-start" />
          {LABELS.label3d.open}
        </Button>
        <Button size="sm" variant="outline" onClick={handleFitImage} disabled={!canEdit}>
          <Maximize2 data-icon="inline-start" />
          {LABELS.label3d.fitImage}
        </Button>
        <Button size="sm" onClick={onSave} disabled={!canEdit || !dirty || isSaving}>
          <Save data-icon="inline-start" />
          {LABELS.label3d.save}
        </Button>
        <Button size="sm" variant="outline" onClick={openLabelSettings}>
          <Tags data-icon="inline-start" />
          {LABELS.label3d.manageLabels}
        </Button>
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {volume.volume && (
          <span>
            {LABELS.label3d.sliceCounter(volume.currentIndex, volume.volume.totalSlices - 1)}
          </span>
        )}
        {onReset && (
          <Button size="icon-xs" variant="ghost" onClick={onReset} title={LABELS.label3d.reset}>
            <RotateCcw />
          </Button>
        )}
      </div>

      <VolumeConfigDialog
        open={openDialog}
        onOpenChange={setOpenDialog}
        config={config}
        setConfig={setConfig}
        onConfirm={handleConfirmOpen}
      />
    </div>
  );
}

function VolumeConfigDialog({
  open,
  onOpenChange,
  config,
  setConfig,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: VolumeConfig;
  setConfig: (c: VolumeConfig) => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{LABELS.label3d.volumeConfig}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <ConfigField label="X">
            <Input
              type="number"
              value={config.x}
              onChange={(e) => setConfig({ ...config, x: Number(e.target.value) || 1 })}
            />
          </ConfigField>
          <ConfigField label="Y">
            <Input
              type="number"
              value={config.y}
              onChange={(e) => setConfig({ ...config, y: Number(e.target.value) || 1 })}
            />
          </ConfigField>
          <ConfigField label="Z">
            <Input
              type="number"
              value={config.z}
              onChange={(e) => setConfig({ ...config, z: Number(e.target.value) || 1 })}
            />
          </ConfigField>
          <ConfigField label="dtype">
            <Select
              value={config.dtype}
              onValueChange={(v) => setConfig({ ...config, dtype: v as VolumeConfig['dtype'] })}
              items={{ u8: 'u8', uint8: 'uint8', u16: 'u16', uint16: 'uint16' }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>dtype</SelectLabel>
                  <SelectItem value="u8">u8</SelectItem>
                  <SelectItem value="uint8">uint8</SelectItem>
                  <SelectItem value="u16">u16</SelectItem>
                  <SelectItem value="uint16">uint16</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </ConfigField>
          <ConfigField label="endian">
            <Select
              value={config.endian}
              onValueChange={(v) => setConfig({ ...config, endian: v as VolumeConfig['endian'] })}
              items={{ little: 'little', le: 'le', big: 'big', be: 'be' }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>endian</SelectLabel>
                  <SelectItem value="little">little</SelectItem>
                  <SelectItem value="le">le</SelectItem>
                  <SelectItem value="big">big</SelectItem>
                  <SelectItem value="be">be</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </ConfigField>
          <ConfigField label="axis">
            <Select
              value={config.axis}
              onValueChange={(v) => setConfig({ ...config, axis: v as VolumeConfig['axis'] })}
              items={{ x: 'x', y: 'y', z: 'z' }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>axis</SelectLabel>
                  <SelectItem value="x">x</SelectItem>
                  <SelectItem value="y">y</SelectItem>
                  <SelectItem value="z">z</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </ConfigField>
        </div>
        <DialogFooter>
          <DialogClose
            render={
              <Button type="button" variant="outline">
                {LABELS.common.cancel}
              </Button>
            }
          />
          <Button onClick={onConfirm}>{LABELS.label3d.openButton}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConfigField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium">{label}</label>
      {children}
    </div>
  );
}
