import { contextBridge, ipcRenderer } from 'electron';

window.addEventListener('DOMContentLoaded', () => {
    const replaceText = (selector, text) => {
        const element = document.getElementById(selector);
        if (element) { element.innerText = text; }
    }
    for (const type of ['chrome', 'node', 'electron']) {
        replaceText(`${type}-version`, process.versions[type]);
    }
});

contextBridge.exposeInMainWorld('$electron', {
    selectDirectory: () => ipcRenderer.invoke('selectDirectory'),
    downloadM3u8: (aurl: string, dldir: string) => ipcRenderer.invoke('downloadM3u8', aurl, dldir),
    listFiles: (dirPath: string) => ipcRenderer.invoke('listFiles', dirPath)
})
