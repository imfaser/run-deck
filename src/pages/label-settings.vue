<script setup lang="ts">
  import { ref, computed } from 'vue';
  import { ElMessage, ElMessageBox } from 'element-plus';
  import { Plus, Delete, Edit } from '@element-plus/icons-vue';
  import { useLabelDefStore } from '@/stores/label-def';
  import type { LabelDef } from '@/schemas/label';

  const store = useLabelDefStore();

  // ─── Dialog state ─────────────────────────────────
  const showDialog = ref(false);
  const editingId = ref<string | null>(null);
  const formName = ref('');
  const formColor = ref('#0096ff');
  const formOrder = ref(1);

  const isEditing = computed(() => editingId.value !== null);
  const dialogTitle = computed(() => (isEditing.value ? '编辑 Label' : '新增 Label'));

  const nameError = computed(() => {
    if (!formName.value.trim()) return '名称不能为空';
    const existing = store.labelByName(formName.value.trim());
    if (existing && existing.id !== editingId.value) return '名称已存在';
    return '';
  });

  const canConfirm = computed(() => formName.value.trim().length > 0 && !nameError.value);

  // ─── Actions ──────────────────────────────────────
  function handleAdd() {
    editingId.value = null;
    formName.value = '';
    formColor.value = '#0096ff';
    formOrder.value = store.nextOrder;
    showDialog.value = true;
  }

  function handleEdit(label: LabelDef) {
    editingId.value = label.id;
    formName.value = label.name;
    formColor.value = label.color;
    formOrder.value = label.order;
    showDialog.value = true;
  }

  function handleConfirm() {
    if (!canConfirm.value) return;

    try {
      if (isEditing.value && editingId.value) {
        store.updateLabel(editingId.value, {
          name: formName.value.trim(),
          color: formColor.value,
          order: formOrder.value,
        });
        ElMessage.success('Label 已更新');
      } else {
        store.addLabel(formName.value.trim(), formColor.value);
        ElMessage.success('Label 已创建');
      }
      showDialog.value = false;
    } catch (e) {
      ElMessage.error(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleDelete(label: LabelDef) {
    try {
      await ElMessageBox.confirm(`确定删除 "${label.name}" 吗？`, '删除确认', {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning',
      });
      store.removeLabel(label.id);
      ElMessage.success('已删除');
    } catch {
      // cancelled
    }
  }

  function handleOrderChange(label: LabelDef, newOrder: number) {
    store.updateOrder(label.id, newOrder);
  }
</script>

<template>
  <div class="label-settings-page">
    <div class="page-header">
      <h2>标注设置</h2>
      <el-button type="primary" :icon="Plus" @click="handleAdd">新增 Label</el-button>
    </div>

    <el-table :data="store.sortedLabels" stripe style="width: 100%">
      <el-table-column label="Order" width="70">
        <template #default="{ row }">
          <input
            type="number"
            class="order-input"
            :value="(row as LabelDef).order"
            min="1"
            max="255"
            @change="
              (e: Event) => {
                const val = Number((e.target as HTMLInputElement).value);
                if (val >= 1 && val <= 255) handleOrderChange(row as LabelDef, val);
              }
            "
          />
        </template>
      </el-table-column>

      <el-table-column label="颜色" width="80">
        <template #default="{ row }">
          <span class="color-dot" :style="{ background: (row as LabelDef).color }"></span>
        </template>
      </el-table-column>

      <el-table-column prop="name" label="名称" />

      <el-table-column label="操作" width="140" align="right">
        <template #default="{ row }">
          <el-button size="small" :icon="Edit" @click="handleEdit(row as LabelDef)">编辑</el-button>
          <el-button
            size="small"
            type="danger"
            :icon="Delete"
            @click="handleDelete(row as LabelDef)"
          >
            删除
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <div v-if="store.labels.length === 0" class="empty-hint">暂无 Label，请点击上方按钮新增</div>

    <!-- Add/Edit Dialog -->
    <el-dialog
      v-model="showDialog"
      :title="dialogTitle"
      width="400px"
      :close-on-click-modal="false"
    >
      <el-form label-width="60px">
        <el-form-item label="名称">
          <el-input v-model="formName" placeholder="例如: car, tumor" maxlength="50" clearable />
          <div v-if="nameError" class="field-error">{{ nameError }}</div>
        </el-form-item>

        <el-form-item label="颜色">
          <el-color-picker
            v-model="formColor"
            :predefine="[
              '#ff3b30',
              '#ff9500',
              '#ffcc00',
              '#34c759',
              '#007aff',
              '#5856d6',
              '#af52de',
              '#ff2d55',
              '#5ac8fa',
              '#00c7be',
            ]"
          />
        </el-form-item>

        <el-form-item label="Order">
          <el-input-number v-model="formOrder" :min="1" :max="255" />
          <span class="order-hint">1-255，用作 mask class index</span>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="showDialog = false">取消</el-button>
        <el-button type="primary" :disabled="!canConfirm" @click="handleConfirm">
          {{ isEditing ? '保存' : '创建' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
  .label-settings-page {
    padding: 24px;
    height: 100%;
    overflow-y: auto;
  }

  .page-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 24px;

    h2 {
      margin: 0;
      font-size: 20px;
      font-weight: 600;
    }
  }

  .order-input {
    width: 48px;
    padding: 2px 4px;
    border: 1px solid var(--el-border-color);
    border-radius: var(--el-border-radius-small);
    font-size: 13px;
    text-align: center;
    background: var(--el-bg-color);
    color: var(--el-text-color-primary);
    outline: none;

    &:focus {
      border-color: var(--el-color-primary);
    }

    &::-webkit-inner-spin-button,
    &::-webkit-outer-spin-button {
      opacity: 1;
    }
  }

  .color-dot {
    display: inline-block;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    border: 1px solid var(--el-border-color-lighter);
  }

  .field-error {
    color: var(--el-color-danger);
    font-size: 12px;
    margin-top: 4px;
  }

  .order-hint {
    margin-left: 12px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .empty-hint {
    text-align: center;
    padding: 48px 0;
    color: var(--el-text-color-secondary);
    font-size: 14px;
  }
</style>
