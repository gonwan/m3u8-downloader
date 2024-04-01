import { app, dialog, globalShortcut, ipcMain, BrowserWindow } from 'electron'
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import log from 'electron-log/main';
import { ffmpegInit } from '../src/lib/ffmpeg';
import { downloadM3u8, getDownloadProgress, stopDownloadM3u8 } from '../src/lib/m3u8downloader';
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
    if (!(err instanceof Error)) {
        return;
    }
    const stack = err.stack ? err.stack : `${err.name}: ${err.message}`;
    const message = 'Uncaught Exception:\n' + stack;
    dialog.showErrorBox('Error in the main process', message);
    app.exit(-1);
});

const _showSaveDialog = async (event: Electron.IpcMainInvokeEvent, extension: string)=> {
    let win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
        return dialog.showSaveDialog(win,{
            filters: [{ name: extension, extensions: [ extension ] }],
            properties: ['createDirectory', 'showOverwriteConfirmation']
        });
    }
}

const _downloadM3u8 = async (event: Electron.IpcMainInvokeEvent, inputUrl: string, outputFile: string, downloadOptions: DownloadOptions)=> {
    await downloadM3u8(inputUrl, outputFile, downloadOptions);
}

const _stopDownloadM3u8 = async (event: Electron.IpcMainInvokeEvent) => {
    return stopDownloadM3u8();
}

const _getDownloadProgress = async (event: Electron.IpcMainInvokeEvent) => {
    return getDownloadProgress();
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
    ipcMain.handle('downloadM3u8', _downloadM3u8);
    ipcMain.handle('stopDownloadM3u8', _stopDownloadM3u8);
    ipcMain.handle('getDownloadProgress', _getDownloadProgress);
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
