import { contextBridge, ipcRenderer } from 'electron';
import { DownloadOptions } from "../src/lib/download";

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
    selectFilePath: () => ipcRenderer.invoke('selectFilePath'),
    downloadM3u8: (inputUrl: string, outputFile: string, downloadOptions: DownloadOptions) => ipcRenderer.invoke('downloadM3u8', inputUrl, outputFile, downloadOptions),
    listFiles: (dirPath: string) => ipcRenderer.invoke('listFiles', dirPath)
});
