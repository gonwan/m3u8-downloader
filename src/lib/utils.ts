import fs from 'node:fs';
import { shell } from 'electron';
import log from 'electron-log/main';

const checkFileExists = (filePath: string) => {
    if (!fs.existsSync(filePath)) {
        return filePath;
    }
    let dot = filePath.lastIndexOf('.');
    let fp = (dot == -1) ? filePath : filePath.slice(0, dot);
    let ext = (dot == -1) ? '' : filePath.slice(dot);
    return `${fp}-${Date.now()}${ext}`;
}

const openLogFolder = () => {
    let filePath = log.transports.file.getFile().path;
    shell.showItemInFolder(filePath);
}

export { checkFileExists, openLogFolder };
