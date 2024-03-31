import { createApp } from 'vue';
import 'virtual:uno.css'
import './style.css';
import App from './App.vue';
import { router } from "./router";
import log from 'electron-log/renderer';

log.transports.console.level = 'info';
Object.assign(console, log.functions);

const app = createApp(App);

app.use(router)
app.mount('#app');
