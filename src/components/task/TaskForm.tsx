import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
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
import { useLabels } from '@/hooks/useLabels';
import { taskCreate, taskUpdate } from '@/services/tasks';
import { logMessage } from '@/services/cmds';
import { LABELS } from '@/constants/labels';
import type { CurrentVolume, Task, TaskKind } from '@/schemas/task';

interface TargetRow {
  labelId: string;
  enabled: boolean;
  subLabels: string[];
}

const formSchema = z
  .object({
    name: z.string().min(1, LABELS.tasks.nameRequired),
    kind: z.enum(['Segment', 'Detect']),
    rangeStart: z.number(),
    rangeEnd: z.number(),
    usePrevMask: z.boolean(),
    targets: z.array(
      z.object({
        labelId: z.string(),
        enabled: z.boolean(),
        subLabels: z.array(z.string()),
      })
    ),
  })
  .refine((v) => v.rangeEnd >= v.rangeStart, {
    message: LABELS.tasks.rangeInvalid,
    path: ['rangeEnd'],
  });

type TaskFormValues = z.infer<typeof formSchema>;

interface TaskFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: Task | null;
  currentVolume: CurrentVolume | null;
  onSaved: () => void;
}

export function TaskForm({ open, onOpenChange, editing, currentVolume, onSaved }: TaskFormProps) {
  // 每次打开/切换目标都 remount 表单，defaultValues 重新生效
  const formKey = open ? (editing?.id ?? 'new') : 'closed';
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? LABELS.tasks.edit(editing.name) : LABELS.tasks.add}</DialogTitle>
        </DialogHeader>
        <TaskFormFields
          key={formKey}
          editing={editing}
          currentVolume={currentVolume}
          onCancel={() => onOpenChange(false)}
          onSaved={onSaved}
        />
      </DialogContent>
    </Dialog>
  );
}

function TaskFormFields({
  editing,
  currentVolume,
  onCancel,
  onSaved,
}: {
  editing: Task | null;
  currentVolume: CurrentVolume | null;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const { data: labels } = useLabels();
  const isEditing = editing !== null;

  const buildTargets = (): TargetRow[] =>
    (labels ?? []).map((l) => {
      const t = editing?.params.targets.find((x) => x.label_id === l.id);
      return {
        labelId: l.id,
        enabled: t !== undefined,
        subLabels: t?.sub_labels ?? [],
      };
    });

  const form = useForm<TaskFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: editing?.name ?? '',
      kind: editing?.kind ?? 'Segment',
      rangeStart: editing?.range_start ?? 0,
      rangeEnd: editing?.range_end ?? (currentVolume ? currentVolume.totalSlices - 1 : 0),
      usePrevMask: editing?.params.use_prev_mask ?? true,
      targets: buildTargets(),
    },
  });

  const { errors } = form.formState;
  const kind = useWatch({ control: form.control, name: 'kind' });
  const usePrevMask = useWatch({ control: form.control, name: 'usePrevMask' });
  const targets = useWatch({ control: form.control, name: 'targets' });

  async function handleSave() {
    const valid = await form.trigger();
    if (!valid) {
      return;
    }
    const values = form.getValues();

    if (values.kind === 'Detect') {
      const enabled = values.targets.filter((t) => t.enabled);
      if (enabled.length === 0) {
        form.setError('targets', { message: LABELS.tasks.targetRequired });
        return;
      }
    }

    const params = {
      use_prev_mask: values.usePrevMask,
      targets: values.targets
        .filter((t) => t.enabled)
        .map((t) => ({ label_id: t.labelId, sub_labels: t.subLabels })),
    };

    try {
      if (isEditing && editing) {
        await taskUpdate(editing.id, {
          name: values.name,
          rangeStart: values.rangeStart,
          rangeEnd: values.rangeEnd,
          params,
        });
        toast.success(LABELS.tasks.updated(values.name));
      } else {
        if (!currentVolume) {
          toast.error(LABELS.tasks.noVolume);
          return;
        }
        await taskCreate({
          name: values.name,
          kind: values.kind,
          volumeId: currentVolume.volumeId,
          rangeStart: values.rangeStart,
          rangeEnd: values.rangeEnd,
          params,
        });
        toast.success(LABELS.tasks.created(values.name));
      }
      await onSaved();
    } catch (e) {
      await logMessage('error', `[task] save task failed: ${e}`);
      toast.error(String(e));
    }
  }

  function toggleSubLabel(labelId: string, sub: string) {
    const current = form.getValues('targets');
    const next = current.map((t) => {
      if (t.labelId !== labelId) {
        return t;
      }
      return {
        labelId: t.labelId,
        enabled: t.enabled,
        subLabels: t.subLabels.includes(sub)
          ? t.subLabels.filter((s) => s !== sub)
          : [...t.subLabels, sub],
      };
    });
    form.setValue('targets', next);
  }

  function setTargetEnabled(labelId: string, enabled: boolean) {
    const current = form.getValues('targets');
    form.setValue(
      'targets',
      current.map((t) => {
        if (t.labelId !== labelId) {
          return t;
        }
        return { labelId: t.labelId, enabled, subLabels: t.subLabels };
      })
    );
  }

  return (
    <>
      {!currentVolume && !isEditing ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {LABELS.tasks.noVolumeHint}
        </p>
      ) : (
        <form className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">{LABELS.tasks.name}</label>
            <Input {...form.register('name')} placeholder="tumor-seg" autoFocus />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">{LABELS.tasks.kind}</label>
              <Select
                disabled={isEditing}
                value={kind}
                onValueChange={(v) => form.setValue('kind', v as TaskKind)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>{LABELS.tasks.kind}</SelectLabel>
                    <SelectItem value="Segment">{LABELS.tasks.kindSegment}</SelectItem>
                    <SelectItem value="Detect">{LABELS.tasks.kindDetect}</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium">{LABELS.tasks.rangeStart}</label>
                <Input type="number" {...form.register('rangeStart', { valueAsNumber: true })} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium">{LABELS.tasks.rangeEnd}</label>
                <Input type="number" {...form.register('rangeEnd', { valueAsNumber: true })} />
              </div>
            </div>
          </div>
          {errors.rangeEnd && <p className="text-xs text-destructive">{errors.rangeEnd.message}</p>}

          {kind === 'Segment' ? (
            <div className="flex flex-col gap-2">
              <SwitchRow
                label={LABELS.tasks.usePrevMask}
                checked={usePrevMask}
                onChange={(v) => form.setValue('usePrevMask', v)}
              />
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">{LABELS.tasks.detectTargets}</label>
              <div className="flex max-h-56 flex-col gap-2 overflow-y-auto rounded-md border border-border p-2">
                {!labels || labels.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    {LABELS.tasks.noLabels}
                  </p>
                ) : (
                  (targets ?? []).map((t) => {
                    const label = (labels ?? []).find((l) => l.id === t.labelId);
                    return (
                      <div
                        key={t.labelId}
                        className="flex flex-col gap-1 rounded-md border border-border p-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-2">
                            <div
                              className="h-3 w-3 shrink-0 rounded-full"
                              style={{ backgroundColor: label?.color ?? '#888' }}
                            />
                            <span className="truncate text-sm">{label?.name ?? t.labelId}</span>
                          </div>
                          <Switch
                            checked={t.enabled}
                            onCheckedChange={(v) => setTargetEnabled(t.labelId, v)}
                          />
                        </div>
                        {t.enabled && label && label.sub_labels.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {label.sub_labels.map((s) => (
                              <Badge
                                key={s}
                                variant={t.subLabels.includes(s) ? 'default' : 'outline'}
                                className="cursor-pointer"
                                onClick={() => toggleSubLabel(t.labelId, s)}
                              >
                                {s}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
              {errors.targets && (
                <p className="text-xs text-destructive">{errors.targets.message}</p>
              )}
            </div>
          )}
        </form>
      )}

      <DialogFooter>
        <DialogClose
          render={
            <Button type="button" variant="outline" onClick={onCancel}>
              {LABELS.common.cancel}
            </Button>
          }
        />
        <Button onClick={handleSave} disabled={!currentVolume && !isEditing}>
          {LABELS.common.save}
        </Button>
      </DialogFooter>
    </>
  );
}

function SwitchRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border p-2">
      <span className="text-sm">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
