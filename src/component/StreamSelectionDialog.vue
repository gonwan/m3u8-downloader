<script setup lang="ts">
import { ref } from 'vue';
import { VideoInfo } from '../lib/download';

// const props = defineProps<{
//   videoInfo?: VideoInfo,
// }>();

const visible = defineModel('visible');

const selectedVideo = ref(-1);
const selectedAudio = ref(-1);

let videoInfo;
let resolve;
let reject;

const open = async (_videoInfo: VideoInfo) => {
  visible.value = true;
  videoInfo = _videoInfo;
  return new Promise((_resolve, _reject) => {
    resolve = _resolve;
    reject = _reject;
  });
}

const onOK = () => {
  let selectedVideoInfo: VideoInfo = { video: [], audio: [] };
  if (selectedVideo.value != -1) {
    selectedVideoInfo.video.push(videoInfo.video[selectedVideo.value]);
  }
  if (selectedVideo.value != -1) {
    selectedVideoInfo.audio.push(videoInfo.audio[selectedAudio.value]);
  }
  console.log('Selected: ' + JSON.stringify(selectedVideoInfo));
  resolve(selectedVideoInfo);
  visible.value = false;
}

defineExpose({
  open
});

</script>

<template>
  <el-dialog v-model="visible" :show-close="false" width="600">
    <div v-if="videoInfo && videoInfo.video && videoInfo.video.length > 0">
      <el-text tag="b">Select video stream</el-text>
      <div mb-4 />
      <!-- see: https://github.com/ElemeFE/element/issues/3037 -->
      <el-radio-group class="radio-button-v" size="small"  v-model="selectedVideo">
        <div v-for="(v, i) in videoInfo.video">
          <el-radio-button :value='i'>
            {{ v.url }}
          </el-radio-button>
        </div>
      </el-radio-group>
      <div mb-4 />
    </div>
    <div v-if="videoInfo && videoInfo.audio && videoInfo.audio.length > 0">
      <el-text tag="b">Select audio stream</el-text>
      <div mb-4 />
      <el-radio-group class="radio-button-v" size="small" v-model="selectedAudio">
        <div v-for="(v, i) in videoInfo.audio">
          <el-radio-button :value='i'>
            {{ v.url }}
          </el-radio-button>
        </div>
      </el-radio-group>
      <div mb-4 />
    </div>
    <el-button type="primary" @click="onOK">OK</el-button>
    <div mb-4 />
  </el-dialog>
</template>

<style scoped>
.radio-button-v {
  display: table;
  margin: 0 auto;
  text-align: left;
}

</style>
