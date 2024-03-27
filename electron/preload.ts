import { contextBridge, ipcRenderer } from 'electron';
import { DownloadOptions } from "../src/lib/download";

contextBridge.exposeInMainWorld('$electron', {
    showSaveDialog: (extension: string) => ipcRenderer.invoke('showSaveDialog', extension),
    downloadM3u8: (inputUrl: string, outputFile: string, downloadOptions: DownloadOptions) => ipcRenderer.invoke('downloadM3u8', inputUrl, outputFile, downloadOptions)
});
