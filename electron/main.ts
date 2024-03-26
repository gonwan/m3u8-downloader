import { app, dialog, globalShortcut, ipcMain, BrowserWindow } from 'electron'
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { downloadM3u8 } from "../src/lib/m3u8downloader";
import { DownloadOptions } from "../src/lib/download";

globalThis.__filename = fileURLToPath(import.meta.url);
globalThis.__dirname = path.dirname(__filename);

const _showSaveDialog = async (event, extension: string)=> {
    let win = BrowserWindow.fromWebContents(event.sender);
    return dialog.showSaveDialog(win,{
        filters: [ { name: extension, extensions: [ extension ] }],
        properties: ['createDirectory', 'showOverwriteConfirmation']
    });
};

const _downloadM3u8 = async (event, inputUrl: string, outputFile: string, downloadOptions: DownloadOptions)=> {
    await downloadM3u8(inputUrl, outputFile, downloadOptions);
};

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
    if (process.env.VITE_DEV_SERVER_URL) {
        win.loadURL(process.env.VITE_DEV_SERVER_URL);
    } else {
        win.loadFile('dist/index.html');
    }
}

app.whenReady().then(() => {
    ipcMain.handle('showSaveDialog', _showSaveDialog);
    ipcMain.handle('downloadM3u8', _downloadM3u8);
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
