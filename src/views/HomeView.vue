<script setup lang="ts">
import { reactive, ref } from 'vue';
import log from 'electron-log/renderer';
import { DownloadOptions } from '../lib/download';
import StreamSelectionDialog from '../components/StreamSelectionDialog.vue';

const form = reactive({
  m3u8Url: '',
  downloadFilePath: localStorage.getItem('md.downloadFilePath') ?? '',
  httpHeaders: 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  httpProxy: '',
  autoSelectBest: true,
  httpConcurrency: 3,
  httpTimeout: 10,
  httpRetries: 3,
  /* for debugging */
  preserveFiles: false
});

/* see: https://vuejs.org/guide/typescript/composition-api#typing-template-refs */
const selectionDialog = ref<InstanceType<typeof StreamSelectionDialog> | null>(null);
const isCancelDownloading = ref(false); /* status management */
const isDownloading = ref(false); /* ui binding */
const downloadSpeed = ref('');
const downloadProgress = ref(0);

const formatSize = (size: number) => {
  if (size < 0) {
    return 'Error';
  } else if (size == Infinity) {
    return '??? B';
  } else if (size >= 1024 * 1024 * 1024) {
    return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  } else if (size >= 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(2)} MB`;
  } else if (size >= 1024) {
    return `${(size / (1024)).toFixed(2)} KB`;
  } else {
    return `${size} B`;
  }
}

const startPollingTimer = (isVideo: boolean) => {
  let streamType = isVideo ? 'video' : 'audio';
  let pollingTimer = setInterval(async () => {
    let progress = await window.$electron.m3u8GetDownloadProgress();
    if (progress.isStop) {
      clearInterval(pollingTimer);
      downloadProgress.value = 0;
      return;
    }
    if (progress.totalSegs == -1) {
      return;
    }
    let percent = (progress.totalSegs == 0) ? 1 : progress.transferredSegs / progress.totalSegs;
    let str = `Downloading ${streamType}: ${progress.transferredSegs}/${progress.totalSegs} segs `
        + `(${formatSize(progress.transferredBytes)}/${formatSize(progress.transferredBytes/percent)} @ ${formatSize(progress.speed)}/s)`;
    downloadProgress.value = Number((percent*100).toFixed(2));
    downloadSpeed.value = str;
    if (progress.transferredSegs == progress.totalSegs) {
      clearInterval(pollingTimer);
    }
  }, 1000);
}

const selectFilePath = async () => {
  let obj = await window.$electron.showSaveDialog('mp4');
  if (!obj.canceled) {
    form.downloadFilePath = obj.filePath;
  }
}

const onGo = async () => {
  if (form.m3u8Url === '') {
    await ElMessageBox.alert('Empty m3u8 url!');
    return;
  }
  if (form.downloadFilePath === '') {
    await ElMessageBox.alert('Empty download file path!');
    return;
  }
  localStorage.setItem('md.downloadFilePath', form.downloadFilePath);
  let downloadFilePath = await window.$electron.checkFileExists(form.downloadFilePath);
  if (downloadFilePath !== form.downloadFilePath) {
    ElMessage({
      type: 'warning',
      dangerouslyUseHTMLString: true,
      message: `File exists, rename to:<br/>${downloadFilePath}`
    });
  }
  isDownloading.value = true;
  isCancelDownloading.value = false;
  let headerRecord = new Map();
  form.httpHeaders.split(/\n/).forEach((value) => {
    let idx = value.indexOf(':');
    if (idx != -1) {
      headerRecord.set(value.slice(0, idx).trim(), value.slice(idx+1).trim());
    }
  });
  let downloadOptions: DownloadOptions = {
    headers: headerRecord,
    proxy: form.httpProxy,
    autoSelectBest: form.autoSelectBest,
    concurrency: form.httpConcurrency,
    timeout: form.httpTimeout * 1000,
    retries: form.httpRetries,
    preserveFiles: form.preserveFiles
  };
  let err;
  /* check playlist */
  do {
    let videoInfo = await window.$electron.m3u8CheckPlaylist(form.m3u8Url, form.downloadFilePath, downloadOptions);
    let videoUrl = '';
    let videoCodecs = '';
    let audioUrl = '';
    if (!videoInfo) {
      log.info('Input Url is already a video m3u8');
      videoUrl = form.m3u8Url;
    } else if (videoInfo instanceof Error) {
      err = videoInfo;
      break;
    } else {
      /* input url is playlist.m3u8 */
      if (!downloadOptions.autoSelectBest) {
        videoInfo = await selectionDialog.value?.open(videoInfo)!;
      }
      if (videoInfo.video && videoInfo.video.length > 0) {
        let v = videoInfo.video[0];
        log.info(`${downloadOptions.autoSelectBest ? 'Auto' : 'Manual'} selecting video resolution ${v.resWidth}x${v.resHeight}: ${v.url}`);
        videoUrl = v.url;
        videoCodecs = v.codecs ?? '';
      }
      if (videoInfo.audio && videoInfo.audio.length > 0) {
        let a = videoInfo.audio[0];
        log.info(`${downloadOptions.autoSelectBest ? 'Auto' : 'Manual'} selecting audio language ${a.language}: ${a.url}`);
        audioUrl = a.url;
      }
    }
    /* download video */
    let videoPartFiles: string[] = [];
    let audioPartFiles: string[] = [];
    if (videoUrl !== '') {
      let prom = window.$electron.m3u8Download(videoUrl, form.downloadFilePath, downloadOptions, true, (audioUrl === ''));
      startPollingTimer(true);
      let res = await prom;
      if (res instanceof Error) {
        err = res;
        break;
      } else {
        videoPartFiles = res;
      }
    }
    /* download audio */
    if (!isCancelDownloading.value && audioUrl !== '') {
      let prom = window.$electron.m3u8Download(audioUrl, form.downloadFilePath, downloadOptions, false, false);
      startPollingTimer(false);
      let res = await prom;
      if (res instanceof Error) {
        err = res;
        break;
      } else {
        audioPartFiles = res;
      }
    }
    /* concat all */
    if (!isCancelDownloading.value && videoPartFiles.length > 0) {
      downloadSpeed.value = 'Running ffmpeg concat...';
      let dot = form.downloadFilePath.lastIndexOf('.');
      let workingDir = (dot == -1) ? form.downloadFilePath : form.downloadFilePath.slice(0, dot);
      let res = await window.$electron.m3u8ConcatStreams(
          videoPartFiles, audioPartFiles ?? [], downloadFilePath, workingDir, downloadOptions, videoCodecs);
      if (res instanceof Error) {
        err = res;
        break;
      }
    }
  } while (0);
  if (err) {
    log.error('Download error', err);
    downloadSpeed.value = 'Download error!';
    await ElMessageBox.alert(err.message, 'Error');
  } else {
    log.info(isCancelDownloading.value ? 'Download canceled!' : 'Download finished!');
    downloadSpeed.value = isCancelDownloading.value ? 'Download canceled!' : 'Download finished!';
  }
  isDownloading.value = false;
}

const onCancel = async () => {
  isCancelDownloading.value = true;
  await window.$electron.m3u8StopDownload();
}

</script>

<template>
  <h3>Home</h3>
  <div><!-- el-scrollbar has height: 100% -->
  <el-scrollbar>
    <el-form :model="form" label-width="auto" max-w-800>
      <el-row>
        <el-col :span="24">
          <el-form-item label="M3u8 Url" required>
            <el-input v-model="form.m3u8Url" placeholder="m3u8 url: [http|https]://address/to/some.m3u8" clearable />
          </el-form-item>
        </el-col>
      </el-row>
      <el-row>
        <el-col :span="22">
            <el-form-item label="Download file path" required>
              <el-input v-model="form.downloadFilePath" placeholder="download file path" clearable />
            </el-form-item>
        </el-col>
        <el-col :span="2">
          <el-button plain w-full @click="selectFilePath">Select</el-button>
        </el-col>
      </el-row>
      <el-row>
        <el-col :span="24">
          <el-form-item label="Http headers">
            <el-input type="textarea" rows="4" v-model="form.httpHeaders" placeholder="additional headers to sent: someheader:a someheader2:b" />
          </el-form-item>
        </el-col>
      </el-row>
      <el-row>
        <el-col :span="24">
          <el-form-item label="Http proxy">
            <el-input v-model="form.httpProxy" placeholder="http://127.0.0.1:8080 etc." clearable />
          </el-form-item>
        </el-col>
      </el-row>
      <el-row>
        <el-col :span="6">
          <el-form-item label="Auto select best">
            <el-tooltip content="auto select best video/audio stream" placement="top">
              <el-checkbox v-model="form.autoSelectBest" label="Yes" />
            </el-tooltip>
          </el-form-item>
        </el-col>
        <el-col :span="6">
          <el-form-item label="Preserve files">
            <el-tooltip content="preserve files (debugging)" placement="top">
              <el-checkbox v-model="form.preserveFiles" label="Yes" />
            </el-tooltip>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="Concurrency">
            <el-input type="number" min="1" max="10" v-model="form.httpConcurrency" placeholder="download concurrency, default 3" clearable />
          </el-form-item>
        </el-col>
      </el-row>
      <el-row>
        <el-col :span="12">
          <el-form-item label="Timeout">
            <el-input type="number" min="1" max="30" v-model="form.httpTimeout" placeholder="download timeout, default 10(s)" clearable />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="Retries">
            <el-input type="number" min="0" max="10" v-model="form.httpRetries" placeholder="download retries, default 3" clearable />
          </el-form-item>
        </el-col>
      </el-row>
      <el-row>
        <el-col :span="24">
          <el-form-item>
            <el-button type="primary" :disabled="isDownloading" ma mr-4 @click="onGo">Go</el-button>
            <el-button type="primary" :disabled="!isDownloading" ma ml-4 @click="onCancel">Cancel</el-button>
          </el-form-item>
        </el-col>
      </el-row>
    </el-form>
    <el-row>
      <el-col :span="24">
        <el-text inline-block>{{ downloadSpeed }}</el-text>
      </el-col>
    </el-row>
    <el-row>
      <el-col :span="24">
        <el-progress :text-inside="true" :stroke-width="20" :percentage="downloadProgress" />
      </el-col>
    </el-row>
  </el-scrollbar>
  </div>
  <stream-selection-dialog ref="selectionDialog" />
</template>

<style scoped>

</style>
