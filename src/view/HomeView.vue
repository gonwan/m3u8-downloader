<script setup lang="ts">
const greet = async () => {
  const files = await window.$electron.listFiles('D:\\');
  alert(files);
}
</script>
<template>
  <h3>Home</h3>
  <div class="mb-4">
    <el-button @click="greet">Default</el-button>
    <el-button type="primary">Primary</el-button>
    <el-button type="success">Success</el-button>
    <el-button type="info">Info</el-button>
    <el-button type="warning">Warning</el-button>
    <el-button type="danger">Danger</el-button>
  </div>
</template>
