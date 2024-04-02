import { contextBridge, ipcRenderer } from 'electron';
import { DownloadOptions } from '../src/lib/download';

contextBridge.exposeInMainWorld('$electron', {
    showSaveDialog: (extension: string) => ipcRenderer.invoke('showSaveDialog', extension),
    checkM3u8Playlist: (inputUrl: string, outputFile: string, downloadOptions: DownloadOptions) => ipcRenderer.invoke('checkM3u8Playlist', inputUrl, outputFile, downloadOptions),
    downloadM3u8: (inputUrl: string, outputFile: string, downloadOptions: DownloadOptions) => ipcRenderer.invoke('downloadM3u8', inputUrl, outputFile, downloadOptions),
    stopDownloadM3u8: () => ipcRenderer.invoke('stopDownloadM3u8'),
    getDownloadProgress: () => ipcRenderer.invoke('getDownloadProgress'),
    openLogFolder: () => ipcRenderer.invoke('openLogFolder')
});
