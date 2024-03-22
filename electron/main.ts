import {app, BrowserWindow, dialog, ipcMain} from 'electron'
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
//import { test2 } from "../src/lib/run";

// https://iamwebwiz.medium.com/how-to-fix-dirname-is-not-defined-in-es-module-scope-34d94a86694d
const __filename = fileURLToPath(import.meta.url); // get the resolved path to the file
const __dirname = path.dirname(__filename); // get the name of the directory

let win: BrowserWindow;

const selectDirectory = async (event)=> {
    let dir = await dialog.showOpenDialog(win,{ properties: ['createDirectory', 'openDirectory'] });
    return dir;
}

const downloadM3u8 = async (event, aurl: string, dldir: string)=> {
    console.log(`aurl=${aurl} dldir=${dldir}`);
    //test2(aurl, dldir);
}

const listFiles = async (event, dirPath: string)=> {
    let files = (await fs.promises.readdir(dirPath, { withFileTypes: true }))
        .map((item) => item.name)
    return files;
}

app.whenReady().then(() => {
    ipcMain.handle('selectDirectory', selectDirectory);
    ipcMain.handle('downloadM3u8', downloadM3u8);
    ipcMain.handle('listFiles', listFiles);
    win = new BrowserWindow({
        title: 'Main window',
        width: 960,
        height: 600,
        resizable: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.mjs')
        }
    })
    //win.removeMenu();
    if (process.env.VITE_DEV_SERVER_URL) {
        win.loadURL(process.env.VITE_DEV_SERVER_URL);
    } else {
        win.loadFile('dist/index.html');
    }
})
