import { app, dialog, globalShortcut, ipcMain, BrowserWindow } from 'electron'
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { downloadM3u8 } from "../src/lib/m3u8downloader";
import { DownloadOptions } from "../src/lib/download";

// https://iamwebwiz.medium.com/how-to-fix-dirname-is-not-defined-in-es-module-scope-34d94a86694d
const __filename = fileURLToPath(import.meta.url); // get the resolved path to the file
const __dirname = path.dirname(__filename); // get the name of the directory
let win: BrowserWindow;

const _showSaveDialog = async (event, extension: string)=> {
    return dialog.showSaveDialog(win,{
        filters: [ { name: extension, extensions: [ extension ] }],
        properties: ['createDirectory', 'showOverwriteConfirmation']
    });
};

const _downloadM3u8 = async (event, inputUrl: string, outputFile: string, downloadOptions: DownloadOptions)=> {
    console.log('ua: ' + downloadOptions.headers.get('User-Agent'));
    await downloadM3u8(inputUrl, outputFile, downloadOptions);
};

app.whenReady().then(() => {
    ipcMain.handle('showSaveDialog', _showSaveDialog);
    ipcMain.handle('downloadM3u8', _downloadM3u8);
    win = new BrowserWindow({
        title: 'Main window',
        width: 960,
        height: 600,
        resizable: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.mjs')
        }
    })
    globalShortcut.register('Shift+CommandOrControl+I', () => {
        win.webContents.openDevTools();
    })
    win.removeMenu();
    if (process.env.VITE_DEV_SERVER_URL) {
        win.loadURL(process.env.VITE_DEV_SERVER_URL);
    } else {
        win.loadFile('dist/index.html');
    }
});
