import { VideoInfo, DownloadOptions, DownloadProgress } from './lib/download';

export interface IElectron {
    showSaveDialog: (extension: string) => Promise<Electron.SaveDialogReturnValue>,
    checkM3u8Playlist: (inputUrl: string, outputFile: string, downloadOptions: DownloadOptions) => Promise<void> | Promise<Error> | Promise<VideoInfo>,
    downloadM3u8: (inputUrl: string, outputFile: string, downloadOptions: DownloadOptions) => Promise<void> | Promise<Error>,
    stopDownloadM3u8: () => Promise<DownloadProgress>,
    getDownloadProgress: () => Promise<DownloadProgress>,
    openLogFolder: () => Promise<void>
}

declare global {
    interface Window {
        $electron: IElectron
    }
}
