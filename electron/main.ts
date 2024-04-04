import { app, dialog, globalShortcut, ipcMain, BrowserWindow } from 'electron'
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import log from 'electron-log/main';
import { ffmpegInit } from '../src/lib/ffmpeg';
import { m3u8CheckPlaylist, m3u8Download, m3u8GetDownloadProgress, m3u8StopDownload, m3u8ConcatStreams } from '../src/lib/m3u8downloader';
import { DownloadOptions } from '../src/lib/download';
import { openLogFolder } from '../src/lib/utils'

log.transports.console.level = 'verbose';
log.transports.file.level = 'verbose';
log.initialize();
Object.assign(console, log.functions);

/*
 * Vite does not transform __filename/dirname in dependencies, only in config file(vite.config.ts).
 * On the other hand, Webpack does this: https://github.com/webpack/webpack/issues/14072
 * So do not use them in global call before they are assigned.
 */
globalThis.__filename = fileURLToPath(import.meta.url);
globalThis.__dirname = path.dirname(__filename);
ffmpegInit();

/*
 * https://github.com/electron/electron/blob/c57ce31e84120efc74125fd084931092c9a4d228/lib/browser/init.ts#L21
 * process.on('uncaughtException', function (error) {
 *   'A JavaScript error occurred in the main process'
 * }
 */
process.on("uncaughtException", (err) => {
    const stack = err.stack ? err.stack : `${err.name}: ${err.message}`;
    const message = 'Uncaught Exception:\n' + stack;
    dialog.showErrorBox('Error in the main process', message);
    app.exit(-1);
});

process.on("unhandledRejection", (err) => {
    let stack = err;
    if (err instanceof Error) {
        stack = err.stack ? err.stack : `${err.name}: ${err.message}`;
    }
    const message = 'Uncaught Exception:\n' + stack;
    dialog.showErrorBox('Error in the main process', message);
    app.exit(-1);
});

const _showSaveDialog = async (event: Electron.IpcMainInvokeEvent, extension: string)=> {
    let win = BrowserWindow.fromWebContents(event.sender)!;
    return dialog.showSaveDialog(win,{
        filters: [{ name: extension, extensions: [ extension ] }],
        properties: ['createDirectory', 'showOverwriteConfirmation']
    });
}

const _m3u8CheckPlaylist = async (event: Electron.IpcMainInvokeEvent, inputUrl: string, outputFile: string, downloadOptions: DownloadOptions)=> {
    try {
        return m3u8CheckPlaylist(inputUrl, outputFile, downloadOptions);
    } catch (err) {
        /* handle error by ourself */
        return err;
    }
}

const _m3u8Download = async (event: Electron.IpcMainInvokeEvent, inputUrl: string, outputFile: string, downloadOptions: DownloadOptions, isVideo: boolean)=> {
    try {
        return m3u8Download(inputUrl, outputFile, downloadOptions, isVideo);
    } catch (err) {
        return err;
    }
}

const _m3u8StopDownload = async (event: Electron.IpcMainInvokeEvent) => {
    return m3u8StopDownload();
}

const _m3u8GetDownloadProgress = async (event: Electron.IpcMainInvokeEvent) => {
    return m3u8GetDownloadProgress();
}

const _m3u8ConcatStreams = async (event: Electron.IpcMainInvokeEvent, videoPartFiles: string[], audioPartFiles: string[], outputFile: string, downloadOptions: DownloadOptions, videoCodecs: string) => {
    try {
        await m3u8ConcatStreams(videoPartFiles, audioPartFiles, outputFile, downloadOptions, videoCodecs);
    } catch (err) {
        return err;
    }
}

const _openLogFolder = async (event: Electron.IpcMainInvokeEvent) => {
    return openLogFolder();
}

const createWindow = () => {
    const win = new BrowserWindow({
        title: 'Main window',
        width: 960,
        height: 600,
        show: false,
        resizable: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.mjs')
        }
    });
    win.once('ready-to-show', () => {
        win.show();
    });
    win.removeMenu();
    globalShortcut.register('Shift+CommandOrControl+I', () => {
        win.webContents.openDevTools();
    });
    if (process.env.VITE_DEV_SERVER_URL) { /* HMR support */
        win.loadURL(process.env.VITE_DEV_SERVER_URL);
    } else {
        win.loadFile('dist/index.html');
    }
}

app.whenReady().then(() => {
    /*
     * ipc errors are reported using console.error(), not throwing: `Error occurred in handler for '${channel}':`
     * see: https://github.com/electron/electron/blob/c57ce31e84120efc74125fd084931092c9a4d228/lib/browser/api/web-contents.ts#L566
     *   console.error(`Error occurred in handler for '${channel}':`, error);
     * in order to catch this, override console.error() using electron-log.
     */
    ipcMain.handle('showSaveDialog', _showSaveDialog);
    ipcMain.handle('m3u8CheckPlaylist', _m3u8CheckPlaylist);
    ipcMain.handle('m3u8Download', _m3u8Download);
    ipcMain.handle('m3u8StopDownload', _m3u8StopDownload);
    ipcMain.handle('m3u8GetDownloadProgress', _m3u8GetDownloadProgress);
    ipcMain.handle('m3u8ConcatStreams', _m3u8ConcatStreams);
    ipcMain.handle('openLogFolder', _openLogFolder);
    createWindow();
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
