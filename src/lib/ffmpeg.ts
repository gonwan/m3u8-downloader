import fs from 'node:fs';
import process from 'node:process';
import { createRequire } from 'node:module';
import ffmpeg from 'fluent-ffmpeg';
import log from 'electron-log/main';

const require = createRequire(import.meta.url);

const ffmpegInit = () => {
    //ffmpeg.setFfmpegPath('C:\\Users\\gonwan\\Downloads\\N_m3u8DL-CLI_v3.0.2_with_ffmpeg_and_SimpleG\\ffmpeg.exe')
    try {
        /* require works, import does not. */
        //const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path.replace('app.asar', 'app.asar.unpacked');
        const ffmpegPath = require('ffmpeg-static').replace('app.asar', 'app.asar.unpacked');
        ffmpeg.setFfmpegPath(ffmpegPath);
        log.info(`Using ffmpeg: ${ffmpegPath}`);
    } catch (err) {
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
        log.error('Binary concat failed!');
        throw err;
    } finally {
        await ofile?.close();
        process.chdir(cwd);
    }
}

/**
 * Concat segments of media files.
 * @see https://trac.ffmpeg.org/wiki/Concatenate
 * @see https://www.ffmpeg.org/ffmpeg.html#Stream-selection
 * @param files input files to concat
 * @param files2 another set of input files to concat, can be null
 * @param outputFile output file without extension
 * @param workingDir working directory
 * @param format output format
 */
const ffmpegConcat = async (files: string[], files2: string[], outputFile: string, workingDir: string, format: string) => {
    return new Promise((resolve, reject) => {
        let hasAudio = files2 && files2.length > 0;
        let protocol = 'concat:' + files.join('|');
        let ff = ffmpeg(
            {
                logger: console,
                cwd: workingDir
            })
            .input(protocol);
        if (hasAudio) {
            protocol = 'concat:' + files2.join('|');
            ff = ff.input(protocol);
        }
        switch (format) {
            case 'h264':
                ff = ff.addOptions([
                        '-map 0:v?',
                        hasAudio ? '-map 1:a?' : '-map 0:a?',
                        '-map 0:s?',
                        '-c copy',
                        //'-bsf:a aac_adtstoasc',
                        '-bsf:v h264_mp4toannexb11'
                    ])
                    .output(`${outputFile}.mp4`)
                break;
            case 'h265':
                ff = ff.addOptions([
                        '-map 0:v?',
                        hasAudio ? '-map 1:a?' : '-map 0:a?',
                        '-map 0:s?',
                        '-c copy',
                        //'-bsf:a aac_adtstoasc',
                        '-bsf:v hevc_mp4toannexb11'
                    ])
                    .output(`${outputFile}.mp4`)
                break;
            case 'mpegts':
                ff = ff.addOptions([
                        '-map 0',
                        '-c copy',
                        '-copy_unknown',
                        '-f mpegts'
                    ])
                    .output(`${outputFile}.ts`);
                break;
            case 'aac':
                ff = ff.addOptions([
                        '-map 0:a',
                        '-c copy',
                        '-copy_unknown'
                    ])
                    .output(`${outputFile}.aac`);
                break;
            default:
                break;
        }
        ff
            .on('start', (cmdline) => {
                log.verbose(`Running ffmepg concat in ${format} format: ${cmdline}`);
            })
            .on('end', () => {
                log.info('Ffmpeg concat finished!');
                resolve();
            })
            .on('error', (err) => {
                log.error('Ffmpeg concat failed!');
                reject(err);
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
                resolve();
            })
            .on('error', (err) => {
                log.error('Conversion to mpegts failed!');
                reject(err);
            })
            .run();
    });
}

export { binaryConcat, ffmpegInit, ffmpegConcat, ffmpegConvertToMpegTs };
