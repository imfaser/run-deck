<script setup lang="ts">
  import { useLabelRawStore } from '@/stores/label-raw';
  import LabelPickerDialog from '@/components/label/LabelPickerDialog.vue';
  import ObjectSelectDialog from '@/components/label/ObjectSelectDialog.vue';

  const store = useLabelRawStore();

  function handleSelectLabel(labelId: string) {
    const pending = store.pendingAnnotation;
    if (!pending) return;

    const obj = store.addObject(labelId);

    if (pending.type === 'point') {
      store.addPointToObject(obj.id, pending.point);
    } else if (pending.type === 'box') {
      store.addBoxToObject(obj.id, pending.box);
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

    const obj = store.addObject(labelId);

    if (pending.type === 'point') {
      store.addPointToObject(obj.id, pending.point);
    } else if (pending.type === 'box') {
      store.addBoxToObject(obj.id, pending.box);
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
