<script setup lang="ts">
  import { ref, computed, watch } from 'vue';
  import { useLabel3dCanvasStore } from '@/stores/canvas-3d';
  import { useLabel3dDefStore } from '@/stores/label-def-3d';

  const canvas = useLabel3dCanvasStore();
  const labelDefStore = useLabel3dDefStore();

  const ui = ref({
    visible: false,
    mode: 'select' as 'select' | 'create',
    x: 0,
    y: 0,
  });

  const objectsWithLabel = computed(() =>
    canvas.objects
      .filter((obj) => !obj.boxes.some((b) => b.boxType === 'visual_ref'))
      .map((obj) => {
        const labelDef = labelDefStore.labelById(obj.labelId);
        return {
          ...obj,
          labelName: labelDef?.name ?? 'Unknown',
          labelColor: labelDef?.color ?? '#888',
        };
      })
  );

  function show(x: number, y: number) {
    const mode = objectsWithLabel.value.length > 0 ? 'select' : 'create';
    ui.value = { visible: true, mode, x, y };
  }

  function handleSelectObject(id: string) {
    canvas.setCurrentObject(id);
    assignPending(id);
  }

  async function handleSelectNewLabel(labelId: string) {
    const obj = await canvas.addObject(labelId);
    canvas.setCurrentObject(obj.id);
    assignPending(obj.id);
  }

  function assignPending(objectId: string) {
    const pending = canvas.pendingAnnotation;
    if (!pending) return;
    if (pending.type === 'point') {
      canvas.addPointToObject(objectId, pending.point!);
    } else if (pending.type === 'box') {
      canvas.addBoxToObject(objectId, pending.box!);
    }
    canvas.pendingAnnotation = null;
    ui.value.visible = false;
  }

  watch(
    () => canvas.pendingAnnotation,
    (val) => {
      const pos = canvas.cursorScreenPos;
      if (val && pos) {
        show(pos.x, pos.y);
      } else if (!val) {
        ui.value.visible = false;
      }
    }
  );
</script>

<template>
  <Teleport to="body">
    <div
      v-if="ui.visible"
      class="object-select-popup"
      :style="{ left: ui.x + 'px', top: ui.y + 'px' }"
      @click.stop
    >
      <!-- Existing objects: show select mode -->
      <template v-if="ui.mode === 'select'">
        <div class="popup-header">选择目标对象</div>
        <div class="popup-body">
          <div
            v-for="obj in objectsWithLabel"
            :key="obj.id"
            class="popup-item"
            @click="handleSelectObject(obj.id)"
          >
            <span class="item-dot" :style="{ background: obj.labelColor }"></span>
            <span class="item-name">{{ obj.labelName }}</span>
            <span class="item-count">({{ obj.points.length + obj.boxes.length }})</span>
          </div>
          <div class="popup-item create-item" @click="ui.mode = 'create'">
            <span class="item-icon">+</span>
            <span class="item-name">新建对象</span>
          </div>
        </div>
      </template>

      <!-- Create mode: show label list directly -->
      <template v-else>
        <div class="popup-header">选择 Label 创建对象</div>
        <div class="popup-body">
          <div
            v-for="label in labelDefStore.sortedLabels"
            :key="label.id"
            class="popup-item"
            @click="handleSelectNewLabel(label.id)"
          >
            <span class="item-dot" :style="{ background: label.color }"></span>
            <span class="item-name">{{ label.name }}</span>
          </div>
          <div v-if="labelDefStore.labels.length === 0" class="empty-hint">
            暂无 Label，请先在标注设置中创建
          </div>
          <div
            v-if="objectsWithLabel.length > 0"
            class="popup-item cancel-item"
            @click="ui.mode = 'select'"
          >
            <span class="item-name">返回选择</span>
          </div>
        </div>
      </template>
    </div>
  </Teleport>
</template>

<style scoped lang="scss">
  .object-select-popup {
    position: fixed;
    z-index: 9999;
    background: var(--el-bg-color);
    border: 1px solid var(--el-border-color);
    border-radius: 8px;
    box-shadow: 0 6px 24px rgba(0, 0, 0, 0.16);
    min-width: 160px;
    user-select: none;
  }

  .popup-header {
    padding: 8px 12px 4px;
    font-size: 11px;
    color: var(--el-text-color-secondary);
    font-weight: 500;
  }

  .popup-body {
    padding: 4px;
  }

  .popup-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
    color: var(--el-text-color-primary);
    transition: background 0.12s;

    &:hover {
      background: var(--el-fill-color-light);
    }
  }

  .item-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .item-icon {
    width: 10px;
    text-align: center;
    font-weight: 600;
    color: var(--el-color-primary);
  }

  .item-count {
    font-size: 11px;
    color: var(--el-text-color-secondary);
  }

  .create-item {
    border-top: 1px solid var(--el-border-color-lighter);
    margin-top: 2px;
    padding-top: 8px;
  }

  .cancel-item {
    border-top: 1px solid var(--el-border-color-lighter);
    margin-top: 2px;
    padding-top: 8px;
    color: var(--el-text-color-secondary);
  }

  .empty-hint {
    padding: 8px 10px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
    text-align: center;
  }
</style>
