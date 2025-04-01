<script setup lang="ts">
import pkg from '../../package.json';
import { reactive } from "vue";

const form = reactive({
  ffmpegExePath: localStorage.getItem('md.ffmpegExePath') ?? '',
});

const selectFFmpegExePath = async () => {
  let obj = await window.$electron.showOpenDialog('*');
  if (!obj.canceled) {
    form.ffmpegExePath = obj.filePaths[0];
    localStorage.setItem('md.ffmpegExePath', form.ffmpegExePath);
  }
}

const resetFFmpegExePath = async () => {
  form.ffmpegExePath = '';
  localStorage.removeItem('md.ffmpegExePath');
}

const openLogFolder = async () => {
   await window.$electron.openLogFolder();
}

</script>

<template>
  <h3>{{ pkg.name }} - {{ pkg.description }}</h3>
  <div>&copy;2024 {{ pkg.author }} v{{ pkg.version }}</div>
  <el-descriptions border :column="3" title="Dependencies">
    <el-descriptions-item v-for="(v, k) in pkg.dependencies" :label='k'>
      {{ v }}
    </el-descriptions-item>
  </el-descriptions>
  <el-form label-width="auto" max-w-800>
  <h4 text-left mb-4>FFmpeg</h4>
  <el-row>
    <el-col :span="20">
      <el-input v-model.trim="form.ffmpegExePath" placeholder="Customize FFmpeg executable path, or reset to use default..." clearable />
    </el-col>
    <el-col :span="2">
      <el-button plain w-full @click="selectFFmpegExePath">Select</el-button>
    </el-col>
    <el-col :span="2">
      <el-button plain w-full @click="resetFFmpegExePath">Reset</el-button>
    </el-col>
  </el-row>
  <h4 text-left mb-4>Debugging</h4>
  <el-row text-left>
    <el-col :span="6">
      <el-button plain @click="openLogFolder">Open log folder</el-button>
    </el-col>
  </el-row>
  </el-form>
</template>

<style scoped>

</style>
