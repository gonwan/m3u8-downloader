<script setup lang="ts">
import pkg from '../../package.json';

const openLogFolder = async () => {
   await window.$electron.openLogFolder();
}

</script>

<template>
  <h3>{{ pkg.name }} - {{ pkg.description }}</h3>
  <div>&copy;2024 {{ pkg.author }} v{{ pkg.version }}</div>
  <el-descriptions border :column="2" title="Dependencies">
    <el-descriptions-item v-for="(v, k) in pkg.dependencies" :label='k'>
      {{ v }}
    </el-descriptions-item>
  </el-descriptions>
  <h4 text-left>Debugging</h4>
  <el-row text-left>
    <el-col :span="6">
      <el-button plain @click="openLogFolder">Open log folder</el-button>
    </el-col>
  </el-row>
</template>
