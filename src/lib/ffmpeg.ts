import fs from 'node:fs';
import process from 'node:process';
import ffi from '@ffmpeg-installer/ffmpeg';
import ffmpeg from 'fluent-ffmpeg';

//ffmpeg.setFfmpegPath('C:\\Users\\gonwan\\Downloads\\N_m3u8DL-CLI_v3.0.2_with_ffmpeg_and_SimpleG\\ffmpeg.exe')
ffmpeg.setFfmpegPath(ffi.path)
console.log("version: " + ffi.version)

const binaryConcat = async (files: string[], outputFile: string, baseDir: string) => {
    console.log('files: ' + files + ', outputFile: ' + outputFile)
    let cwd = process.cwd();
    process.chdir(baseDir);
    let ofile;
    try {
        ofile = await fs.promises.open(outputFile, 'w+');
        for (let f of files) {
            await ofile.appendFile(await fs.promises.readFile(f));
        }
    } catch (err) {
        console.log('error: ' + err);
    } finally {
        await ofile?.close();
        process.chdir(cwd);
    }
}

/*
 * see: https://trac.ffmpeg.org/wiki/Concatenate
 * see: https://www.ffmpeg.org/ffmpeg.html#Stream-selection
 */
const ffmpegConcat = async (files: string[], outputFile: string, baseDir: string, format: string) => {
    //console.log('files: ' + files + ', outputFile: ' + outputFile)
    return new Promise((resolve, reject) => {
        let protocol = 'concat:' + files.join('|');
        let ff = ffmpeg(
            {
                logger: console,
                cwd: baseDir
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
                console.log(cmdline);
            })
            .on('end', () => {
                console.log('merging finished!');
                resolve(null);
            })
            .on('error', (err) => {
                console.log('error: ' + err);
                reject();
            })
            .run();
    });
}

const ffmpegConcat2 = (file: string) => {
    //let cwd = process.cwd();
    let ff = ffmpeg({
        logger: console,
        cwd: ''
    });
    ff
        .input(file)
        .addOptions([
            '-map 0',
            '-c copy',
            '-copy_unknown',
            '-f mpegts',
        ])
        .on('start', (cmdline) => console.log(cmdline))
        .output(file + '.mpeg')
        .run();
}

export { binaryConcat, ffmpegConcat };
