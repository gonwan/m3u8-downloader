<script setup lang="ts">
import { House, Monitor, Setting } from '@element-plus/icons-vue';
</script>

<template>
  <el-container class="layout-container-demo" style="height: 100vh; width: 100vw">
    <el-aside width="auto" style="display: flex">
      <el-menu mode="vertical" :default-active="$route.path" collapse router style="display: flex; flex-direction: column">
        <el-menu-item index="/">
          <el-icon><house /></el-icon>
          <template #title>Home</template>
        </el-menu-item>
        <el-menu-item index="/bilibili">
          <el-icon><monitor /></el-icon>
          <template #title>Bilibili</template>
        </el-menu-item>
        <!-- work likes a spacer in qt -->
        <div style="flex-grow: 1" />
        <el-menu-item index="/settings">
          <el-icon><setting /></el-icon>
          <template #title>Settings</template>
        </el-menu-item>
        <!-- additional space to workaround the unintended scroll bar issue -->
        <div style="height: 4px" />
      </el-menu>
    </el-aside>
    <el-main>
      <RouterView />
    </el-main>
  </el-container>
</template>

<style scoped>
.layout-container-demo .el-header {
  position: relative;
  background-color: var(--el-color-primary-light-7);
  color: var(--el-text-color-primary);
}
.layout-container-demo .el-aside {
  color: var(--el-text-color-primary);
  background: var(--el-color-primary-light-8);
}
.layout-container-demo .el-menu {
  border-right: none;
}
.layout-container-demo .el-main {
  padding: 0;
}
.layout-container-demo .toolbar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  right: 20px;
}
</style>
