import { shell } from 'electron';
import log from 'electron-log/main';

const openLogFolder = () => {
    let filePath = log.transports.file.getFile().path;
    shell.showItemInFolder(filePath);
}

export { openLogFolder };
