<script setup lang="ts">
import { reactive } from 'vue';

const form = reactive({
  m3u8Url: '',
  downloadDirectory: '',
  downloadFileName: '',
  baseUrl: '',
  httpHeaders: '',
  httpProxy: '',
  httpConcurrency: '',
  httpTimeout: '',
  httpRetries: ''
});

const greet = async () => {
  let files = await window.$electron.listFiles('D:\\');
  alert(files);
}

const selectDirectory = async () => {
  let obj = await window.$electron.selectDirectory();
  if (!obj.canceled) {
    form.downloadDirectory = obj.filePaths[0];
  }
}

const onSubmit = () => {
  let obj = window.$electron.downloadM3u8(form.m3u8Url, form.downloadDirectory);
}

</script>

<template>
  <h3>Home</h3>
  <el-scrollbar>
    <el-form :model="form" label-width="auto" style="max-width: 800px">
      <el-row>
        <el-col :span="24">
          <el-form-item label="Download from" required>
            <el-input v-model="form.m3u8Url" placeholder="m3u8 url: [http|https|file]://address/to/some.m3u8" clearable />
          </el-form-item>
        </el-col>
      </el-row>
      <el-row>
        <el-col :span="22">
            <el-form-item label="Download to" required>
              <el-input v-model="form.downloadDirectory" placeholder="download directory" clearable />
            </el-form-item>
        </el-col>
        <el-col :span="2">
          <el-button plain @click="selectDirectory">Select</el-button>
        </el-col>
      </el-row>
      <el-row>
        <el-col :span="24">
          <el-form-item label="File name">
            <el-input v-model="form.downloadFileName" placeholder="some.mp4" clearable />
          </el-form-item>
        </el-col>
      </el-row>
      <el-row>
        <el-col :span="24">
          <el-form-item label="Base Url">
            <el-input v-model="form.baseUrl" placeholder="base url of an m3u8 file if using it locally" clearable />
          </el-form-item>
        </el-col>
      </el-row>
      <el-row>
        <el-col :span="24">
          <el-form-item label="Http headers">
            <el-input v-model="form.httpHeaders" placeholder="additional headers to sent: someheader:a,someheader2=b" clearable />
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
        <el-col :span="24">
          <el-form-item label="Concurrency">
            <el-input type="number" max="10" v-model="form.httpConcurrency" placeholder="download concurrency, default 3" clearable />
          </el-form-item>
        </el-col>
      </el-row>
      <el-row>
        <el-col :span="12">
          <el-form-item label="Timeout">
            <el-input type="number" v-model="form.httpTimeout" placeholder="download timeout, default 10(s)" clearable />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="Retries">
            <el-input type="number" v-model="form.httpRetries" placeholder="download retries, default 3" clearable />
          </el-form-item>
        </el-col>
      </el-row>
      <el-row>
        <el-col :span="24">
          <el-form-item>
            <el-button type="primary" @click="onSubmit">Go</el-button>
          </el-form-item>
        </el-col>
      </el-row>
    </el-form>
<!--  <div class="mb-4">-->
<!--      <el-button @click="greet">Default</el-button>-->
<!--      <el-button type="primary" @click="showSaveDialog">Primary</el-button>-->
<!--      <el-button type="success">Success</el-button>-->
<!--      <el-button type="info">Info</el-button>-->
<!--      <el-button type="warning">Warning</el-button>-->
<!--      <el-button type="danger">Danger</el-button>-->
<!--      <p v-for="item in 50" :key="item" class="scrollbar-demo-item">{{ item }}</p>-->
<!--  </div>-->
  </el-scrollbar>
</template>

<style scoped>
.scrollbar-demo-item {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 50px;
  margin: 10px;
  text-align: center;
  border-radius: 4px;
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}
</style>
