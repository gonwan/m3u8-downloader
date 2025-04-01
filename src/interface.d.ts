import { VideoInfo, DownloadOptions, DownloadProgress } from './lib/download';

export interface IElectron {
    showOpenDialog: (extension: string) => Promise<Electron.OpenDialogReturnValue>,
    showSaveDialog: (extension: string) => Promise<Electron.SaveDialogReturnValue>,
    m3u8CheckPlaylist: (inputUrl: string, outputFile: string, downloadOptions: DownloadOptions) => Promise<Error> | Promise<VideoInfo>,
    m3u8Download: (inputUrl: string, outputFile: string, downloadOptions: DownloadOptions, isVideo: boolean, removeAds: boolean) => Promise<Error> | Promise<string[]>,
    m3u8StopDownload: () => Promise<void>,
    m3u8GetDownloadProgress: () => Promise<DownloadProgress>,
    m3u8ConcatStreams: (videoPartFiles: string[], audioPartFiles: string[], outputFile: string, workingDir: string, downloadOptions: DownloadOptions, videoCodecs: string) => Promise<void> | Promise<Error>,
    checkFileExists: (filePath: string) => Promise<string>,
    openLogFolder: () => Promise<void>
}

declare global {
    interface Window {
        $electron: IElectron
    }
}
