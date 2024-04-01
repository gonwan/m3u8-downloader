import { DownloadOptions, DownloadProgress } from "./lib/download";

export interface IElectron {
    showSaveDialog: (extension: string) => Promise<Electron.SaveDialogReturnValue>,
    downloadM3u8: (inputUrl: string, outputFile: string, downloadOptions: DownloadOptions) => Promise<void>,
    stopDownloadM3u8: () => Promise<DownloadProgress>,
    getDownloadProgress: () => Promise<DownloadProgress>,
    openLogFolder: () => Promise<void>
}

declare global {
    interface Window {
        $electron: IElectron
    }
}
