<script setup lang="ts">
import { Menu as IconMenu, Message, Setting } from '@element-plus/icons-vue';
</script>

<template>
  <el-container class="layout-container-demo" style="height: 100%; width: 100%">
    <el-aside width="auto">
      <el-menu mode="vertical" default-active="/home" collapse router>
        <el-menu-item index="/home">
          <el-icon><message /></el-icon>
          <template #title>Home</template>
        </el-menu-item>
        <el-menu-item index="/bilibili">
          <el-icon><icon-menu /></el-icon>
          <template #title>Bilibili</template>
        </el-menu-item>
        <el-menu-item index="/settings">
          <el-icon><setting /></el-icon>
          <template #title>Settings</template>
        </el-menu-item>
      </el-menu>
    </el-aside>
    <el-container>
      <el-main>
        <RouterView />
      </el-main>
    </el-container>
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
