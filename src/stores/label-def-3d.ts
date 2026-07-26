import { defineStore } from 'pinia';
import { ref } from 'vue';
import { createLabelDefActions } from '@/stores/shared/label-def-actions';
import type { LabelDef, SubLabel } from '@/schemas/label';
import type { LocateConfig, DetectProgress } from '@/schemas/locate';

export type { LocateConfig, DetectProgress };

export const useLabel3dDefStore = defineStore(
  'label-def-3d',
  () => {
    const labels = ref<LabelDef[]>([]);
    const sublabels = ref<SubLabel[]>([]);
    const locateConfigs = ref<LocateConfig[]>([]);
    const detectProgressList = ref<DetectProgress[]>([]);

    const actions = createLabelDefActions({
      labels,
      sublabels,
      locateConfigs,
      detectProgressList,
    });

    return {
      labels,
      sublabels,
      locateConfigs,
      detectProgressList,
      ...actions,
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
