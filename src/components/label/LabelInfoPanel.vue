<script setup lang="ts">
  import { computed, ref } from 'vue';
  import { useLabelStore } from '@/stores/label';
  import { ElMessage, ElMessageBox } from 'element-plus';

  const store = useLabelStore();
  const expandedObjects = ref<Set<string>>(
    new Set([store.currentObjectId].filter(Boolean) as string[])
  );
  const showNewObjectInput = ref(false);
  const newObjectName = ref('');
  const pendingReassign = ref(false);

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
    if (expandedObjects.value.has(id)) {
      expandedObjects.value.delete(id);
    } else {
      expandedObjects.value.add(id);
    }
  }

  function handleClickObject(id: string) {
    store.setCurrentObject(id);
  }

  function handleClickAnnotation(annId: string) {
    store.selectAnnotation(annId);
  }

  function handleDeleteSelected() {
    if (store.selectedAnnotationId) {
      store.removeAnnotationFromObject(store.selectedAnnotationId);
    }
  }

  function handleReassign(targetId: string) {
    if (!store.selectedAnnotationId) return;
    if (targetId === '__create_new__') {
      showNewObjectInput.value = true;
      newObjectName.value = '';
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

  function handleShowNewObjectInput() {
    showNewObjectInput.value = true;
    newObjectName.value = '';
  }

  function handleCancelNewObject() {
    showNewObjectInput.value = false;
    newObjectName.value = '';
    pendingReassign.value = false;
  }

  function handleCreateObject() {
    const name = newObjectName.value.trim();
    if (!name) {
      ElMessage.warning('请输入对象名称');
      return;
    }
    const obj = store.addObject(name);
    expandedObjects.value.add(obj.id);
    showNewObjectInput.value = false;
    newObjectName.value = '';

    if (pendingReassign.value && store.selectedAnnotationId) {
      store.reassignAnnotation(store.selectedAnnotationId, obj.id);
      pendingReassign.value = false;
      ElMessage.success('已转移标注');
    } else {
      ElMessage.success(`已创建对象: ${name}`);
    }
  }
</script>

<template>
  <div class="label-info-panel">
    <div class="panel-header">
      <span class="panel-title">标注对象</span>
      <span
        v-if="!showNewObjectInput"
        class="add-object-btn"
        title="新建对象"
        @click="handleShowNewObjectInput"
      >
        ＋
      </span>
    </div>

    <div v-if="showNewObjectInput" class="new-object-form">
      <input
        v-model="newObjectName"
        class="new-object-input"
        placeholder="输入对象名称"
        @keyup.enter="handleCreateObject"
        @keyup.escape="handleCancelNewObject"
      />
      <span class="form-actions">
        <span class="form-btn confirm" title="确定" @click="handleCreateObject">✓</span>
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
            <span class="object-color" :style="{ background: obj.color }"></span>
            <span class="object-name">{{ obj.name }}</span>
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
                <span class="ann-icon" :style="{ color: obj.color }">▭</span>
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

    <div v-if="store.selectedAnnotationId" class="panel-footer">
      <div class="footer-actions">
        <el-dropdown trigger="click" @command="handleReassign">
          <el-button size="small">
            转移对象
            <el-icon class="el-icon--right">
              <svg viewBox="0 0 1024 1024">
                <path
                  d="M831.872 340.864 512 652.672 192.128 340.864a30.592 30.592 0 0 0-42.752 0 29.12 29.12 0 0 0 0 41.6l288 288a30.016 30.016 0 0 0 42.496 0l288-288a29.12 29.12 0 0 0 0-41.728 30.592 30.592 0 0 0-42.752 0z"
                />
              </svg>
            </el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item v-for="obj in availableObjects" :key="obj.id" :command="obj.id">
                <span class="dropdown-obj-color" :style="{ background: obj.color }"></span>
                {{ obj.name }}
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <el-button type="danger" size="small" @click="handleDeleteSelected">删除选中</el-button>
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
    align-items: center;
    gap: 4px;
    padding: var(--spacing-2);
    border-bottom: 1px solid var(--border-default);
    flex-shrink: 0;
  }

  .new-object-input {
    flex: 1;
    padding: 4px 8px;
    font-size: var(--text-xs);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-sm);
    outline: none;
    background: var(--bg-primary);
    color: var(--text-primary);

    &:focus {
      border-color: var(--accent-primary);
    }
  }

  .form-actions {
    display: flex;
    gap: 2px;
  }

  .form-btn {
    font-size: 12px;
    cursor: pointer;
    padding: 2px 4px;
    border-radius: var(--radius-sm);
    transition: background var(--transition-fast);

    &.confirm {
      color: var(--color-success);

      &:hover {
        background: var(--color-success-light);
      }
    }

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

  .reassign-option .obj-name {
    font-size: var(--text-sm);
    font-weight: 500;
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
