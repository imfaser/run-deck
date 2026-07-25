<script setup lang="ts">
  import { computed, ref, watch } from 'vue';
  import { useLabelStore } from '@/stores/label';
  import { useLabelDefStore } from '@/stores/label-def';
  import { ElMessage, ElMessageBox } from 'element-plus';
  import { logMessage } from '@/services/cmd';

  const store = useLabelStore();
  const labelDefStore = useLabelDefStore();
  const expandedObjects = ref<Set<string>>(
    new Set([store.currentObjectId].filter(Boolean) as string[])
  );
  const showNewLabelPicker = ref(false);
  const pendingReassign = ref(false);

  watch(
    () => store.selectedAnnotationId,
    (val, oldVal) => {
      logMessage(
        'debug',
        `[info-panel] selectedAnnotationId changed: ${oldVal} → ${val} mode=${store.mode}`
      );
    }
  );

  watch(
    () => store.objects.length,
    (len) => {
      logMessage(
        'debug',
        `[info-panel] objects count: ${len} ids=${store.objects.map((o) => o.id).join(',')} boxes=${store.objects.map((o) => o.boxes.length).join(',')} points=${store.objects.map((o) => o.points.length).join(',')}`
      );
    },
    { immediate: true }
  );

  const hasObjects = computed(() => store.objects.length > 0);

  const sourceObjectId = computed(() => {
    if (!store.selectedAnnotationId) return null;
    const sourceObj = store.objects.find(
      (o) =>
        o.points.some((p) => p.id === store.selectedAnnotationId) ||
        o.boxes.some((b) => b.id === store.selectedAnnotationId)
    );
    return sourceObj?.id ?? null;
  });

  const availableObjects = computed(() => {
    if (!sourceObjectId.value) return [];
    return store.objects.filter((o) => o.id !== sourceObjectId.value);
  });

  function toggleObjectExpand(id: string) {
    logMessage(
      'debug',
      `[info-panel] toggleExpand id=${id} wasExpanded=${expandedObjects.value.has(id)} objects=${store.objects.length} boxes=${store.objects.find((o) => o.id === id)?.boxes.length ?? 0} points=${store.objects.find((o) => o.id === id)?.points.length ?? 0}`
    );
    if (expandedObjects.value.has(id)) {
      expandedObjects.value.delete(id);
    } else {
      expandedObjects.value.add(id);
    }
  }

  function handleClickObject(id: string) {
    logMessage('debug', `[info-panel] clickObject id=${id} mode=${store.mode}`);
    store.setCurrentObject(id);
  }

  function handleClickAnnotation(annId: string) {
    logMessage(
      'debug',
      `[info-panel] clickAnnotation annId=${annId} currentSelected=${store.selectedAnnotationId} mode=${store.mode}`
    );
    store.selectAnnotation(annId);
    logMessage(
      'debug',
      `[info-panel] clickAnnotation after select selectedAnnotationId=${store.selectedAnnotationId}`
    );
  }

  function handleDeleteSelected() {
    if (store.selectedAnnotationId) {
      store.removeAnnotationFromObject(store.selectedAnnotationId);
    }
  }

  function handleReassign(targetId: string) {
    if (!store.selectedAnnotationId) return;
    if (targetId === '__create_new__') {
      showNewLabelPicker.value = true;
      pendingReassign.value = true;
      return;
    }
    store.reassignAnnotation(store.selectedAnnotationId, targetId);
    ElMessage.success('已转移标注');
  }

  async function handleDeleteObject(id: string) {
    try {
      await ElMessageBox.confirm('删除对象将同时删除其所有标注，确定？', '确认删除', {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning',
      });
      store.removeObject(id);
    } catch {
      // cancelled
    }
  }

  function handlePickNewLabel(labelId: string) {
    const obj = store.addObject(labelId);
    expandedObjects.value.add(obj.id);
    showNewLabelPicker.value = false;

    if (pendingReassign.value && store.selectedAnnotationId) {
      store.reassignAnnotation(store.selectedAnnotationId, obj.id);
      pendingReassign.value = false;
      ElMessage.success('已转移标注');
    } else {
      const name = labelDefStore.labelById(labelId)?.name ?? 'Unknown';
      ElMessage.success(`已创建对象: ${name}`);
    }
  }

  function handleCancelNewObject() {
    showNewLabelPicker.value = false;
    pendingReassign.value = false;
  }
</script>

<template>
  <div class="label-info-panel">
    <div class="panel-header">
      <span class="panel-title">标注对象</span>
      <span
        v-if="!showNewLabelPicker"
        class="add-object-btn"
        title="新建对象"
        @click="showNewLabelPicker = true"
      >
        ＋
      </span>
    </div>

    <div v-if="showNewLabelPicker" class="new-object-form">
      <div class="label-picker-inline">
        <div
          v-for="label in labelDefStore.sortedLabels"
          :key="label.id"
          class="label-pick-item"
          @click="handlePickNewLabel(label.id)"
        >
          <span class="label-dot" :style="{ background: label.color }"></span>
          <span>{{ label.name }}</span>
        </div>
        <div v-if="labelDefStore.labels.length === 0" class="empty-labels">
          暂无 Label，请先在标注设置中创建
        </div>
      </div>
      <span class="form-actions">
        <span class="form-btn cancel" title="取消" @click="handleCancelNewObject">✕</span>
      </span>
    </div>

    <div class="annotation-content">
      <template v-if="hasObjects">
        <div
          v-for="obj in store.objects"
          :key="obj.id"
          class="object-group"
          :class="{ active: store.currentObjectId === obj.id }"
        >
          <div class="object-header" @click="handleClickObject(obj.id)">
            <span
              class="object-expand"
              :class="{ expanded: expandedObjects.has(obj.id) }"
              @click.stop="toggleObjectExpand(obj.id)"
            >
              ▶
            </span>
            <span
              class="object-color"
              :style="{ background: labelDefStore.labelById(obj.labelId)?.color ?? '#888' }"
            ></span>
            <span class="object-name">
              {{ labelDefStore.labelById(obj.labelId)?.name ?? 'Unknown' }}
            </span>
            <span class="object-count">({{ obj.points.length + obj.boxes.length }})</span>
            <span class="object-actions">
              <span class="obj-delete" title="删除对象" @click.stop="handleDeleteObject(obj.id)">
                ✕
              </span>
            </span>
          </div>

          <div v-if="expandedObjects.has(obj.id)" class="object-detail">
            <div
              v-for="box in obj.boxes"
              :key="box.id"
              class="annotation-item"
              :class="{ selected: store.selectedAnnotationId === box.id }"
              @click="handleClickAnnotation(box.id)"
            >
              <span class="ann-coords box-coords">
                <span
                  class="ann-icon"
                  :style="{ color: labelDefStore.labelById(obj.labelId)?.color ?? '#888' }"
                >
                  ▭
                </span>
                <span class="coords-text">
                  {{ box.x1 }}, {{ box.y1 }} → {{ box.x2 }}, {{ box.y2 }}
                </span>
              </span>
            </div>
            <div
              v-for="point in obj.points"
              :key="point.id"
              class="annotation-item"
              :class="{ selected: store.selectedAnnotationId === point.id }"
              @click="handleClickAnnotation(point.id)"
            >
              <span class="ann-coords point-coords">
                <span class="ann-icon" :class="point.label === 1 ? 'positive' : 'negative'">
                  {{ point.label === 1 ? '✅' : '❌' }}
                </span>
                <span class="coords-text">{{ point.x }}, {{ point.y }}</span>
              </span>
            </div>
          </div>
        </div>
      </template>

      <el-empty v-else description="暂无标注对象" :image-size="60" />
    </div>

    <div class="panel-footer">
      <div class="footer-actions">
        <el-select
          :model-value="null"
          :placeholder="availableObjects.length === 0 ? '无其他对象' : '转移对象'"
          size="small"
          :disabled="!store.selectedAnnotationId || availableObjects.length === 0"
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
        <el-button
          type="danger"
          size="small"
          :disabled="!store.selectedAnnotationId"
          @click="handleDeleteSelected"
        >
          删除标注
        </el-button>
      </div>
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
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--spacing-3) var(--spacing-4);
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--el-text-color-primary);
    border-bottom: 1px solid var(--el-border-color);
    flex-shrink: 0;
  }

  .panel-title {
    flex: 1;
  }

  .add-object-btn {
    font-size: 16px;
    cursor: pointer;
    opacity: 0.6;
    transition: opacity var(--transition-fast);
    padding: 0 4px;

    &:hover {
      opacity: 1;
    }
  }

  .new-object-form {
    display: flex;
    align-items: flex-start;
    gap: 4px;
    padding: var(--spacing-2);
    border-bottom: 1px solid var(--border-default);
    flex-shrink: 0;
  }

  .label-picker-inline {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    max-height: 160px;
    overflow-y: auto;
  }

  .label-pick-item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-size: var(--text-xs);
    transition: background var(--transition-fast);

    &:hover {
      background: var(--surface-hover);
    }
  }

  .label-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .empty-labels {
    font-size: var(--text-xs);
    color: var(--text-secondary);
    text-align: center;
    padding: var(--spacing-2);
  }

  .form-actions {
    display: flex;
    gap: 2px;
    flex-shrink: 0;
  }

  .form-btn {
    font-size: 12px;
    cursor: pointer;
    padding: 2px 4px;
    border-radius: var(--radius-sm);
    transition: background var(--transition-fast);

    &.cancel {
      color: var(--color-danger);

      &:hover {
        background: var(--color-danger-light);
      }
    }
  }

  .annotation-content {
    flex: 1;
    overflow-y: auto;
    padding: var(--spacing-2);
  }

  .object-group {
    border-radius: var(--radius-md);
    margin-bottom: var(--spacing-1);
    transition: background var(--transition-fast);

    &.active {
      background: var(--accent-muted);
      border-left: 3px solid var(--accent-primary);
    }
  }

  .object-header {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: var(--spacing-2) var(--spacing-2);
    cursor: pointer;
    font-size: var(--text-sm);
    font-weight: 500;
    border-radius: var(--radius-md);
    transition: background var(--transition-fast);

    &:hover {
      background: var(--surface-hover);
    }
  }

  .object-expand {
    font-size: 10px;
    width: 12px;
    text-align: center;
    flex-shrink: 0;
    transition: transform var(--transition-fast);
    opacity: 0.6;

    &.expanded {
      transform: rotate(90deg);
    }
  }

  .object-color {
    width: var(--spacing-3);
    height: var(--spacing-3);
    border-radius: 50%;
    flex-shrink: 0;
  }

  .object-name {
    flex: 1;
    color: var(--text-primary);
  }

  .object-count {
    color: var(--text-secondary);
    font-size: var(--text-xs);
  }

  .object-actions {
    display: flex;
    align-items: center;
    flex-shrink: 0;
  }

  .obj-delete {
    font-size: 10px;
    cursor: pointer;
    opacity: 0.5;
    transition: opacity var(--transition-fast);
    padding: 2px;

    &:hover {
      opacity: 1;
    }
  }

  .object-detail {
    padding: 0 var(--spacing-2) var(--spacing-1);
    padding-left: calc(var(--spacing-2) + 12px + var(--spacing-2));
  }

  .annotation-item {
    display: flex;
    align-items: center;
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

  .ann-coords {
    display: flex;
    align-items: center;
    gap: 4px;
    font-family: monospace;
    white-space: nowrap;
  }

  .ann-icon {
    font-size: 12px;
    flex-shrink: 0;
    line-height: 1;

    &.positive {
      filter: hue-rotate(0deg);
    }

    &.negative {
      filter: hue-rotate(0deg);
    }
  }

  .coords-text {
    white-space: nowrap;
  }

  .panel-footer {
    padding: var(--spacing-3) var(--spacing-4);
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
