<script setup lang="ts">
import { ref } from 'vue';
import { VideoInfo } from '../lib/download.ts';
import StreamSelectionDialog from '../component/StreamSelectionDialog.vue';

const sel = ref('3');
const show = ref(false);
const selDialog = ref(null);
const testInput = ref(null);

const videoInfo : VideoInfo = {
  video: [
    { codecs: 'codec1', resWidth: 1920, resHeight: 1080, audioGroup: 'aud1', url: 'http://aaa' },
    { codecs: 'codec2', resWidth: 720, resHeight: 480, audioGroup: 'aud2', url: 'http://bbb' },
    { codecs: 'codec1', resWidth: 1920, resHeight: 1080, url: 'http://aaa' },
    { codecs: 'codec2', resWidth: 720, resHeight: 480, url: 'http://bbb' },
    { codecs: 'codec1', resWidth: 1920, resHeight: 1080, url: 'http://aaa' },
    { codecs: 'codec2', resWidth: 720, resHeight: 480, url: 'http://bbb' },
    { codecs: 'codec1', resWidth: 1920, resHeight: 1080, url: 'http://aaa' },
    { codecs: 'codec2', resWidth: 720, resHeight: 480, url: 'http://bbb' },
    { codecs: 'codec1', resWidth: 1920, resHeight: 1080, url: 'http://aaa' },
    { codecs: 'codec2', resWidth: 720, resHeight: 480, url: 'http://bbb' },
    { codecs: 'codec1', resWidth: 1920, resHeight: 1080, url: 'http://aaa' },
    { codecs: 'codec2', resWidth: 720, resHeight: 480, url: 'http://bbb' },
    { codecs: 'codec1', resWidth: 1920, resHeight: 1080, url: 'http://aaa' },
    { codecs: 'codec2', resWidth: 720, resHeight: 480, url: 'http://bbb' },
    { codecs: 'codec1', resWidth: 1920, resHeight: 1080, url: 'http://aaa' },
    { codecs: 'codec2', resWidth: 720, resHeight: 480, url: 'http://bbb' },
    { codecs: 'codec1', resWidth: 1920, resHeight: 1080, url: 'http://aaa' },
    { codecs: 'codec2', resWidth: 720, resHeight: 480, url: 'http://bbb' },
    { codecs: 'codec1', resWidth: 1920, resHeight: 1080, url: 'http://aaa' },
    { codecs: 'codec2', resWidth: 720, resHeight: 480, url: 'http://bbb' },
    { codecs: 'codec1', resWidth: 1920, resHeight: 1080, url: 'http://aaa' },
    { codecs: 'codec2', resWidth: 720, resHeight: 480, url: 'http://bbb' },
    { codecs: 'codec1', resWidth: 1920, resHeight: 1080, url: 'http://aaa' },
    { codecs: 'codec2', resWidth: 720, resHeight: 480, url: 'http://bbb' }
  ],
  audio: [
    { codecs: 'aaa', name: 'English', language: 'en', audioGroup: 'aud1', url: 'http://ccc' },
    { codecs: 'bbb', name: 'Chinese', language: 'cn', audioGroup: 'aud2', url: 'http://ddd' }
  ]
};

const setShow = async () => {
  testInput.value.focus();
  testInput.value.value = '3883838383'; // proxied???
  let res = await selDialog.value.open(videoInfo);
  console.log(res);
}

</script>

<template>
  <h3>Bilibili</h3>
  <el-button @click="setShow">Open Dialog</el-button>
  <stream-selection-dialog ref="selDialog" greetings="kdkdkd" :video-info="videoInfo" />
  <el-input ref="testInput" />
</template>

<style scoped>

</style>
