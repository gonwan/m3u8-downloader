<script setup lang="ts">
import { reactive, ref } from 'vue';
import log from 'electron-log/renderer';

const form = reactive({
    m3u8Url: '',
    downloadFilePath: '',
    httpHeaders: 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    httpProxy: '',
    httpConcurrency: 3,
    httpTimeout: 10,
    httpRetries: 3,
    /* for debugging */
    preserveFiles: false
});

const isDownloading = ref(false);
const downloadSpeed = ref('');
const downloadProgress = ref(0);

const formatSize = (size: number) => {
    if (size < 0) {
        return 'ERROR';
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

const selectFilePath = async () => {
    let obj = await window.$electron.showSaveDialog('mp4');
    if (!obj.canceled) {
        form.downloadFilePath = obj.filePath;
    }
}

const onGo = async () => {
    isDownloading.value = true;
    let headerRecord = new Map();
    form.httpHeaders.split(/\n/).forEach((value) => {
        let kv = value.split(':');
        if (kv.length == 2) {
            headerRecord.set(kv[0].trim(), kv[1].trim());
        }
    });
    let prom = window.$electron.downloadM3u8(form.m3u8Url, form.downloadFilePath, {
        headers: headerRecord,
        proxy: form.httpProxy,
        concurrency: form.httpConcurrency,
        timeout: form.httpTimeout * 1000,
        retries: form.httpRetries,
        preserveFiles: form.preserveFiles
    });
    let pollingTimer = setInterval(async () => {
        let progress = await window.$electron.getDownloadProgress();
        if (progress.totalSegs == 0) {
            return;
        }
        let percent = progress.transferredSegs / progress.totalSegs;
        let str = `Downloading ${progress.transferredSegs}/${progress.totalSegs} segs `
            + `(${formatSize(progress.transferredBytes)}/${formatSize(progress.transferredBytes/percent)}) in ${formatSize(progress.speed)}/s`
        log.info(str);
        downloadProgress.value = Number((percent*100).toFixed(2));
        downloadSpeed.value = str;
        if (progress.totalSegs == progress.transferredSegs) {
            clearInterval(pollingTimer);
        }
    }, 1000);
    await prom;
    downloadSpeed.value = 'Download finished!';
    isDownloading.value = false;
}

const onCancel = async () => {
    await window.$electron.stopDownloadM3u8();
    downloadSpeed.value = 'Download stopped!';
    isDownloading.value = false;
}

</script>

<template>
  <div>
  <h3>Home</h3>
  <el-scrollbar>
    <el-form :model="form" label-width="auto" max-w-800>
      <el-row>
        <el-col :span="24">
          <el-form-item label="Download from" required>
            <el-input v-model="form.m3u8Url" placeholder="m3u8 url: [http|https]://address/to/some.m3u8" clearable />
          </el-form-item>
        </el-col>
      </el-row>
      <el-row>
        <el-col :span="22">
            <el-form-item label="Download as" required>
              <el-input v-model="form.downloadFilePath" placeholder="download file path" clearable />
            </el-form-item>
        </el-col>
        <el-col :span="2">
          <el-button plain @click="selectFilePath">Select</el-button>
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
        <el-col :span="12">
          <el-form-item label="Concurrency">
            <el-input type="number" min="1" max="10" v-model="form.httpConcurrency" placeholder="download concurrency, default 3" clearable />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="Preserve files">
            <el-tooltip content="preserve files (debugging)" placement="top">
              <el-checkbox v-model="form.preserveFiles" label="Yes" />
            </el-tooltip>
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
        <el-text>{{ downloadSpeed }}</el-text>
        <el-progress :text-inside="true" :stroke-width="20" :percentage="downloadProgress" />
      </el-col>
    </el-row>
  </el-scrollbar>
  </div>
</template>

<style scoped>

</style>
