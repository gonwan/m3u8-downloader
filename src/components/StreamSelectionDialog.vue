<script setup lang="ts">
import { ref, watch } from 'vue';
import { type StreamInfo, type VideoInfo } from '../../electron/lib/global';

// const props = defineProps<{
//   videoInfo?: VideoInfo,
// }>();

const visible = defineModel('visible');

const selectedVideoIndex = ref(-1);
const selectedAudioIndex = ref(-1);

let videoInfo: VideoInfo;
let resolve: (value: VideoInfo) => void;
let reject: (reason?: any) => void;

const autoSelectBestVideo = () => {
  if (videoInfo.video) {
    let maxWidth = 0;
    let maxBandwidth = 0;
    let bestVideoIndex = 0;
    for (let i = 0; i < videoInfo.video.length; i++) {
      let si = videoInfo.video[i];
      if (si.resWidth && si.resWidth > maxWidth) {
        maxWidth = si.resWidth;
        bestVideoIndex = i;
      } else if (si.resWidth === maxWidth && si.bandwidth && si.bandwidth > maxBandwidth) {
        maxBandwidth = si.bandwidth;
        bestVideoIndex = i;
      }
    }
    selectedVideoIndex.value = bestVideoIndex;
  }
}

const open = async (_videoInfo: VideoInfo): Promise<VideoInfo> => {
  visible.value = true;
  videoInfo = _videoInfo;
  watch (selectedVideoIndex, async (newIndex) => {
    let audioGroup = videoInfo.video[newIndex].audioGroup ?? '';
    if (videoInfo.audio) {
      let bestAudioIndex = -1;
      for (let i = 0; i < videoInfo.audio.length; i++) {
        let si = videoInfo.audio[i];
        if (si.audioGroup === audioGroup || audioGroup === '') {
          if (bestAudioIndex == -1 || si.language === 'en' || si.language === 'en-US') {
            bestAudioIndex = i;
          }
        }
      }
      selectedAudioIndex.value = bestAudioIndex;
    }
  });
  autoSelectBestVideo();
  return new Promise((_resolve, _reject) => {
    resolve = _resolve;
    reject = _reject;
  });
}

const onOK = () => {
  let selectedVideoInfo: VideoInfo = { video: [], audio: [] };
  if (selectedVideoIndex.value != -1) {
    selectedVideoInfo.video.push(videoInfo.video[selectedVideoIndex.value]);
  }
  if (selectedAudioIndex.value != -1) {
    selectedVideoInfo.audio.push(videoInfo.audio[selectedAudioIndex.value]);
  }
  resolve(selectedVideoInfo);
  visible.value = false;
}

const onCancel = () => {
  resolve({ } as VideoInfo);
  visible.value = false;
}

const formatVideoStreamInfo = (streamInfo: StreamInfo) => {
  let str = '';
  if (streamInfo.resWidth && streamInfo.resHeight) {
    str += `[${streamInfo.resWidth}x${streamInfo.resHeight}]`;
  }
  if (streamInfo.bandwidth) {
    str += `[${(streamInfo.bandwidth/1000).toFixed(0)}kbps]`;
  }
  if (streamInfo.codecs) {
    str += `[${streamInfo.codecs}]`;
  }
  if (streamInfo.audioGroup) {
    str += `[audio=${streamInfo.audioGroup}]`;
  }
  return str;
}

const formatAudioStreamInfo = (streamInfo: StreamInfo) => {
  let str = '';
  if (streamInfo.language) {
    str += `[${streamInfo.language}]`;
  }
  if (streamInfo.name) {
    str += `[${streamInfo.name}]`;
  }
  if (streamInfo.audioGroup) {
    str += `[group=${streamInfo.audioGroup}]`;
  }
  return str;
}

defineExpose({
  open
});

</script>

<template>
  <el-dialog v-model="visible" :show-close="false" width="600" :before-close="()=>{}">
    <div v-if="videoInfo && videoInfo.video && videoInfo.video.length > 0">
      <h3 mt-0 mb-0>Select video stream</h3>
      <el-scrollbar max-height="180">
        <!-- see: https://github.com/ElemeFE/element/issues/3037 -->
        <el-radio-group class="radio-button-v" size="small" v-model="selectedVideoIndex">
          <div v-for="(v, i) in videoInfo.video">
            <el-radio-button :value='i'>
              <div min-w="100">{{ formatVideoStreamInfo(v) }}</div>
            </el-radio-button>
          </div>
        </el-radio-group>
      </el-scrollbar>
    </div>
    <div v-if="videoInfo && videoInfo.audio && videoInfo.audio.length > 0">
      <h3 mb-0>Select audio stream</h3>
      <el-scrollbar max-height="180">
        <el-radio-group class="radio-button-v" size="small" v-model="selectedAudioIndex">
          <div v-for="(v, i) in videoInfo.audio">
            <el-radio-button :value='i'>
              <div min-w="100">{{ formatAudioStreamInfo(v) }}</div>
            </el-radio-button>
          </div>
        </el-radio-group>
      </el-scrollbar>
    </div>
    <div mt-6 mb-4>
      <el-button type="primary" @click="onOK">OK</el-button>
      <el-button type="primary" @click="onCancel">Cancel</el-button>
    </div>
  </el-dialog>
</template>

<style scoped>
.radio-button-v {
  display: table;
  margin: 0 auto;
  text-align: center;
}

</style>
