import { useState, useEffect } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { toast } from 'sonner';
import { Plus, Minus, X, Pencil } from 'lucide-react';
import { useLockFn, useMemoizedFn } from 'ahooks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ColorPicker } from '@/components/ui/color-picker';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { useLabels } from '@/hooks/useLabels';
import { useDbChanged } from '@/hooks/useDbChanged';
import { dbCreateLabel, dbUpdateLabel, dbDeleteLabel, logMessage } from '@/services/cmds';
import { LABELS } from '@/constants/labels';
import type { Label } from '@/schemas/label';

const appWindow = getCurrentWindow();

export const Route = createFileRoute('/label-settings')({
  component: LabelSettingsComponent,
});

function LabelSettingsComponent() {
  const { data: labels, mutate } = useLabels();
  useDbChanged();

  const [editing, setEditing] = useState<Label | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState<Label | null>(null);

  const handleSaved = useMemoizedFn(async (_label: Label) => {
    setDialogOpen(false);
    setEditing(null);
    await mutate();
  });

  const handleDelete = useMemoizedFn(async () => {
    if (!deleting) {
      return;
    }
    try {
      await dbDeleteLabel(deleting.id);
      toast.success(LABELS.labelSettings.deleted(deleting.name));
      setDeleting(null);
      await mutate();
    } catch (e) {
      await logMessage('error', `[db] delete label failed: ${e}`);
      toast.error(String(e));
    }
  });

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <MiniTitleBar />
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-3">
        <div className="flex items-center justify-between">
          <h1 className="text-base font-semibold">{LABELS.labelSettings.title}</h1>
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus data-icon="inline-start" />
            {LABELS.labelSettings.add}
          </Button>
        </div>

        {!labels || labels.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {LABELS.labelSettings.noLabels}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {labels.map((label) => (
              <LabelRow
                key={label.id}
                label={label}
                onEdit={(l) => {
                  setEditing(l);
                  setDialogOpen(true);
                }}
                onDelete={(l) => setDeleting(l)}
              />
            ))}
          </div>
        )}
      </div>

      <LabelFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        onSaved={handleSaved}
      />

      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{LABELS.labelSettings.deleteConfirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting ? LABELS.labelSettings.deleteConfirmDesc(deleting.name) : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{LABELS.common.cancel}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={handleDelete}
            >
              {LABELS.common.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function MiniTitleBar() {
  return (
    <div
      className="flex h-9 shrink-0 items-center justify-between border-b border-border pl-3 select-none"
      data-tauri-drag-region
    >
      <span className="text-xs text-muted-foreground">{LABELS.labelSettings.title}</span>
      <div className="flex items-center gap-0.5 pr-1">
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => appWindow.minimize()}
          data-tauri-drag-region={false}
        >
          <Minus />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          className="hover:bg-destructive hover:text-destructive-foreground"
          onClick={() => appWindow.close()}
          data-tauri-drag-region={false}
        >
          <X />
        </Button>
      </div>
    </div>
  );
}

function LabelRow({
  label,
  onEdit,
  onDelete,
}: {
  label: Label;
  onEdit: (label: Label) => void;
  onDelete: (label: Label) => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border p-2">
      <div className="h-6 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: label.color }} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-sm font-medium truncate">{label.name}</span>
        {label.sub_labels.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {label.sub_labels.map((s) => (
              <Badge key={s} variant="secondary" className="text-[10px]">
                {s}
              </Badge>
            ))}
          </div>
        )}
      </div>
      <Button variant="ghost" size="icon-xs" onClick={() => onEdit(label)}>
        <Pencil />
        <span className="sr-only">edit</span>
      </Button>
      <Button
        variant="ghost"
        size="icon-xs"
        className="hover:bg-destructive hover:text-destructive-foreground"
        onClick={() => onDelete(label)}
      >
        <X />
        <span className="sr-only">delete</span>
      </Button>
    </div>
  );
}

function LabelFormDialog({
  open,
  onOpenChange,
  editing,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: Label | null;
  onSaved: (label: Label) => void;
}) {
  const { data: labels } = useLabels();
  const [name, setName] = useState('');
  const [color, setColor] = useState('#22c55e');
  const [order, setOrder] = useState(1);
  const [subLabelText, setSubLabelText] = useState('');
  const [subLabels, setSubLabels] = useState<string[]>([]);

  const isEditing = editing !== null;

  // 新增时自动分配下一个 order（现有最大 + 1，起始 1）
  const nextOrder = (labels ?? []).reduce((max, l) => Math.max(max, l.order), 0) + 1;

  const reset = useMemoizedFn(() => {
    setName(editing?.name ?? '');
    setColor(editing?.color ?? '#22c55e');
    setOrder(editing?.order ?? nextOrder);
    setSubLabels(editing?.sub_labels ?? []);
    setSubLabelText('');
  });

  useEffect(() => {
    if (open) {
      reset();
    }
  }, [open, reset]);

  const handleSave = useLockFn(async () => {
    if (!name.trim()) {
      toast.error(LABELS.labelSettings.nameRequired);
      return;
    }
    if (isEditing) {
      const updated = await dbUpdateLabel({
        id: editing!.id,
        name: name.trim(),
        color,
        order,
        sub_labels: subLabels,
      });
      toast.success(LABELS.labelSettings.updated(updated.name));
      await onSaved(updated);
    } else {
      const created = await dbCreateLabel({
        name: name.trim(),
        color,
        order,
        sub_labels: subLabels,
      });
      toast.success(LABELS.labelSettings.added(created.name));
      await onSaved(created);
    }
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          onOpenChange(false);
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? `编辑 ${editing!.name}` : LABELS.labelSettings.add}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">{LABELS.labelSettings.name}</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="tumor"
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">{LABELS.labelSettings.color}</label>
            <ColorPicker color={color} onChange={setColor} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">{LABELS.labelSettings.order}</label>
            <Input
              type="number"
              value={order}
              onChange={(e) => setOrder(Number(e.target.value) || 0)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">{LABELS.labelSettings.subLabels}</label>
            {subLabels.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {subLabels.map((s) => (
                  <Badge key={s} variant="secondary" className="gap-1">
                    {s}
                    <button
                      className="hover:text-destructive"
                      onClick={() => setSubLabels(subLabels.filter((x) => x !== s))}
                    >
                      <X className="size-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
            <div className="flex gap-1">
              <Input
                value={subLabelText}
                onChange={(e) => setSubLabelText(e.target.value)}
                placeholder={LABELS.labelSettings.addSubLabel}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && subLabelText.trim()) {
                    e.preventDefault();
                    if (!subLabels.includes(subLabelText.trim())) {
                      setSubLabels([...subLabels, subLabelText.trim()]);
                    }
                    setSubLabelText('');
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => {
                  if (subLabelText.trim()) {
                    if (!subLabels.includes(subLabelText.trim())) {
                      setSubLabels([...subLabels, subLabelText.trim()]);
                    }
                    setSubLabelText('');
                  }
                }}
              >
                <Plus />
              </Button>
            </div>
          </div>
        </div>
        <DialogFooter>
          <DialogClose
            render={
              <Button type="button" variant="outline">
                {LABELS.common.cancel}
              </Button>
            }
          />
          <Button disabled={!name.trim()} onClick={handleSave}>
            {LABELS.common.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
