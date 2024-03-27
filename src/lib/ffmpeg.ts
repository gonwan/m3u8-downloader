import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { createRequire } from 'node:module';
import ffmpeg from 'fluent-ffmpeg';
import log from 'electron-log/main';

const require = createRequire(import.meta.url);

type ffmpegInfo = {
    path: string;
    version: string;
    url: string;
};

/* copied and modified from ffmpeg-installer */
const ffmpegInit = () : ffmpegInfo => {
    let platform = os.platform() + '-' + os.arch();
    let binary = os.platform() === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
    let npmPath = path.resolve('node_modules', '@ffmpeg-installer', platform); /* dev environment */
    let npm2Path = path.resolve('resources', 'app', 'node_modules', '@ffmpeg-installer', platform); /* app environment */
    let npmBinary = path.join(npmPath, binary);
    let npm2Binary = path.join(npm2Path, binary);
    let npmPackage = path.join(npmPath, 'package.json');
    let npm2Package = path.join(npm2Path, 'package.json');
    let ffmpegPath, packageJson;
    if (fs.existsSync(npmBinary)) {
        ffmpegPath = npmBinary;
        packageJson = JSON.parse(fs.readFileSync(npmPackage, 'utf-8'));
    } else if (fs.existsSync(npm2Binary)) {
        ffmpegPath = npm2Binary;
        packageJson = JSON.parse(fs.readFileSync(npm2Package, 'utf-8'));
    } else {
        throw new Error(`Could not find ffmpeg executable, tried \"${npmBinary}\" and \"${npm2Binary}\"`);
    }
    return { path: ffmpegPath, version: packageJson.ffmpeg || packageJson.version, url: packageJson.homepage };
}

//ffmpeg.setFfmpegPath('C:\\Users\\gonwan\\Downloads\\N_m3u8DL-CLI_v3.0.2_with_ffmpeg_and_SimpleG\\ffmpeg.exe')
try {
    //const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path.replace('app.asar', 'app.asar.unpacked');
    const ffmpegPath = require('ffmpeg-static').replace('app.asar', 'app.asar.unpacked');
    ffmpeg.setFfmpegPath(ffmpegPath);
    log.info(`Using ffmpeg: ${ffmpegPath}`);
} catch (err) {
    if (err instanceof Error) {
        log.error('Failed to find ffmpeg', err);
    }
}

/**
 * Concat segments of media files, without ffmpeg
 * @param files files to concat
 * @param outputFile output file without extension
 * @param workingDir working directory
 */
const binaryConcat = async (files: string[], outputFile: string, workingDir: string) => {
    let cwd = process.cwd();
    process.chdir(workingDir);
    log.info(`Running binary concat: files=${files} outputFile=${outputFile}`);
    let ofile;
    try {
        ofile = await fs.promises.open(`${outputFile}.ts`, 'w+');
        for (let f of files) {
            await ofile.appendFile(await fs.promises.readFile(f));
        }
    } catch (err) {
        if (err instanceof Error) {
            log.error(`Binary concat error: ${err.message}`);
        }
    } finally {
        await ofile?.close();
        process.chdir(cwd);
    }
}

/**
 * Concat segments of media files.
 * @see https://trac.ffmpeg.org/wiki/Concatenate
 * @see https://www.ffmpeg.org/ffmpeg.html#Stream-selection
 * @param files files to concat
 * @param outputFile output file without extension
 * @param workingDir working directory
 * @param format output format
 */
const ffmpegConcat = async (files: string[], outputFile: string, workingDir: string, format: string) => {
    return new Promise((resolve, reject) => {
        let protocol = 'concat:' + files.join('|');
        let ff = ffmpeg(
            {
                logger: console,
                cwd: workingDir
            })
            .input(protocol);
        switch (format) {
            case 'mp4':
                ff = ff.addOptions(
                    [
                        '-map \"0:v?\"',
                        '-map \"0:a?\"',
                        '-map \"0:s?\"',
                        '-c copy',
                        '-bsf:a aac_adtstoasc',
                        '-bsf:v h264_mp4toannexb'
                    ])
                    .output(`${outputFile}.mp4`)
                break;
            case 'mpegts':
                ff = ff.addOptions(
                    [
                        '-map 0',
                        '-c copy',
                        '-copy_unknown',
                        '-f mpegts',
                    ])
                    .output(`${outputFile}.ts`);
                break;
            default:
                break;
        }
        ff
            .on('start', (cmdline) => {
                log.verbose(`Running Ffmepg concat in ${format} format: ${cmdline}`);
            })
            .on('end', () => {
                log.info('Ffmpeg concat finished!');
                resolve(null);
            })
            .on('error', (err) => {
                log.error(`Ffmpeg concat error: ${err.message}`);
                reject();
            })
            .run();
    });
}

/**
 * Convert a file to mpegts format inline.
 * @param file file to convert
 */
const ffmpegConvertToMpegTs = async (file: string) => {
    return new Promise((resolve, reject) => {
        let ff = ffmpeg({
            logger: console
        });
        ff
            .input(file + '.ts')
            .addOptions([
                '-map 0',
                '-c copy',
                '-copy_unknown',
                '-f mpegts',
            ])
            .output(file + '.mpeg.ts')
            .on('start', (cmdline) => {
                log.verbose(`Running conversion: ${cmdline}`);
            })
            .on('end', () => {
                log.info('Conversion finished!');
                resolve(null);
            })
            .on('error', (err) => {
                log.error(`Conversion error: ${err.message}`);
                reject();
            })
            .run();
    });
}

export { binaryConcat, ffmpegConcat, ffmpegConvertToMpegTs };
