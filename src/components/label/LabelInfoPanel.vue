<script setup lang="ts">
  import { computed } from 'vue';
  import { useLabelStore } from '@/stores/label';

  const store = useLabelStore();

  const hasAnnotations = computed(() => store.annotations.length > 0);
  const activeGroups = computed(() => {
    const groups: string[] = [];
    if (store.positivePoints.length > 0) groups.push('positive');
    if (store.negativePoints.length > 0) groups.push('negative');
    if (store.boxes.length > 0) groups.push('boxes');
    return groups;
  });

  function handleClickItem(id: string) {
    store.selectAnnotation(id);
  }

  function handleDeleteSelected() {
    if (store.selectedId) {
      store.removeAnnotation(store.selectedId);
    }
  }

  function formatPoint(x: number, y: number): string {
    return `${x}, ${y}`;
  }

  function formatBox(x1: number, y1: number, x2: number, y2: number): string {
    return `${x1}, ${y1} → ${x2}, ${y2}`;
  }
</script>

<template>
  <div class="label-info-panel">
    <div class="panel-header">标注信息</div>

    <div class="annotation-content">
      <template v-if="hasAnnotations">
        <el-collapse v-model="activeGroups">
          <el-collapse-item v-if="store.positivePoints.length > 0" name="positive">
            <template #title>
              <span class="group-title">
                <span class="group-dot" style="background: #22c55e"></span>
                正向点 ({{ store.positivePoints.length }})
              </span>
            </template>
            <div
              v-for="ann in store.positivePoints"
              :key="ann.id"
              class="annotation-item"
              :class="{ selected: store.selectedId === ann.id }"
              @click="handleClickItem(ann.id)"
            >
              <span class="item-dot" style="background: #22c55e"></span>
              {{ formatPoint(ann.x, ann.y) }}
            </div>
          </el-collapse-item>

          <el-collapse-item v-if="store.negativePoints.length > 0" name="negative">
            <template #title>
              <span class="group-title">
                <span class="group-dot" style="background: #ef4444"></span>
                负向点 ({{ store.negativePoints.length }})
              </span>
            </template>
            <div
              v-for="ann in store.negativePoints"
              :key="ann.id"
              class="annotation-item"
              :class="{ selected: store.selectedId === ann.id }"
              @click="handleClickItem(ann.id)"
            >
              <span class="item-dot" style="background: #ef4444"></span>
              {{ formatPoint(ann.x, ann.y) }}
            </div>
          </el-collapse-item>

          <el-collapse-item v-if="store.boxes.length > 0" name="boxes">
            <template #title>
              <span class="group-title">
                <span class="group-dot" style="background: #eab308"></span>
                边界框 ({{ store.boxes.length }})
              </span>
            </template>
            <div
              v-for="ann in store.boxes"
              :key="ann.id"
              class="annotation-item"
              :class="{ selected: store.selectedId === ann.id }"
              @click="handleClickItem(ann.id)"
            >
              <span class="item-dot" style="background: #eab308"></span>
              {{ formatBox(ann.x1, ann.y1, ann.x2, ann.y2) }}
            </div>
          </el-collapse-item>
        </el-collapse>
      </template>

      <el-empty v-else description="暂无标注" :image-size="60" />
    </div>

    <div v-if="store.selectedId" class="panel-footer">
      <el-button type="danger" size="small" @click="handleDeleteSelected">删除选中</el-button>
    </div>
  </div>
</template>

<style scoped lang="scss">
  .label-info-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .panel-header {
    padding: var(--spacing-3) var(--spacing-4);
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--el-text-color-primary);
    border-bottom: 1px solid var(--el-border-color);
    flex-shrink: 0;
  }

  .annotation-content {
    flex: 1;
    overflow-y: auto;
    padding: var(--spacing-2);
  }

  .group-title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--text-primary);
  }

  .group-dot {
    width: var(--spacing-2);
    height: var(--spacing-2);
    border-radius: 50%;
    flex-shrink: 0;
  }

  .annotation-item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: var(--spacing-1) var(--spacing-2);
    font-size: var(--text-xs);
    color: var(--text-regular);
    cursor: pointer;
    border-radius: var(--radius-sm);
    transition: background var(--transition-fast);

    &:hover {
      background: var(--surface-hover);
    }

    &.selected {
      background: var(--accent-muted);
      color: var(--accent-primary);
    }
  }

  .item-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .panel-footer {
    padding: var(--spacing-3) var(--spacing-4);
    border-top: 1px solid var(--border-default);
    flex-shrink: 0;
  }
</style>
