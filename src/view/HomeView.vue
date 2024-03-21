<script setup lang="ts">
const greet = async () => {
  let files = await window.$electron.listFiles('D:\\');
  alert(files);
}
const showSaveDialog = async () => {
  let obj = await window.$electron.showSaveDialog();
  alert(obj.filePath);
}
</script>

<template>
  <h3>Home</h3>
  <div class="mb-4">
    <el-scrollbar>
      <el-button @click="greet">Default</el-button>
      <el-button type="primary" @click="showSaveDialog">Primary</el-button>
      <el-button type="success">Success</el-button>
      <el-button type="info">Info</el-button>
      <el-button type="warning">Warning</el-button>
      <el-button type="danger">Danger</el-button>
      <p v-for="item in 50" :key="item" class="scrollbar-demo-item">{{ item }}</p>
    </el-scrollbar>
  </div>
</template>

<style scoped>
.scrollbar-demo-item {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 50px;
  margin: 10px;
  text-align: center;
  border-radius: 4px;
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}
</style>
