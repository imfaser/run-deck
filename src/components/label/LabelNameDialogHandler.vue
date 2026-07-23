<script setup lang="ts">
  import { useLabelStore } from '@/stores/label';
  import ObjectNameDialog from './ObjectNameDialog.vue';
  import ObjectSelectDialog from './ObjectSelectDialog.vue';

  const store = useLabelStore();

  function handleConfirmName(name: string) {
    const pending = store.pendingAnnotation;
    if (!pending) return;

    const obj = store.addObject(name);

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

  function handleCreateNewObject(name: string) {
    const pending = store.pendingAnnotation;
    if (!pending) return;

    const obj = store.addObject(name);

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
  <ObjectNameDialog
    :visible="store.showNameDialog"
    @confirm="handleConfirmName"
    @cancel="handleCancelName"
  />
  <ObjectSelectDialog
    :visible="store.showSelectDialog"
    :objects="store.objects"
    :pending-annotation="store.pendingAnnotation"
    @select="handleSelectObject"
    @create-new="handleCreateNewObject"
    @cancel="handleCancelSelect"
  />
</template>
