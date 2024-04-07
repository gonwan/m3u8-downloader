import {createMemoryHistory, createRouter} from 'vue-router';
import HomeView from './views/HomeView.vue';
import BilibiliView from './views/BilibiliView.vue';
import SettingsView from './views/SettingsView.vue';

const routes = [
    { path: '/', component: HomeView },
    { path: '/bilibili', component: BilibiliView },
    { path: '/settings', component: SettingsView }
]

const router = createRouter({
    history: createMemoryHistory(),
    routes,
})

export { router };
