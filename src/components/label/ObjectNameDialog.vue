<script setup lang="ts">
  import { ref, computed, watch, nextTick } from 'vue';

  const props = defineProps<{
    visible: boolean;
  }>();

  const emit = defineEmits<{
    confirm: [name: string];
    cancel: [];
  }>();

  const inputRef = ref<{ input: HTMLInputElement } | null>(null);
  const name = ref('');

  const canConfirm = computed(() => name.value.trim().length > 0);

  watch(
    () => props.visible,
    async (val) => {
      if (val) {
        name.value = '';
        await nextTick();
        inputRef.value?.input?.focus();
      }
    }
  );

  function handleConfirm() {
    if (canConfirm.value) {
      emit('confirm', name.value.trim());
    }
  }

  function handleCancel() {
    emit('cancel');
  }
</script>

<template>
  <el-dialog
    :model-value="visible"
    title="命名标注对象"
    width="320px"
    :close-on-click-modal="false"
    :close-on-press-escape="true"
    :show-close="false"
    @close="handleCancel"
  >
    <el-form @submit.prevent="handleConfirm">
      <el-form-item label="对象名称">
        <el-input
          ref="inputRef"
          v-model="name"
          placeholder="例如: car, book"
          maxlength="50"
          clearable
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="handleCancel">取消</el-button>
      <el-button type="primary" :disabled="!canConfirm" @click="handleConfirm">确定</el-button>
    </template>
  </el-dialog>
</template>
