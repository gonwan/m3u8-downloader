import {createMemoryHistory, createRouter} from 'vue-router';
import HomeView from './view/HomeView.vue';
import BilibiliView from './view/BilibiliView.vue';
import SettingsView from './view/SettingsView.vue';

const routes = [
    { path: '/home', component: HomeView },
    { path: '/bilibili', component: BilibiliView },
    { path: '/settings', component: SettingsView }
]

const router = createRouter({
    history: createMemoryHistory(),
    routes,
})

export { router };
