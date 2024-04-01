<script setup lang="ts">
const openLogFolder = async () => {
   await window.$electron.openLogFolder();
}
</script>

<template>
  <h3>Settings</h3>
  <el-row>
    <el-col :span="24">
      <el-button plain @click="openLogFolder">Open log folder</el-button>
    </el-col>
  </el-row>
</template>
