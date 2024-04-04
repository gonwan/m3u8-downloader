<script setup lang="ts">
import { ref } from 'vue';
import { ElInput }  from 'element-plus';
import { VideoInfo } from '../lib/download';
import StreamSelectionDialog from '../component/StreamSelectionDialog.vue';

const selectionDialog = ref<InstanceType<typeof StreamSelectionDialog> | null>(null)
const input1 = ref<InstanceType<typeof ElInput> | null>(null)
const input2 = ref<HTMLInputElement | null>(null);

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
  input1.value?.focus();
  let x = input1.value?.input;
  x!.value = '1234';
  input2.value!.value = '5678';
  let res = await selectionDialog.value?.open(videoInfo);
  console.log(res);
}

</script>

<template>
  <h3>Bilibili</h3>
  <el-button @click="setShow">Open Dialog</el-button>
  <stream-selection-dialog ref="selectionDialog" />
  <el-input ref="input1" />
  <input ref="input2" />
</template>

<style scoped>

</style>
