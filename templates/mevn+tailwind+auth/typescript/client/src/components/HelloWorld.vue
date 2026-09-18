<script setup lang="ts">
import { ref } from 'vue'

defineProps<{ msg: string }>()

const count = ref(0)
</script>

<template>
  <h1>{{ msg }}</h1>

  <div class="card">
    <button type="button" @click="count++">count is {{ count }}</button>
    <p>
      Edit
      <code>components/HelloWorld.vue</code> to test HMR
    </p>
  </div>

  <p>
    Check out
    <a href="https://vuejs.org/guide/quick-start.html#local" target="_blank"
      >create-vue</a
    >, the official Vue + Vite starter
  </p>
  <p>
    Learn more about IDE Support for Vue in the
    <a
      href="https://vuejs.org/guide/scaling-up/tooling.html#ide-support"
      target="_blank"
      >Vue Docs Scaling up Guide</a
    >.
  </p>
  <p class="read-the-docs">Click on the Vite and Vue logos to learn more</p>
  <div class="powered-box">
    Powered by <span class="powered-highlight">StackCraft</span>
  </div>
</template>

<style scoped>
.powered-box {
  position: fixed;
  bottom: 24px;
  left: 24px;
  background-color: black;
  color: white;
  padding: 8px 16px;
  font-size: 0.875rem;
  border-radius: 16px;
  box-shadow: 0 4px 6px rgba(0,0,0,0.3);
  opacity: 0.85;
  transition: opacity 0.2s ease;
  cursor: default;
}

.powered-box:hover {
  opacity: 1;
}

.powered-highlight {
  font-weight: 600;
  color: #22c55e;
}
.read-the-docs {
  color: #888;
}
</style>
