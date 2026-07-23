<script setup lang="ts">
  import { ref, computed, watch, nextTick } from 'vue';
  import type { AnnotationObject } from '@/schemas/annotation';

  const props = defineProps<{
    visible: boolean;
    objects: AnnotationObject[];
    pendingAnnotation?: {
      type: 'point' | 'box';
      point?: Record<string, unknown>;
      box?: Record<string, unknown>;
    } | null;
  }>();

  const emit = defineEmits<{
    select: [objectId: string];
    createNew: [name: string];
    cancel: [];
  }>();

  const inputRef = ref<{ input: HTMLInputElement } | null>(null);
  const selectedObjectId = ref<string | null>(null);
  const newObjectName = ref('');
  const mode = ref<'select' | 'create'>('select');

  const canConfirm = computed(() => {
    if (mode.value === 'select') return selectedObjectId.value !== null;
    return newObjectName.value.trim().length > 0;
  });

  watch(
    () => props.visible,
    async (val) => {
      if (val) {
        selectedObjectId.value = null;
        newObjectName.value = '';
        await nextTick();
        mode.value = 'select';
      }
    }
  );

  function handleSelectObject(id: string) {
    selectedObjectId.value = id;
  }

  function handleConfirm() {
    if (!canConfirm.value) return;
    if (mode.value === 'select' && selectedObjectId.value) {
      emit('select', selectedObjectId.value);
    } else if (mode.value === 'create') {
      emit('createNew', newObjectName.value.trim());
    }
  }

  function handleCancel() {
    emit('cancel');
  }

  function switchToCreate() {
    mode.value = 'create';
    nextTick(() => {
      inputRef.value?.input?.focus();
    });
  }

  function switchToSelect() {
    mode.value = 'select';
    newObjectName.value = '';
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

      <div v-if="mode === 'select' && objects.length > 0" class="object-list">
        <div
          v-for="obj in objects"
          :key="obj.id"
          class="object-option"
          :class="{ selected: selectedObjectId === obj.id }"
          @click="handleSelectObject(obj.id)"
        >
          <span class="obj-color" :style="{ background: obj.color }"></span>
          <span class="obj-name">{{ obj.name }}</span>
          <span class="obj-count">({{ obj.points.length + obj.boxes.length }})</span>
          <span v-if="selectedObjectId === obj.id" class="check-icon">✓</span>
        </div>
      </div>

      <div v-if="mode === 'create' || objects.length === 0" class="create-form">
        <el-input
          ref="inputRef"
          v-model="newObjectName"
          placeholder="输入新对象名称"
          maxlength="50"
          clearable
          @keyup.enter="handleConfirm"
        />
      </div>

      <div v-if="objects.length === 0" class="empty-hint">暂无标注对象，请新建一个</div>
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

  .object-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-1);
    max-height: 240px;
    overflow-y: auto;
  }

  .object-option {
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

  .obj-color {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .obj-name {
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
