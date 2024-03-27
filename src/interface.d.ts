import { DownloadOptions } from "./lib/download";

export interface IElectron {
    showSaveDialog: (extension: string) => Promise<Electron.SaveDialogReturnValue>,
    downloadM3u8: (inputUrl: string, outputFile: string, downloadOptions: DownloadOptions) => Promise<void>
}

declare global {
    interface Window {
        $electron: IElectron
    }
}
