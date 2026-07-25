<script setup lang="ts">
  import { computed } from 'vue';
  import { useLabelDefStore } from '@/stores/label-def';

  defineProps<{
    visible: boolean;
  }>();

  const emit = defineEmits<{
    select: [labelId: string];
    cancel: [];
  }>();

  const labelDefStore = useLabelDefStore();

  const hasLabels = computed(() => labelDefStore.labels.length > 0);

  function handleSelect(labelId: string) {
    emit('select', labelId);
  }

  function handleCancel() {
    emit('cancel');
  }
</script>

<template>
  <el-dialog
    :model-value="visible"
    title="选择 Label"
    width="360px"
    :close-on-click-modal="false"
    :close-on-press-escape="true"
    :show-close="false"
    @close="handleCancel"
  >
    <div v-if="hasLabels" class="label-list">
      <div
        v-for="label in labelDefStore.sortedLabels"
        :key="label.id"
        class="label-option"
        @click="handleSelect(label.id)"
      >
        <span class="label-color" :style="{ background: label.color }"></span>
        <span class="label-name">{{ label.name }}</span>
        <span class="label-order">{{ label.order }}</span>
      </div>
    </div>

    <div v-else class="empty-hint">暂无 Label，请先在标注设置中创建</div>

    <template #footer>
      <el-button @click="handleCancel">取消</el-button>
    </template>
  </el-dialog>
</template>

<style scoped lang="scss">
  .label-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-1);
    max-height: 320px;
    overflow-y: auto;
  }

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
  }

  .label-color {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .label-name {
    flex: 1;
    font-size: var(--text-sm);
    font-weight: 500;
  }

  .label-order {
    font-size: var(--text-xs);
    color: var(--text-secondary);
  }

  .empty-hint {
    font-size: var(--text-xs);
    color: var(--text-secondary);
    text-align: center;
    padding: var(--spacing-3);
    font-style: italic;
  }
</style>
