<script setup lang="ts">
  import { useLabel2dCanvasStore } from '@/stores/canvas-2d';
  import LabelPickerDialog from './LabelPickerDialog.vue';
  import ObjectSelectDialog from './ObjectSelectDialog.vue';

  const canvas = useLabel2dCanvasStore();

  async function handleSelectLabel(labelId: string) {
    const pending = canvas.pendingAnnotation;
    if (!pending) return;

    const obj = await canvas.addObject(labelId);

    if (pending.type === 'point') {
      canvas.addPointToObject(obj.id, pending.point);
    } else if (pending.type === 'box') {
      canvas.addBoxToObject(obj.id, pending.box);
    }

    canvas.showNameDialog = false;
    canvas.pendingAnnotation = null;
  }

  function handleCancelName() {
    canvas.showNameDialog = false;
    canvas.pendingAnnotation = null;
  }

  function handleSelectObject(objectId: string) {
    const pending = canvas.pendingAnnotation;
    if (!pending) return;

    if (pending.type === 'point') {
      canvas.addPointToObject(objectId, pending.point);
    } else if (pending.type === 'box') {
      canvas.addBoxToObject(objectId, pending.box);
    }

    canvas.showSelectDialog = false;
    canvas.pendingAnnotation = null;
  }

  async function handleCreateNewLabel(labelId: string) {
    const pending = canvas.pendingAnnotation;
    if (!pending) return;

    const obj = await canvas.addObject(labelId);

    if (pending.type === 'point') {
      canvas.addPointToObject(obj.id, pending.point);
    } else if (pending.type === 'box') {
      canvas.addBoxToObject(obj.id, pending.box);
    }

    canvas.showSelectDialog = false;
    canvas.pendingAnnotation = null;
  }

  function handleCancelSelect() {
    canvas.showSelectDialog = false;
    canvas.pendingAnnotation = null;
  }
</script>

<template>
  <LabelPickerDialog
    :visible="canvas.showNameDialog"
    @select="handleSelectLabel"
    @cancel="handleCancelName"
  />
  <ObjectSelectDialog
    :visible="canvas.showSelectDialog"
    :objects="canvas.objects"
    :pending-annotation="canvas.pendingAnnotation"
    @select="handleSelectObject"
    @create-new="handleCreateNewLabel"
    @cancel="handleCancelSelect"
  />
</template>
