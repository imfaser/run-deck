<script setup lang="ts">
  import { logMessage } from '@/services/cmd';

  function testLog() {
    logMessage('info', '前端日志测试');
    logMessage('warn', '前端警告测试');
    logMessage('error', '前端错误测试');
  }
</script>

<template>
  <div>
    <button @click="testLog">测试日志</button>
  </div>
</template>
