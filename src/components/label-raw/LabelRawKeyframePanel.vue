<script setup lang="ts">
  import { ref } from 'vue';
  import { useLabelRawStore } from '@/stores/label-raw';

  const store = useLabelRawStore();
  const expandedIndex = ref<number | null>(null);

  function formatAnnotation(ann: {
    id: string;
    x?: number;
    y?: number;
    label?: number;
    x1?: number;
    y1?: number;
    x2?: number;
    y2?: number;
  }) {
    if ('label' in ann) {
      const icon = ann.label === 1 ? '✅' : '❌';
      return `${icon} ${ann.x}, ${ann.y}`;
    }
    if ('x1' in ann) {
      return `▭ ${ann.x1}, ${ann.y1} → ${ann.x2}, ${ann.y2}`;
    }
    return '?';
  }

  function handleToggleExpand(index: number, e: Event) {
    e.stopPropagation();
    expandedIndex.value = expandedIndex.value === index ? null : index;
  }

  function handleClick(index: number) {
    if (store.isRecognizing) return;
    store.jumpToKeyframe(index);
  }

  function handleToggleMask(index: number, e: Event) {
    e.stopPropagation();
    store.toggleMaskVisible(index);
  }

  function handleDelete(index: number, e: Event) {
    e.stopPropagation();
    store.removeKeyframe(index);
  }

  function getKfObjects(index: number) {
    return store.keyframes.get(index)?.objects ?? [];
  }
</script>

<template>
  <div class="keyframe-panel">
    <div class="panel-section">
      <div class="panel-title">Slices</div>
      <div class="section-list">
        <div v-if="store.allSlices.length === 0" class="empty-hint">暂无标注或 mask</div>
        <div
          v-for="sl in store.allSlices"
          :key="sl.index"
          class="kf-item"
          :class="{ active: store.currentIndex === sl.index }"
          @click="handleClick(sl.index)"
        >
          <div class="kf-header">
            <span class="kf-expand" @click="(e: Event) => handleToggleExpand(sl.index, e)">
              {{ expandedIndex === sl.index ? '▼' : '▶' }}
            </span>
            <span class="kf-icon">{{ sl.hasMask ? '🎯' : '📝' }}</span>
            <span class="kf-label">Slice {{ sl.index + 1 }}</span>
            <span class="kf-count">({{ sl.annotationCount }})</span>
            <span class="kf-actions">
              <span
                v-if="sl.hasMask"
                class="kf-toggle"
                :title="sl.maskVisible ? '隐藏 mask' : '显示 mask'"
                @click="(e: Event) => handleToggleMask(sl.index, e)"
              >
                {{ sl.maskVisible ? '👁' : '👁‍🗨' }}
              </span>
              <span class="kf-delete" title="删除" @click="(e: Event) => handleDelete(sl.index, e)">
                ✕
              </span>
            </span>
          </div>
          <div v-if="expandedIndex === sl.index" class="kf-detail">
            <div v-if="sl.annotationCount === 0" class="kf-empty">无标注</div>
            <template v-for="obj in getKfObjects(sl.index)" :key="obj.id">
              <div class="kf-object-name" :style="{ color: obj.color }">
                <span class="obj-dot" :style="{ background: obj.color }"></span>
                {{ obj.name }}
              </div>
              <div v-for="ann in [...obj.boxes, ...obj.points]" :key="ann.id" class="kf-ann">
                {{ formatAnnotation(ann) }}
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
  .keyframe-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  .panel-section {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-height: 0;
  }

  .panel-title {
    font-size: var(--text-xs);
    color: var(--text-secondary);
    text-align: center;
    padding: var(--spacing-2);
    border-bottom: 1px solid var(--border-default);
    flex-shrink: 0;
  }

  .section-list {
    flex: 1;
    overflow-y: auto;
    padding: var(--spacing-1);
  }

  .empty-hint {
    font-size: var(--text-xs);
    color: var(--text-secondary);
    text-align: center;
    padding: var(--spacing-3);
    font-style: italic;
  }

  .kf-item {
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: background var(--transition-fast);
    margin-bottom: 2px;

    &:hover {
      background: var(--surface-hover);
    }

    &.active {
      background: var(--accent-primary);
      color: var(--text-inverse);
    }
  }

  .kf-header {
    display: flex;
    align-items: center;
    gap: var(--spacing-2);
    padding: var(--spacing-1) var(--spacing-2);
    font-size: var(--text-sm);
  }

  .kf-expand {
    font-size: 10px;
    width: 12px;
    text-align: center;
    flex-shrink: 0;
    opacity: 0.6;
  }

  .kf-icon {
    font-size: var(--text-xs);
    flex-shrink: 0;
  }

  .kf-label {
    flex: 1;
    font-family: monospace;
  }

  .kf-count {
    color: var(--text-secondary);
    font-size: var(--text-xs);
  }

  .kf-item.active .kf-count {
    color: var(--text-inverse);
  }

  .kf-actions {
    display: flex;
    align-items: center;
    gap: 2px;
    flex-shrink: 0;
  }

  .kf-toggle,
  .kf-delete {
    font-size: 10px;
    cursor: pointer;
    opacity: 0.5;
    transition: opacity var(--transition-fast);
    padding: 2px;

    &:hover {
      opacity: 1;
    }
  }

  .kf-detail {
    padding: 0 var(--spacing-2) var(--spacing-1);
    padding-left: calc(var(--spacing-2) + 12px + var(--spacing-2));
  }

  .kf-empty {
    font-size: var(--text-xs);
    color: var(--text-secondary);
    font-style: italic;
  }

  .kf-object-name {
    font-size: 11px;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 2px 0;
    margin-top: 2px;
  }

  .obj-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .kf-ann {
    font-size: 11px;
    font-family: monospace;
    padding: 1px 0 1px 10px;
    opacity: 0.8;
    white-space: nowrap;
  }

  .kf-item.active .kf-ann {
    opacity: 0.9;
  }
</style>
