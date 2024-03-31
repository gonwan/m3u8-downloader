import { DownloadOptions, DownloadProgress } from "./lib/download";
import {getDownloadProgress} from "./lib/m3u8downloader.ts";

export interface IElectron {
    showSaveDialog: (extension: string) => Promise<Electron.SaveDialogReturnValue>,
    downloadM3u8: (inputUrl: string, outputFile: string, downloadOptions: DownloadOptions) => Promise<void>,
    getDownloadProgress: () => Promise<DownloadProgress>
}

declare global {
    interface Window {
        $electron: IElectron
    }
}
