<script setup lang="ts">
  import { ref, computed } from 'vue';
  import { ElMessage } from 'element-plus/es/components/message/index.mjs';
  import { ElMessageBox } from 'element-plus/es/components/message-box/index.mjs';
  import { Plus, Delete, Edit } from '@element-plus/icons-vue';
  import { useRoute } from 'vue-router';
  import { useLabelDefStore } from '@/stores/label-def';
  import type { LocateConfig } from '@/schemas/locate';
  import { useCanvasStore } from '@/stores/canvas';
  import { useLabel2dStore } from '@/stores/label-2d';
  import { useLabel3dStore } from '@/stores/label-3d';
  import type { LabelDef, SubLabel } from '@/schemas/label';
  import { useLocateAnything } from '@/composables/useLocateAnything';
  import { useLabelSettings } from '@/composables/useLabelSettings';
  import { getKeyframe, putKeyframe } from '@/db/keyframe-repo';
  import { logMessage } from '@/services/cmd';

  const route = useRoute();
  const canvasId = route.path === '/label-raw' ? 'label-raw' : 'label';

  const store = useLabelDefStore();
  const canvas = useCanvasStore(canvasId);
  const label2d = useLabel2dStore(canvasId);
  const label3d = useLabel3dStore(canvasId, canvas);
  const { showDrawer } = useLabelSettings();

  const is3dMode = computed(() => store.appMode === '3d');

  // ─── Label Dialog ───────────────────────────────
  const showLabelDialog = ref(false);
  const editingLabelId = ref<string | null>(null);
  const formName = ref('');
  const formColor = ref('#0096ff');
  const formOrder = ref(1);

  const isEditingLabel = computed(() => editingLabelId.value !== null);
  const labelDialogTitle = computed(() => (isEditingLabel.value ? '编辑 Label' : '新增 Label'));
  const labelNameError = computed(() => {
    if (!formName.value.trim()) return '名称不能为空';
    const existing = store.labelByName(formName.value.trim());
    if (existing && existing.id !== editingLabelId.value) return '名称已存在';
    return '';
  });
  const canConfirmLabel = computed(() => formName.value.trim().length > 0 && !labelNameError.value);

  function handleAddLabel() {
    editingLabelId.value = null;
    formName.value = '';
    formColor.value = '#0096ff';
    formOrder.value = store.nextOrder;
    showLabelDialog.value = true;
  }

  function handleEditLabel(label: LabelDef) {
    editingLabelId.value = label.id;
    formName.value = label.name;
    formColor.value = label.color;
    formOrder.value = label.order;
    showLabelDialog.value = true;
  }

  function handleConfirmLabel() {
    if (!canConfirmLabel.value) return;
    try {
      if (isEditingLabel.value && editingLabelId.value) {
        store.updateLabel(editingLabelId.value, {
          name: formName.value.trim(),
          color: formColor.value,
          order: formOrder.value,
        });
        ElMessage.success('Label 已更新');
      } else {
        store.addLabel(formName.value.trim(), formColor.value);
        ElMessage.success('Label 已创建');
      }
      showLabelDialog.value = false;
    } catch (e) {
      ElMessage.error(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleDeleteLabel(label: LabelDef) {
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

  // ─── SubLabel Dialog ────────────────────────────
  const showSubLabelDialog = ref(false);
  const editingSubLabelId = ref<string | null>(null);
  const subLabelParentId = ref('');
  const subLabelFormName = ref('');

  const isEditingSubLabel = computed(() => editingSubLabelId.value !== null);
  const subLabelDialogTitle = computed(() =>
    isEditingSubLabel.value ? '编辑子标签' : '新增子标签'
  );
  const subLabelNameError = computed(() => {
    if (!subLabelFormName.value.trim()) return '名称不能为空';
    const existing = store.sublabels.find(
      (sl) =>
        sl.parentId === subLabelParentId.value &&
        sl.name === subLabelFormName.value.trim() &&
        sl.id !== editingSubLabelId.value
    );
    if (existing) return '子标签名已存在';
    return '';
  });
  const canConfirmSubLabel = computed(
    () => subLabelFormName.value.trim().length > 0 && !subLabelNameError.value
  );

  function handleAddSubLabel(parentId: string) {
    editingSubLabelId.value = null;
    subLabelParentId.value = parentId;
    subLabelFormName.value = '';
    showSubLabelDialog.value = true;
  }

  function handleEditSubLabel(subLabel: SubLabel) {
    editingSubLabelId.value = subLabel.id;
    subLabelParentId.value = subLabel.parentId;
    subLabelFormName.value = subLabel.name;
    showSubLabelDialog.value = true;
  }

  function handleConfirmSubLabel() {
    if (!canConfirmSubLabel.value) return;
    try {
      if (isEditingSubLabel.value && editingSubLabelId.value) {
        store.updateSubLabel(editingSubLabelId.value, {
          name: subLabelFormName.value.trim(),
        });
        ElMessage.success('子标签已更新');
      } else {
        store.addSubLabel(subLabelParentId.value, subLabelFormName.value.trim());
        ElMessage.success('子标签已创建');
      }
      showSubLabelDialog.value = false;
    } catch (e) {
      ElMessage.error(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleDeleteSubLabel(subLabel: SubLabel) {
    try {
      await ElMessageBox.confirm(`确定删除子标签 "${subLabel.name}" 吗？`, '删除确认', {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning',
      });
      store.removeSubLabel(subLabel.id);
      ElMessage.success('已删除');
    } catch {
      // cancelled
    }
  }

  // ─── LocateConfig ───────────────────────────────
  function getConfig(labelId: string): LocateConfig {
    return (
      store.getLocateConfig(labelId) ?? {
        labelId,
        mode: 'detect',
        visualType: 'slice_crop',
        visualRefObjectId: null,
        visualRefImagePath: null,
        rangeStart: 0,
        rangeEnd: 0,
      }
    );
  }

  function updateMode(labelId: string, mode: 'detect' | 'detect_visual') {
    store.updateLocateConfig(labelId, { mode });
  }

  function updateVisualType(labelId: string, visualType: 'slice_crop' | 'external_image') {
    store.updateLocateConfig(labelId, { visualType });
  }

  function updateRange(labelId: string, field: 'rangeStart' | 'rangeEnd', value: number) {
    store.updateLocateConfig(labelId, { [field]: value });
  }

  function clearVisualRef(labelId: string) {
    store.updateLocateConfig(labelId, {
      visualRefObjectId: null,
      visualRefImagePath: null,
    });
  }

  async function handleSelectExternalImage(labelId: string) {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const selected = await open({
      multiple: false,
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'bmp', 'webp'] }],
    });
    if (selected) {
      store.updateLocateConfig(labelId, {
        visualRefImagePath: selected as string,
        visualRefObjectId: null,
      });
    }
  }

  // ─── Detect ─────────────────────────────────────
  const detectingLabels = ref(new Set<string>());

  async function handleStartDetect(labelId: string) {
    await logMessage('info', `[label-settings] handleStartDetect called for label ${labelId}`);

    let config = store.getLocateConfig(labelId);
    if (!config) {
      config = {
        labelId,
        mode: 'detect',
        visualType: 'slice_crop',
        visualRefObjectId: null,
        visualRefImagePath: null,
        rangeStart: 0,
        rangeEnd: 0,
      };
      store.updateLocateConfig(labelId, config);
      await logMessage('info', `[label-settings] saved default config for label ${labelId}`);
    }

    if (
      config.mode === 'detect_visual' &&
      !config.visualRefObjectId &&
      !config.visualRefImagePath
    ) {
      await logMessage('warn', `[label-settings] detect_visual needs visual reference`);
      ElMessage.error('请先设置视觉参考');
      return;
    }

    detectingLabels.value.add(labelId);

    try {
      if (store.appMode === '3d') {
        // 3D volume mode: use batchDetect with volume data
        if (!label3d.filePath) {
          ElMessage.warning('请先打开 Raw 文件');
          return;
        }

        await logMessage(
          'info',
          `[label-settings] starting 3d detection: mode=${config.mode} volume=${label3d.filePath.substring(0, 50)}...`
        );
        store.updateDetectProgress(labelId, { status: 'running', current: 0, total: 1 });

        const locate = useLocateAnything({
          volumeId: computed(() => label3d.volumeId),
          currentIndex: computed(() => label3d.currentIndex),
          imageWidth: computed(() => label3d.volumeInfo.sliceWidth),
          imageHeight: computed(() => label3d.volumeInfo.sliceHeight),
          getKeyframe,
          putKeyframe,
          imagePath: computed(() => label3d.filePath),
          objects: computed(() => canvas.objects),
          labelDefStore: store,
        });

        await locate.batchDetect(labelId);
        ElMessage.success('批量检测完成');
      } else {
        // 2D image mode: use runDetectForCurrentImage with label data
        if (!label2d.imagePath) {
          ElMessage.warning('请先在标注页面打开图片');
          return;
        }

        await logMessage(
          'info',
          `[label-settings] starting 2d detection: mode=${config.mode} image=${label2d.imagePath.substring(0, 50)}...`
        );
        store.updateDetectProgress(labelId, { status: 'running', current: 0, total: 1 });

        const locate = useLocateAnything({
          volumeId: ref(null),
          currentIndex: ref(0),
          imageWidth: computed(() => canvas.imageWidth),
          imageHeight: computed(() => canvas.imageHeight),
          getKeyframe: async () => undefined,
          putKeyframe: async () => {},
          imagePath: computed(() => label2d.imagePath),
          objects: computed(() => canvas.objects),
          labelDefStore: store,
        });

        const results = await locate.runDetectForCurrentImage(labelId);
        canvas.objects.push(...results);
        ElMessage.success(`检测完成，发现 ${results.length} 个对象`);
      }

      store.updateDetectProgress(labelId, { status: 'done', current: 1, total: 1 });
      await logMessage('info', `[label-settings] detection completed`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      store.updateDetectProgress(labelId, { status: 'error', error: msg });
      await logMessage('error', `[label-settings] detection failed: ${msg}`);
      ElMessage.error(`检测失败: ${msg}`);
    } finally {
      detectingLabels.value.delete(labelId);
    }
  }

  function isLabelDetecting(labelId: string) {
    return detectingLabels.value.has(labelId);
  }

  function getProgress(labelId: string) {
    return store.getDetectProgress(labelId) ?? { labelId, current: 0, total: 0, status: 'idle' };
  }
</script>

<template>
  <el-drawer v-model="showDrawer" title="标注设置" direction="rtl" size="50%" resizable>
    <div class="drawer-content">
      <div class="page-header">
        <el-button type="primary" :icon="Plus" @click="handleAddLabel">新增 Label</el-button>
      </div>

      <div class="label-list">
        <el-card
          v-for="label in store.sortedLabels"
          :key="label.id"
          shadow="never"
          class="label-card"
        >
          <template #header>
            <div class="card-header">
              <div class="label-info">
                <span class="color-dot" :style="{ background: label.color }" />
                <span class="label-name">{{ label.name }}</span>
                <el-text type="info" size="small">Order: {{ label.order }}</el-text>
              </div>
              <div>
                <el-button size="small" :icon="Edit" @click="handleEditLabel(label)">
                  编辑
                </el-button>
                <el-button
                  size="small"
                  type="danger"
                  :icon="Delete"
                  @click="handleDeleteLabel(label)"
                >
                  删除
                </el-button>
              </div>
            </div>
          </template>

          <el-form label-width="80px" label-position="left">
            <el-form-item label="模式">
              <el-radio-group
                :model-value="getConfig(label.id).mode"
                @update:model-value="(v) => updateMode(label.id, v as 'detect' | 'detect_visual')"
              >
                <el-radio value="detect">detect</el-radio>
                <el-radio value="detect_visual">detect_visual</el-radio>
              </el-radio-group>
            </el-form-item>

            <el-form-item label="子标签">
              <div class="sublabel-list">
                <div
                  v-for="sl in store.subLabelsByParent(label.id)"
                  :key="sl.id"
                  class="sublabel-item"
                >
                  <el-tag closable @close="handleDeleteSubLabel(sl)">
                    {{ sl.name }}
                    <el-icon class="tag-edit" @click="handleEditSubLabel(sl)"><Edit /></el-icon>
                  </el-tag>
                </div>
                <el-button size="small" :icon="Plus" text @click="handleAddSubLabel(label.id)">
                  添加
                </el-button>
              </div>
            </el-form-item>

            <template v-if="getConfig(label.id).mode === 'detect_visual'">
              <el-form-item label="Visual">
                <el-radio-group
                  :model-value="getConfig(label.id).visualType"
                  @update:model-value="
                    (v) => updateVisualType(label.id, v as 'slice_crop' | 'external_image')
                  "
                >
                  <el-radio value="slice_crop">当前裁剪</el-radio>
                  <el-radio value="external_image">外部图片</el-radio>
                </el-radio-group>
              </el-form-item>

              <el-form-item>
                <div class="visual-ref">
                  <template v-if="getConfig(label.id).visualType === 'slice_crop'">
                    <el-tag v-if="getConfig(label.id).visualRefObjectId" type="success">
                      已设置
                    </el-tag>
                    <el-tag v-else type="info">未设置</el-tag>
                  </template>
                  <template v-else>
                    <el-text
                      v-if="getConfig(label.id).visualRefImagePath"
                      truncated
                      class="ref-path"
                    >
                      {{ getConfig(label.id).visualRefImagePath }}
                    </el-text>
                    <el-tag v-else type="info">未选择文件</el-tag>
                    <el-button size="small" @click="handleSelectExternalImage(label.id)">
                      选择文件
                    </el-button>
                  </template>
                  <el-button
                    v-if="
                      getConfig(label.id).visualRefObjectId ||
                      getConfig(label.id).visualRefImagePath
                    "
                    size="small"
                    type="danger"
                    text
                    @click="clearVisualRef(label.id)"
                  >
                    清除
                  </el-button>
                </div>
              </el-form-item>
            </template>

            <el-form-item v-if="is3dMode" label="范围">
              <el-input-number
                :model-value="getConfig(label.id).rangeStart"
                :min="0"
                size="small"
                @update:model-value="(v) => updateRange(label.id, 'rangeStart', v ?? 0)"
              />
              <span class="range-sep">~</span>
              <el-input-number
                :model-value="getConfig(label.id).rangeEnd"
                :min="0"
                size="small"
                @update:model-value="(v) => updateRange(label.id, 'rangeEnd', v ?? 0)"
              />
            </el-form-item>

            <el-form-item>
              <div class="detect-actions">
                <template v-if="getProgress(label.id).status === 'idle'">
                  <el-button
                    type="primary"
                    :loading="isLabelDetecting(label.id)"
                    @click="handleStartDetect(label.id)"
                  >
                    开始检测
                  </el-button>
                </template>
                <template v-else-if="getProgress(label.id).status === 'running'">
                  <el-progress
                    :percentage="
                      getProgress(label.id).total > 0
                        ? Math.round(
                            (getProgress(label.id).current / getProgress(label.id).total) * 100
                          )
                        : 0
                    "
                    :stroke-width="8"
                    style="flex: 1"
                  />
                  <el-text type="info" size="small">
                    {{ Math.max(getProgress(label.id).current, 1) }}/{{
                      Math.max(getProgress(label.id).total, 1)
                    }}
                  </el-text>
                </template>
                <template v-else-if="getProgress(label.id).status === 'done'">
                  <el-text type="success">完成</el-text>
                  <el-button size="small" @click="store.resetDetectProgress(label.id)">
                    重新检测
                  </el-button>
                </template>
                <template v-else-if="getProgress(label.id).status === 'error'">
                  <el-text type="danger" size="small">{{ getProgress(label.id).error }}</el-text>
                  <el-button size="small" @click="store.resetDetectProgress(label.id)">
                    重试
                  </el-button>
                </template>
              </div>
            </el-form-item>
          </el-form>
        </el-card>
      </div>

      <el-empty v-if="store.labels.length === 0" description="暂无 Label，请点击上方按钮新增" />

      <!-- Label Dialog -->
      <el-dialog v-model="showLabelDialog" :title="labelDialogTitle" width="400px" append-to-body>
        <el-form label-width="60px">
          <el-form-item label="名称">
            <el-input v-model="formName" placeholder="例如: car, tumor" maxlength="50" clearable />
            <el-text v-if="labelNameError" type="danger" size="small">{{ labelNameError }}</el-text>
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
            <el-text type="info" size="small" style="margin-left: 12px">
              1-255，用作 mask class index
            </el-text>
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="showLabelDialog = false">取消</el-button>
          <el-button type="primary" :disabled="!canConfirmLabel" @click="handleConfirmLabel">
            {{ isEditingLabel ? '保存' : '创建' }}
          </el-button>
        </template>
      </el-dialog>

      <!-- SubLabel Dialog -->
      <el-dialog
        v-model="showSubLabelDialog"
        :title="subLabelDialogTitle"
        width="400px"
        append-to-body
      >
        <el-form label-width="60px">
          <el-form-item label="名称">
            <el-input
              v-model="subLabelFormName"
              placeholder="例如: 白色矩形, 大矩形"
              maxlength="50"
              clearable
            />
            <el-text v-if="subLabelNameError" type="danger" size="small">
              {{ subLabelNameError }}
            </el-text>
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="showSubLabelDialog = false">取消</el-button>
          <el-button type="primary" :disabled="!canConfirmSubLabel" @click="handleConfirmSubLabel">
            {{ isEditingSubLabel ? '保存' : '创建' }}
          </el-button>
        </template>
      </el-dialog>
    </div>
  </el-drawer>
</template>

<style scoped lang="scss">
  .drawer-content {
    padding: 16px;
    height: 100%;
    overflow-y: auto;
  }

  .page-header {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    margin-bottom: 16px;
  }

  .label-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .label-card {
    :deep(.el-card__header) {
      padding: 12px 16px;
    }
  }

  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .label-info {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .color-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    border: 1px solid var(--el-border-color);
  }

  .label-name {
    font-weight: 600;
  }

  .sublabel-list {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }

  .sublabel-item {
    :deep(.el-tag) {
      display: flex;
      align-items: center;
      gap: 4px;
    }
  }

  .tag-edit {
    cursor: pointer;
    font-size: 12px;
    opacity: 0.6;

    &:hover {
      opacity: 1;
    }
  }

  .visual-ref {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .ref-path {
    max-width: 300px;
  }

  .range-sep {
    margin: 0 8px;
    color: var(--el-text-color-secondary);
  }

  .detect-actions {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
  }
</style>
