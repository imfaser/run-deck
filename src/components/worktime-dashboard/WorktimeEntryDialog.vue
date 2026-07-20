<script setup lang="ts">
  import { ref, computed, watch } from 'vue';
  import dayjs from 'dayjs';
  import { ElMessage } from 'element-plus';
  import { useWorktimeStore } from '@/stores/worktime';

  const props = defineProps<{
    visible: boolean;
    date: string;
  }>();

  const emit = defineEmits<{
    'update:visible': [value: boolean];
    save: [];
  }>();

  const store = useWorktimeStore();
  const clockIn = ref('09:00');
  const clockOut = ref('18:00');

  const displayDate = computed(() => {
    if (!props.date) return '';
    return dayjs(props.date).format('YYYY年M月D日');
  });

  const existingRecord = computed(() => {
    if (!props.date) return null;
    return store.recordsByDate[props.date] ?? null;
  });

  const isPredicted = computed(() => {
    if (!props.date) return false;
    return dayjs(props.date).isBefore(dayjs(), 'day');
  });

  watch(
    () => props.visible,
    (val) => {
      if (val && existingRecord.value) {
        clockIn.value = existingRecord.value.clockIn;
        clockOut.value = existingRecord.value.clockOut;
      } else if (val) {
        clockIn.value = '09:00';
        clockOut.value = '18:00';
      }
    }
  );

  function handleSave() {
    const [inH, inM] = clockIn.value.split(':').map(Number);
    const [outH, outM] = clockOut.value.split(':').map(Number);
    const inMinutes = inH * 60 + inM;
    const outMinutes = outH * 60 + outM;

    if (inMinutes >= outMinutes) {
      ElMessage.warning('上班时间必须早于下班时间');
      return;
    }

    store.addRecord(props.date, clockIn.value, clockOut.value);
    ElMessage.success('保存成功');
    emit('update:visible', false);
    emit('save');
  }

  function handleCancel() {
    emit('update:visible', false);
  }
</script>

<template>
  <el-dialog
    :model-value="visible"
    title="录入工时"
    width="400px"
    @update:model-value="(val: boolean) => emit('update:visible', val)"
  >
    <div class="dialog-content">
      <div class="date-display">{{ displayDate }}</div>

      <el-alert
        v-if="isPredicted"
        title="此日期为预测工时"
        type="info"
        show-icon
        :closable="false"
        class="predicted-alert"
      />

      <el-form label-width="80px">
        <el-form-item label="上班时间">
          <el-time-picker
            v-model="clockIn"
            format="HH:mm"
            value-format="HH:mm"
            placeholder="选择上班时间"
            arrow-control
          />
        </el-form-item>

        <el-form-item label="下班时间">
          <el-time-picker
            v-model="clockOut"
            format="HH:mm"
            value-format="HH:mm"
            placeholder="选择下班时间"
            arrow-control
          />
        </el-form-item>
      </el-form>
    </div>

    <template #footer>
      <el-button @click="handleCancel">取消</el-button>
      <el-button type="primary" @click="handleSave">确定</el-button>
    </template>
  </el-dialog>
</template>

<style scoped lang="scss">
  .dialog-content {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-rem-lg);
  }

  .date-display {
    font-size: var(--text-lg);
    font-weight: var(--font-medium);
    color: var(--text-primary);
    text-align: center;
  }

  .predicted-alert {
    margin-bottom: var(--spacing-rem-sm);
  }

  :deep(.el-time-picker) {
    width: 100%;
  }
</style>
