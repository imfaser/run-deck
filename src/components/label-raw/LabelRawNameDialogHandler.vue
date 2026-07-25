<script setup lang="ts">
  import { useLabelRawStore } from '@/stores/label-raw';
  import { useLabelDefStore } from '@/stores/label-def';
  import { VISUAL_REF_SUB_LABEL_ID } from '@/schemas/annotation';
  import LabelPickerDialog from '@/components/label/LabelPickerDialog.vue';
  import ObjectSelectDialog from '@/components/label/ObjectSelectDialog.vue';

  const store = useLabelRawStore();
  const labelDefStore = useLabelDefStore();

  function handleSelectLabel(labelId: string) {
    const pending = store.pendingAnnotation;
    if (!pending) return;

    if (pending.type === 'visual_box') {
      // Enforce one visual box per label
      const existingIdx = store.objects.findIndex(
        (o) => o.subLabelId === VISUAL_REF_SUB_LABEL_ID && o.labelId === labelId
      );
      if (existingIdx >= 0) {
        store.objects.splice(existingIdx, 1);
      }
      const obj = store.addObject(labelId);
      store.objects[store.objects.length - 1].subLabelId = VISUAL_REF_SUB_LABEL_ID;
      store.objects[store.objects.length - 1].boxes = [pending.box];
      labelDefStore.updateLocateConfig(labelId, { visualRefObjectId: obj.id });
    } else {
      const obj = store.addObject(labelId);
      if (pending.type === 'point') {
        store.addPointToObject(obj.id, pending.point);
      } else if (pending.type === 'box') {
        store.addBoxToObject(obj.id, pending.box);
      }
    }

    store.showNameDialog = false;
    store.pendingAnnotation = null;
  }

  function handleCancelName() {
    store.showNameDialog = false;
    store.pendingAnnotation = null;
  }

  function handleSelectObject(objectId: string) {
    const pending = store.pendingAnnotation;
    if (!pending) return;

    // Visual box must be a new object, not added to existing one
    if (pending.type === 'visual_box') return;

    if (pending.type === 'point') {
      store.addPointToObject(objectId, pending.point);
    } else if (pending.type === 'box') {
      store.addBoxToObject(objectId, pending.box);
    }

    store.showSelectDialog = false;
    store.pendingAnnotation = null;
  }

  function handleCreateNewLabel(labelId: string) {
    const pending = store.pendingAnnotation;
    if (!pending) return;

    if (pending.type === 'visual_box') {
      const existingIdx = store.objects.findIndex(
        (o) => o.subLabelId === VISUAL_REF_SUB_LABEL_ID && o.labelId === labelId
      );
      if (existingIdx >= 0) {
        store.objects.splice(existingIdx, 1);
      }
      const obj = store.addObject(labelId);
      store.objects[store.objects.length - 1].subLabelId = VISUAL_REF_SUB_LABEL_ID;
      store.objects[store.objects.length - 1].boxes = [pending.box];
      labelDefStore.updateLocateConfig(labelId, { visualRefObjectId: obj.id });
    } else {
      const obj = store.addObject(labelId);
      if (pending.type === 'point') {
        store.addPointToObject(obj.id, pending.point);
      } else if (pending.type === 'box') {
        store.addBoxToObject(obj.id, pending.box);
      }
    }

    store.showSelectDialog = false;
    store.pendingAnnotation = null;
  }

  function handleCancelSelect() {
    store.showSelectDialog = false;
    store.pendingAnnotation = null;
  }
</script>

<template>
  <LabelPickerDialog
    :visible="store.showNameDialog"
    @select="handleSelectLabel"
    @cancel="handleCancelName"
  />
  <ObjectSelectDialog
    :visible="store.showSelectDialog"
    :objects="store.objects"
    :pending-annotation="store.pendingAnnotation"
    @select="handleSelectObject"
    @create-new="handleCreateNewLabel"
    @cancel="handleCancelSelect"
  />
</template>
