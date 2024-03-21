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
    <el-button @click="greet">Default</el-button>
    <el-button type="primary" @click="showSaveDialog">Primary</el-button>
    <el-button type="success">Success</el-button>
    <el-button type="info">Info</el-button>
    <el-button type="warning">Warning</el-button>
    <el-button type="danger">Danger</el-button>
  </div>
</template>
