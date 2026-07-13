<script setup lang="ts"></script>

<template>
  <el-result icon="error" title="404" sub-title="页面不存在">
    <template #extra>
      <el-button type="primary" @click="$router.push('/')">返回首页</el-button>
    </template>
  </el-result>
</template>

<style scoped lang="scss">
  :deep(.el-result) {
    min-height: calc(100vh - var(--titlebar-height));
  }
</style>
