import { app, BrowserWindow, ipcMain } from 'electron'
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// https://iamwebwiz.medium.com/how-to-fix-dirname-is-not-defined-in-es-module-scope-34d94a86694d
const __filename = fileURLToPath(import.meta.url); // get the resolved path to the file
const __dirname = path.dirname(__filename); // get the name of the directory

async function listFiles(event, dirPath: string) {
    let files = (await fs.promises.readdir(dirPath, { withFileTypes: true }))
        .map((item) => item.name)
    return files;
}

app.whenReady().then(() => {
    ipcMain.handle('listFiles', listFiles)
    const win = new BrowserWindow({
        title: 'Main window',
        webPreferences: {
            preload: path.join(__dirname, 'preload.mjs')
        }
    })
    if (process.env.VITE_DEV_SERVER_URL) {
        win.loadURL(process.env.VITE_DEV_SERVER_URL);
    } else {
        win.loadFile('dist/index.html');
    }
})
