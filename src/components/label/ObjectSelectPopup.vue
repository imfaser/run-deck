<script setup lang="ts">
  import { ref, nextTick, watch } from 'vue';
  import { ElMessage } from 'element-plus';
  import { useLabelStore } from '@/stores/label';

  const store = useLabelStore();
  const inputRef = ref<HTMLInputElement>();

  const ui = ref({
    visible: false,
    isCreating: false,
    name: '',
    x: 0,
    y: 0,
  });

  function show(x: number, y: number) {
    ui.value = { visible: true, isCreating: false, name: '', x, y };
    nextTick(() => inputRef.value?.focus());
  }

  function handleSelectObject(id: string) {
    store.setCurrentObject(id);
    assignPending(id);
  }

  function handleShowCreate() {
    ui.value.isCreating = true;
    nextTick(() => inputRef.value?.focus());
  }

  function handleCreateObject() {
    const name = ui.value.name.trim();
    if (!name) {
      ElMessage.warning('请输入对象名称');
      return;
    }
    const obj = store.addObject(name);
    store.setCurrentObject(obj.id);
    assignPending(obj.id);
    ElMessage.success(`已创建对象: ${name}`);
  }

  function handleCancelCreate() {
    ui.value.isCreating = false;
    ui.value.name = '';
    nextTick(() => inputRef.value?.focus());
  }

  function assignPending(objectId: string) {
    const pending = store.pendingAnnotation;
    if (!pending) return;
    if (pending.type === 'point') {
      store.addPointToObject(objectId, pending.point!);
    } else if (pending.type === 'box') {
      store.addBoxToObject(objectId, pending.box!);
    }
    store.pendingAnnotation = null;
    ui.value.visible = false;
  }

  watch(
    () => store.pendingAnnotation,
    (val) => {
      const pos = store.cursorScreenPos;
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
      <div class="popup-header">选择目标对象</div>

      <div v-if="!ui.isCreating" class="popup-body">
        <div
          v-for="obj in store.objects"
          :key="obj.id"
          class="popup-item"
          @click="handleSelectObject(obj.id)"
        >
          <span class="item-dot" :style="{ background: obj.color }"></span>
          <span class="item-name">{{ obj.name }}</span>
        </div>
        <div class="popup-item create-item" @click="handleShowCreate">
          <span class="item-icon">+</span>
          <span class="item-name">新建对象</span>
        </div>
      </div>

      <div v-else class="popup-body create-form">
        <input
          ref="inputRef"
          v-model="ui.name"
          class="create-input"
          placeholder="输入对象名称"
          @keyup.enter="handleCreateObject"
          @keyup.escape="handleCancelCreate"
        />
        <div class="create-actions">
          <button class="create-btn confirm" @click="handleCreateObject">✓</button>
          <button class="create-btn cancel" @click="handleCancelCreate">✕</button>
        </div>
      </div>
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

  .create-item {
    border-top: 1px solid var(--el-border-color-lighter);
    margin-top: 2px;
    padding-top: 8px;
  }

  .create-form {
    padding: 8px 10px;
  }

  .create-input {
    width: 100%;
    padding: 6px 8px;
    border: 1px solid var(--el-border-color);
    border-radius: 6px;
    font-size: 13px;
    outline: none;
    background: var(--el-fill-color-blank);
    color: var(--el-text-color-primary);
    box-sizing: border-box;

    &:focus {
      border-color: var(--el-color-primary);
    }
  }

  .create-actions {
    display: flex;
    gap: 6px;
    margin-top: 6px;
    justify-content: flex-end;
  }

  .create-btn {
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    display: flex;
    align-items: center;
    justify-content: center;

    &.confirm {
      background: var(--el-color-primary);
      color: #fff;
    }

    &.cancel {
      background: var(--el-fill-color-light);
      color: var(--el-text-color-regular);
    }
  }
</style>
