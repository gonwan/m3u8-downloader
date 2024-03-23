import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import ffmpeg from 'fluent-ffmpeg';

/* copied and modified from ffmpeg-installer */
const ffmpegInit = () => {
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
        packageJson = JSON.parse(fs.readFileSync(npmPackage, 'utf-8'));//;require(npm3Package);
    } else if (fs.existsSync(npm2Binary)) {
        ffmpegPath = npm2Binary;
        packageJson = JSON.parse(fs.readFileSync(npm2Package, 'utf-8'));//require(npm2Package);
    } else {
        throw 'Could not find ffmpeg executable, tried "' + npmBinary + '", "' + npm2Binary + '" and "' + npm2Binary + '"';
    }
    return {
        path: ffmpegPath,
        version: packageJson.ffmpeg || packageJson.version,
        url: packageJson.homepage
    }
}

//ffmpeg.setFfmpegPath('C:\\Users\\gonwan\\Downloads\\N_m3u8DL-CLI_v3.0.2_with_ffmpeg_and_SimpleG\\ffmpeg.exe')
let ff = ffmpegInit();
ffmpeg.setFfmpegPath(ff.path);
console.log('version: ' + ff.version + ', path: ' + ff.path);

const binaryConcat = async (files: string[], outputFile: string, baseDir: string) => {
    console.log('files: ' + files + ', outputFile: ' + outputFile + ', baseDir: ' + baseDir)
    let cwd = process.cwd();
    process.chdir(baseDir);
    let ofile;
    try {
        ofile = await fs.promises.open(`${outputFile}.ts`, 'w+');
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

export { binaryConcat, ffmpegConcat, ffmpegConvertToMpegTs };
