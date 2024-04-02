<script setup lang="ts">

</script>

<template>
  <el-container h-screen w-screen>
    <el-aside width="auto" flex>
      <el-menu mode="vertical" :default-active="$route.path" collapse router flex flex-col>
        <el-menu-item index="/">
          <el-icon><div i-ri-home-smile-line /></el-icon>
          <template #title>Home</template>
        </el-menu-item>
        <el-menu-item index="/bilibili">
          <el-icon><div i-ri-bilibili-line /></el-icon>
          <template #title>Bilibili</template>
        </el-menu-item>
        <!-- work likes a spacer in qt -->
        <div flex-grow />
        <el-menu-item index="/settings">
          <el-icon><div i-ri-settings-3-line /></el-icon>
          <template #title>Settings</template>
        </el-menu-item>
        <!-- additional space to workaround the unintended scroll bar issue -->
        <div h-2 />
      </el-menu>
    </el-aside>
    <el-main>
      <RouterView />
    </el-main>
  </el-container>
</template>

<style scoped>

</style>
