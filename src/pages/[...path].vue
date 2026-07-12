<script setup lang="ts">
  import { useRoute } from 'vue-router';

  const route = useRoute();
</script>

<template>
  <div class="not-found">
    <h1>404</h1>
    <p>Page not found: {{ route.path }}</p>
    <router-link to="/">Go Home</router-link>
  </div>
</template>

<style scoped>
  .not-found {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100vh;
    font-family: sans-serif;
    gap: 1rem;
  }

  h1 {
    font-size: 4rem;
    margin: 0;
    color: #999;
  }

  a {
    color: #409eff;
  }
</style>
