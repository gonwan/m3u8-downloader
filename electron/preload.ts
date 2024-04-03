import { contextBridge, ipcRenderer } from 'electron';
import { DownloadOptions } from '../src/lib/download';

contextBridge.exposeInMainWorld('$electron', {
    showSaveDialog: (extension: string) => ipcRenderer.invoke('showSaveDialog', extension),
    m3u8CheckPlaylist: (inputUrl: string, outputFile: string, downloadOptions: DownloadOptions) => ipcRenderer.invoke('m3u8CheckPlaylist', inputUrl, outputFile, downloadOptions),
    m3u8Download: (inputUrl: string, outputFile: string, downloadOptions: DownloadOptions, isVideo: boolean) => ipcRenderer.invoke('m3u8Download', inputUrl, outputFile, downloadOptions, isVideo),
    m3u8StopDownload: () => ipcRenderer.invoke('m3u8StopDownload'),
    m3u8GetDownloadProgress: () => ipcRenderer.invoke('m3u8GetDownloadProgress'),
    m3u8ConcatStreams: (videoPartFiles: string[], audioPartFiles: string[], outputFile: string, downloadOptions: DownloadOptions, videoCodecs: string) => ipcRenderer.invoke('m3u8ConcatStreams', videoPartFiles, audioPartFiles, outputFile, downloadOptions, videoCodecs),
    openLogFolder: () => ipcRenderer.invoke('openLogFolder')
});
