<script setup lang="ts">
  import { ref, computed, watch, nextTick } from 'vue';
  import type { AnnotationObject } from '@/schemas/annotation';
  import { useLabelDefStore } from '@/stores/label-def';

  const props = defineProps<{
    visible: boolean;
    objects: AnnotationObject[];
    pendingAnnotation?: {
      type: 'point' | 'box' | 'visual_box';
      point?: Record<string, unknown>;
      box?: Record<string, unknown>;
    } | null;
  }>();

  const emit = defineEmits<{
    select: [objectId: string];
    createNew: [labelId: string];
    cancel: [];
  }>();

  const labelDefStore = useLabelDefStore();
  const selectedObjectId = ref<string | null>(null);
  const selectedNewLabelId = ref<string | null>(null);
  const mode = ref<'select' | 'create'>('select');

  const canConfirm = computed(() => {
    if (mode.value === 'select') return selectedObjectId.value !== null;
    return selectedNewLabelId.value !== null;
  });

  const hasLabels = computed(() => labelDefStore.labels.length > 0);

  watch(
    () => props.visible,
    async (val) => {
      if (val) {
        selectedObjectId.value = null;
        selectedNewLabelId.value = null;
        await nextTick();
        mode.value = 'select';
      }
    }
  );

  function handleSelectObject(id: string) {
    selectedObjectId.value = id;
  }

  function handleSelectNewLabel(labelId: string) {
    selectedNewLabelId.value = labelId;
  }

  function handleConfirm() {
    if (!canConfirm.value) return;
    if (mode.value === 'select' && selectedObjectId.value) {
      emit('select', selectedObjectId.value);
    } else if (mode.value === 'create' && selectedNewLabelId.value) {
      emit('createNew', selectedNewLabelId.value);
    }
  }

  function handleCancel() {
    emit('cancel');
  }

  function switchToCreate() {
    mode.value = 'create';
    selectedNewLabelId.value = null;
  }

  function switchToSelect() {
    mode.value = 'select';
    selectedNewLabelId.value = null;
  }
</script>

<template>
  <el-dialog
    :model-value="visible"
    title="选择标注对象"
    width="360px"
    :close-on-click-modal="false"
    :close-on-press-escape="true"
    :show-close="false"
    @close="handleCancel"
  >
    <div class="dialog-content">
      <div v-if="objects.length > 0" class="mode-tabs">
        <span class="tab" :class="{ active: mode === 'select' }" @click="switchToSelect">
          选择现有对象
        </span>
        <span class="tab" :class="{ active: mode === 'create' }" @click="switchToCreate">
          新建对象
        </span>
      </div>

      <!-- Existing objects on current slice -->
      <div v-if="mode === 'select' && objects.length > 0" class="object-list">
        <div
          v-for="obj in objects"
          :key="obj.id"
          class="object-option"
          :class="{ selected: selectedObjectId === obj.id }"
          @click="handleSelectObject(obj.id)"
        >
          <span
            class="obj-color"
            :style="{ background: labelDefStore.labelById(obj.labelId)?.color ?? '#888' }"
          ></span>
          <span class="obj-name">
            {{ labelDefStore.labelById(obj.labelId)?.name ?? 'Unknown' }}
          </span>
          <span class="obj-count">({{ obj.points.length + obj.boxes.length }})</span>
          <span v-if="selectedObjectId === obj.id" class="check-icon">✓</span>
        </div>
      </div>

      <!-- Pick a global label to create new object -->
      <div v-if="mode === 'create' || objects.length === 0" class="create-form">
        <div v-if="hasLabels" class="label-list">
          <div
            v-for="label in labelDefStore.sortedLabels"
            :key="label.id"
            class="label-option"
            :class="{ selected: selectedNewLabelId === label.id }"
            @click="handleSelectNewLabel(label.id)"
          >
            <span class="label-color" :style="{ background: label.color }"></span>
            <span class="label-name">{{ label.name }}</span>
            <span v-if="selectedNewLabelId === label.id" class="check-icon">✓</span>
          </div>
        </div>
        <div v-else class="empty-hint">暂无 Label，请先在标注设置中创建</div>
      </div>
    </div>

    <template #footer>
      <el-button @click="handleCancel">取消</el-button>
      <el-button type="primary" :disabled="!canConfirm" @click="handleConfirm">
        {{ mode === 'select' ? '选择' : '创建' }}
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped lang="scss">
  .dialog-content {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-3);
  }

  .mode-tabs {
    display: flex;
    gap: var(--spacing-2);
    border-bottom: 1px solid var(--border-default);
    padding-bottom: var(--spacing-2);
  }

  .tab {
    flex: 1;
    text-align: center;
    padding: var(--spacing-2);
    font-size: var(--text-sm);
    cursor: pointer;
    border-radius: var(--radius-md);
    transition: all var(--transition-fast);

    &:hover {
      background: var(--surface-hover);
    }

    &.active {
      background: var(--accent-muted);
      color: var(--accent-primary);
      font-weight: 500;
    }
  }

  .object-list,
  .label-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-1);
    max-height: 240px;
    overflow-y: auto;
  }

  .object-option,
  .label-option {
    display: flex;
    align-items: center;
    gap: var(--spacing-2);
    padding: var(--spacing-2) var(--spacing-3);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: background var(--transition-fast);

    &:hover {
      background: var(--surface-hover);
    }

    &.selected {
      background: var(--accent-muted);
      border: 1px solid var(--accent-primary);
    }
  }

  .obj-color,
  .label-color {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .obj-name,
  .label-name {
    flex: 1;
    font-size: var(--text-sm);
    font-weight: 500;
  }

  .obj-count {
    font-size: var(--text-xs);
    color: var(--text-secondary);
  }

  .check-icon {
    color: var(--accent-primary);
    font-weight: bold;
  }

  .create-form {
    padding: var(--spacing-2) 0;
  }

  .empty-hint {
    font-size: var(--text-xs);
    color: var(--text-secondary);
    text-align: center;
    padding: var(--spacing-2);
    font-style: italic;
  }
</style>
