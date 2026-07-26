<script setup lang="ts">
  import { ref, computed, watch } from 'vue';
  import { useLabel3dCanvasStore } from '@/stores/canvas-3d';
  import { useLabel3dStore } from '@/stores/label-3d';
  import { useLabel3dRecognizeStore } from '@/stores/recognize';
  import { useLabel3dDefStore } from '@/stores/label-def-3d';
  import { ElMessage } from 'element-plus/es/components/message/index.mjs';
  import { getKeyframe } from '@/db/keyframe-repo';
  import { logMessage } from '@/services/cmd';
  import type { AnnotationObject } from '@/schemas/annotation';

  const canvas = useLabel3dCanvasStore();
  const label3d = useLabel3dStore();
  const recognize = useLabel3dRecognizeStore();
  const labelDefStore = useLabel3dDefStore();
  const expandedIndex = ref<number | null>(null);
  const expandedObjects = ref<AnnotationObject[]>([]);

  const isCurrentSlice = computed(
    () => expandedIndex.value !== null && expandedIndex.value === label3d.currentIndex
  );

  const selectedAnnotationId = computed(() => canvas.selectedAnnotationId);

  const selectedAnnotationInfo = computed(() => {
    if (!selectedAnnotationId.value) return null;
    for (const obj of canvas.objects) {
      const point = obj.points.find((p) => p.id === selectedAnnotationId.value);
      if (point) return { objectId: obj.id, type: 'point' as const };
      const box = obj.boxes.find((b) => b.id === selectedAnnotationId.value);
      if (box) return { objectId: obj.id, type: 'box' as const };
    }
    return null;
  });

  const availableObjects = computed(() => {
    if (!selectedAnnotationInfo.value) return [];
    return canvas.objects.filter(
      (o) =>
        o.id !== selectedAnnotationInfo.value!.objectId &&
        !o.boxes.some((b) => b.boxType === 'visual_ref')
    );
  });

  watch(expandedIndex, async (idx) => {
    if (idx === null || !label3d.volumeId) {
      expandedObjects.value = [];
      return;
    }
    try {
      const kf = await getKeyframe(label3d.volumeId, idx);
      expandedObjects.value = kf?.objects ?? [];
    } catch (e) {
      expandedObjects.value = [];
      await logMessage('warn', `[keyframe-panel] failed to load expanded slice=${idx}: ${e}`);
    }
  });

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
    if (recognize.isRecognizing) return;
    label3d.jumpToKeyframe(index);
  }

  function handleToggleMask(index: number, e: Event) {
    e.stopPropagation();
    label3d.toggleMaskVisible(index);
  }

  function handleDelete(index: number, e: Event) {
    e.stopPropagation();
    label3d.removeKeyframe(index);
  }

  function handleAnnotationClick(annId: string) {
    if (!isCurrentSlice.value) {
      logMessage('debug', `[keyframe-panel] annClick ignored: not current slice`);
      return;
    }
    logMessage(
      'debug',
      `[keyframe-panel] annClick annId=${annId} currentSelected=${canvas.selectedAnnotationId}`
    );
    canvas.selectAnnotation(annId);
  }

  function handleDeleteSelected() {
    if (canvas.selectedAnnotationId) {
      canvas.removeAnnotationFromObject(canvas.selectedAnnotationId);
      ElMessage.success('已删除标注');
    }
  }

  function handleReassign(targetId: string) {
    if (!canvas.selectedAnnotationId) return;
    canvas.reassignAnnotation(canvas.selectedAnnotationId, targetId);
    ElMessage.success('已转移标注');
  }

  const isSelectedBox = computed(() => {
    if (!selectedAnnotationInfo.value) return false;
    return selectedAnnotationInfo.value.type === 'box';
  });

  const isSelectedVisualBox = computed(() => {
    if (!selectedAnnotationInfo.value || selectedAnnotationInfo.value.type !== 'box') return false;
    for (const obj of canvas.objects) {
      const box = obj.boxes.find((b) => b.id === canvas.selectedAnnotationId);
      if (box) return box.boxType === 'visual_ref';
    }
    return false;
  });

  function handleSetAsVisualBox() {
    if (!canvas.selectedAnnotationId) return;

    for (const obj of canvas.objects) {
      const box = obj.boxes.find((b) => b.id === canvas.selectedAnnotationId);
      if (box) {
        for (const otherObj of canvas.objects) {
          if (otherObj.id !== obj.id && otherObj.labelId === obj.labelId) {
            for (const otherBox of otherObj.boxes) {
              if (otherBox.boxType === 'visual_ref') {
                otherBox.boxType = undefined;
              }
            }
          }
        }
        for (const sameObjBox of obj.boxes) {
          if (sameObjBox.id !== box.id && sameObjBox.boxType === 'visual_ref') {
            sameObjBox.boxType = undefined;
          }
        }

        const success = canvas.setAsVisualBox(canvas.selectedAnnotationId);
        if (success) {
          labelDefStore.updateLocateConfig(obj.labelId, {
            visualRefObjectId: obj.id,
          });
          ElMessage.success('已设为 Visual Box');
        }
        break;
      }
    }
  }
</script>

<template>
  <div class="keyframe-panel">
    <div class="panel-section">
      <div class="panel-title">Slices</div>
      <div class="section-list">
        <div v-if="label3d.allSlices.length === 0" class="empty-hint">暂无标注或 mask</div>
        <div
          v-for="sl in label3d.allSlices"
          :key="sl.index"
          class="kf-item"
          :class="{ active: label3d.currentIndex === sl.index }"
          @click="handleClick(sl.index)"
        >
          <div class="kf-header">
            <span class="kf-expand" @click="(e: Event) => handleToggleExpand(sl.index, e)">
              {{ expandedIndex === sl.index ? '▼' : '▶' }}
            </span>
            <span class="kf-icon">{{ sl.hasMask ? '🎯' : '📝' }}</span>
            <span class="kf-label">Slice {{ sl.index }}</span>
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
            <template v-for="obj in expandedObjects" :key="obj.id">
              <div
                class="kf-object-name"
                :style="{ color: labelDefStore.labelById(obj.labelId)?.color ?? '#888' }"
              >
                <span
                  class="obj-dot"
                  :style="{ background: labelDefStore.labelById(obj.labelId)?.color ?? '#888' }"
                ></span>
                {{ labelDefStore.labelById(obj.labelId)?.name ?? 'Unknown' }}
              </div>
              <div
                v-for="ann in [...obj.boxes, ...obj.points]"
                :key="ann.id"
                class="kf-ann"
                :class="{
                  selected: isCurrentSlice && selectedAnnotationId === ann.id,
                  clickable: isCurrentSlice,
                }"
                @click.stop="handleAnnotationClick(ann.id)"
              >
                {{ formatAnnotation(ann) }}
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>

    <div v-if="selectedAnnotationId" class="panel-footer">
      <div class="footer-actions">
        <el-button
          v-if="isSelectedBox && !isSelectedVisualBox"
          size="small"
          title="设为 Visual Box"
          @click="handleSetAsVisualBox"
        >
          📷
        </el-button>
        <el-select
          :model-value="null"
          placeholder="转移对象"
          size="small"
          style="width: 110px"
          @change="(val: string) => val && handleReassign(val)"
        >
          <el-option
            v-for="obj in availableObjects"
            :key="obj.id"
            :value="obj.id"
            :label="labelDefStore.labelById(obj.labelId)?.name ?? 'Unknown'"
          >
            <span
              class="dropdown-obj-color"
              :style="{ background: labelDefStore.labelById(obj.labelId)?.color ?? '#888' }"
            ></span>
            {{ labelDefStore.labelById(obj.labelId)?.name ?? 'Unknown' }}
          </el-option>
        </el-select>
        <el-button type="danger" size="small" @click="handleDeleteSelected">删除标注</el-button>
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
    padding: 2px 4px;
    border-radius: var(--radius-sm);
    opacity: 0.8;
    white-space: nowrap;
    transition: background var(--transition-fast);

    &.clickable {
      cursor: pointer;

      &:hover {
        background: var(--surface-hover);
      }
    }

    &.selected {
      background: var(--accent-muted);
      opacity: 1;
      font-weight: 500;
    }
  }

  .kf-item.active .kf-ann {
    opacity: 0.9;
  }

  .panel-footer {
    padding: var(--spacing-2) var(--spacing-3);
    border-top: 1px solid var(--border-default);
    flex-shrink: 0;
  }

  .footer-actions {
    display: flex;
    gap: var(--spacing-2);
    justify-content: flex-end;
  }

  .dropdown-obj-color {
    display: inline-block;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    margin-right: 6px;
    vertical-align: middle;
  }
</style>
