import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { objectColor } from '@/utils/objectColor';
import type { LabelDef } from '@/schemas/label';

export const useLabelDefStore = defineStore(
  'label-def',
  () => {
    // ─── State ──────────────────────────────────────
    const labels = ref<LabelDef[]>([]);

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

    return {
      labels,
      sortedLabels,
      labelById,
      labelByName,
      nextOrder,
      addLabel,
      removeLabel,
      updateLabel,
      updateOrder,
      reorder,
    };
  },
  {
    tauri: {
      autoStart: true,
      syncStrategy: 'debounce',
      syncInterval: 300,
    },
  }
);
