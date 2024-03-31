import { contextBridge, ipcRenderer } from 'electron';
import { DownloadOptions } from "../src/lib/download";
import {getDownloadProgress} from "../src/lib/m3u8downloader";

contextBridge.exposeInMainWorld('$electron', {
    showSaveDialog: (extension: string) => ipcRenderer.invoke('showSaveDialog', extension),
    downloadM3u8: (inputUrl: string, outputFile: string, downloadOptions: DownloadOptions) => ipcRenderer.invoke('downloadM3u8', inputUrl, outputFile, downloadOptions),
    getDownloadProgress: () => ipcRenderer.invoke('getDownloadProgress')
});
