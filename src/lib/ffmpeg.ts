import { createRequire } from 'node:module';
import ffmpeg from 'fluent-ffmpeg';
import log from 'electron-log/main';

const require = createRequire(import.meta.url);

const ffmpegInit = (ffPath?: string) => {
    try {
        let ffmpegPath: string;
        if (ffPath) {
            ffmpegPath = ffPath;
        } else {
            /* require works, import does not. */
            ffmpegPath = require('@ffmpeg-installer/ffmpeg').path.replace('app.asar', 'app.asar.unpacked');
            //const ffmpegPath = require('ffmpeg-static').replace('app.asar', 'app.asar.unpacked');
        }
        ffmpeg.setFfmpegPath(ffmpegPath);
        log.info(`Using ffmpeg: ${ffmpegPath}`);
    } catch (err) {
        log.error('Failed to find ffmpeg', err);
        throw err;
    }
}

/**
 * Concat segments of media files.
 * @see https://trac.ffmpeg.org/wiki/Concatenate
 * @see https://www.ffmpeg.org/ffmpeg.html#Stream-selection
 * @param files input files to concat
 * @param files2 another set of input files to concat
 * @param outputFile output file without extension
 * @param workingDir working directory
 * @param codec video/audio codec
 */
const ffmpegConcat = async (files: string[], files2: string[], outputFile: string, workingDir: string, codec: string) => {
    return new Promise<string[][]>((resolve, reject) => {
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
        switch (codec) {
            case 'h264':
                ff = ff.addOptions([
                        '-map 0:v?',
                        hasAudio ? '-map 1:a?' : '-map 0:a?',
                        '-map 0:s?',
                        '-c copy',
                        //'-bsf:a aac_adtstoasc',
                        '-bsf:v h264_mp4toannexb'
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
                        '-bsf:v hevc_mp4toannexb'
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
        let videoDetails: string[] = [];
        let audioDetails: string[] = [];
        ff
            .on('start', (cmdline) => {
                log.verbose(`Running ffmepg concat in ${codec} codec: ${cmdline}`);
            })
            .on('end', () => {
                log.info('Ffmpeg concat finished!');
                resolve([ videoDetails, audioDetails ]);
            })
            .on('error', (err) => {
                log.error('Ffmpeg concat failed!');
                reject(err);
            })
            .on('codecData', (data) => {
                videoDetails = data.video_details ?? [];
                audioDetails = data.audio_details ?? [];
            })
            .on('stderr', (stderrLine) => {
                //log.error(`Ffmpeg stderr: ${stderrLine}`);
            })
            .run();
    });
}

/**
 * Convert a file to mpegts format inline.
 * @param file file to convert
 */
const ffmpegConvertToMpegTs = async (file: string) => {
    return new Promise<void>((resolve, reject) => {
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
            .on('stderr', (stderrLine) => {
                //log.error(`Ffmpeg stderr: ${stderrLine}`);
            })
            .run();
    });
}

export { ffmpegInit, ffmpegConcat, ffmpegConvertToMpegTs };
