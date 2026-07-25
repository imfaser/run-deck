import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { objectColor } from '@/utils/objectColor';
import type { LabelDef, SubLabel } from '@/schemas/label';
import type { LocateConfig, DetectProgress } from '@/schemas/locate';

export type { LocateConfig, DetectProgress };

export const useLabelDefStore = defineStore(
  'label-def',
  () => {
    // ─── State ──────────────────────────────────────
    const labels = ref<LabelDef[]>([]);
    const sublabels = ref<SubLabel[]>([]);
    const locateConfigs = ref<LocateConfig[]>([]);
    const detectProgressList = ref<DetectProgress[]>([]);
    const appMode = ref<'2d' | '3d'>('2d');

    // ─── Getters ────────────────────────────────────
    const sortedLabels = computed(() => [...labels.value].sort((a, b) => a.order - b.order));

    const labelById = computed(() => {
      const map = new Map(labels.value.map((l) => [l.id, l]));
      return (id: string) => map.get(id);
    });

    const labelByName = computed(() => {
      const map = new Map(labels.value.map((l) => [l.name, l]));
      return (name: string) => map.get(name);
    });

    const nextOrder = computed(() => {
      if (labels.value.length === 0) return 1;
      return Math.max(...labels.value.map((l) => l.order)) + 1;
    });

    const subLabelsByParent = computed(() => {
      const map = new Map<string, SubLabel[]>();
      for (const sl of sublabels.value) {
        const list = map.get(sl.parentId) ?? [];
        list.push(sl);
        map.set(sl.parentId, list);
      }
      return (parentId: string) => map.get(parentId) ?? [];
    });

    const subLabelByName = computed(() => {
      const map = new Map(sublabels.value.map((sl) => [sl.name, sl]));
      return (name: string) => map.get(name);
    });

    function getLocateConfig(labelId: string): LocateConfig | undefined {
      return locateConfigs.value.find((c) => c.labelId === labelId);
    }

    function getDetectProgress(labelId: string): DetectProgress | undefined {
      return detectProgressList.value.find((p) => p.labelId === labelId);
    }

    function updateDetectProgress(
      labelId: string,
      patch: Partial<Omit<DetectProgress, 'labelId'>>
    ) {
      const existing = detectProgressList.value.find((p) => p.labelId === labelId);
      if (existing) {
        Object.assign(existing, patch);
      } else {
        detectProgressList.value.push({
          labelId,
          current: 0,
          total: 0,
          status: 'idle',
          ...patch,
        });
      }
    }

    function resetDetectProgress(labelId: string) {
      detectProgressList.value = detectProgressList.value.filter((p) => p.labelId !== labelId);
    }

    // ─── Actions ────────────────────────────────────
    function addLabel(name: string, color?: string): LabelDef {
      if (labelByName.value(name)) {
        throw new Error(`Label "${name}" already exists`);
      }

      const order = nextOrder.value;
      if (order > 255) {
        throw new Error('Maximum 255 labels reached');
      }

      const label: LabelDef = {
        id: crypto.randomUUID(),
        name,
        color: color ?? objectColor(name),
        order,
      };
      labels.value.push(label);
      return label;
    }

    function removeLabel(id: string) {
      labels.value = labels.value.filter((l) => l.id !== id);
      // Cascade delete sublabels and configs
      sublabels.value = sublabels.value.filter((sl) => sl.parentId !== id);
      locateConfigs.value = locateConfigs.value.filter((c) => c.labelId !== id);
    }

    function updateLabel(id: string, patch: Partial<Pick<LabelDef, 'name' | 'color' | 'order'>>) {
      const label = labels.value.find((l) => l.id === id);
      if (!label) return;

      if (patch.name !== undefined && patch.name !== label.name) {
        if (!patch.name.trim()) throw new Error('Label name cannot be empty');
        if (labelByName.value(patch.name)) {
          throw new Error(`Label "${patch.name}" already exists`);
        }
        label.name = patch.name;
      }

      if (patch.color !== undefined) label.color = patch.color;

      if (patch.order !== undefined && patch.order !== label.order) {
        updateOrder(id, patch.order);
      }
    }

    function updateOrder(id: string, newOrder: number) {
      const clamped = Math.min(255, Math.max(1, newOrder));
      const target = labels.value.find((l) => l.id === id);
      if (!target || target.order === clamped) return;

      const conflict = labels.value.find((l) => l.id !== id && l.order === clamped);
      if (conflict) {
        conflict.order = target.order;
      }
      target.order = clamped;
    }

    function reorder(fromIndex: number, toIndex: number) {
      const item = labels.value.splice(fromIndex, 1)[0];
      if (item) {
        labels.value.splice(toIndex, 0, item);
        labels.value.forEach((l, i) => (l.order = i + 1));
      }
    }

    // ─── SubLabel Actions ────────────────────────────
    function addSubLabel(parentId: string, name: string): SubLabel {
      const existing = sublabels.value.find((sl) => sl.parentId === parentId && sl.name === name);
      if (existing) {
        throw new Error(`子标签 "${name}" 已存在`);
      }

      const subLabel: SubLabel = {
        id: crypto.randomUUID(),
        parentId,
        name,
      };
      sublabels.value.push(subLabel);
      return subLabel;
    }

    function removeSubLabel(id: string) {
      sublabels.value = sublabels.value.filter((sl) => sl.id !== id);
    }

    function updateSubLabel(id: string, patch: Partial<Pick<SubLabel, 'name'>>) {
      const sl = sublabels.value.find((s) => s.id === id);
      if (!sl) return;

      if (patch.name !== undefined && patch.name !== sl.name) {
        if (!patch.name.trim()) throw new Error('子标签名不能为空');
        const conflict = sublabels.value.find(
          (s) => s.parentId === sl.parentId && s.name === patch.name && s.id !== id
        );
        if (conflict) {
          throw new Error(`子标签 "${patch.name}" 已存在`);
        }
        sl.name = patch.name;
      }
    }

    // ─── LocateConfig Actions ────────────────────────
    function updateLocateConfig(labelId: string, patch: Partial<Omit<LocateConfig, 'labelId'>>) {
      const existing = locateConfigs.value.find((c) => c.labelId === labelId);
      if (existing) {
        Object.assign(existing, patch);
      } else {
        locateConfigs.value.push({
          labelId,
          mode: 'detect',
          visualType: 'slice_crop',
          visualRefObjectId: null,
          visualRefImagePath: null,
          rangeStart: 0,
          rangeEnd: 0,
          ...patch,
        });
      }
    }

    return {
      labels,
      sublabels,
      locateConfigs,
      detectProgressList,
      appMode,
      sortedLabels,
      labelById,
      labelByName,
      nextOrder,
      subLabelsByParent,
      subLabelByName,
      getLocateConfig,
      getDetectProgress,
      updateDetectProgress,
      resetDetectProgress,
      addLabel,
      removeLabel,
      updateLabel,
      updateOrder,
      reorder,
      addSubLabel,
      removeSubLabel,
      updateSubLabel,
      updateLocateConfig,
    };
  },
  {
    tauri: {
      autoStart: true,
      sync: true,
      syncStrategy: 'debounce',
      syncInterval: 300,
      filterKeys: ['labels', 'sublabels', 'locateConfigs'],
      filterKeysStrategy: 'pick',
    },
  }
);
