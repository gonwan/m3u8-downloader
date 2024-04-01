import { Buffer } from 'node:buffer';
import fs from 'node:fs';
import path from "node:path";
import url from 'node:url';
import log from 'electron-log/main';
// @ts-ignore
import { Parser } from 'm3u8-parser';
import { SegInfo, DownloadProgress, DownloadOptions, DownloadManager } from './download';
import { binaryConcat, ffmpegConcat, ffmpegConvertToMpegTs } from "./ffmpeg";

let downloadProcess: DownloadProgress;

const parseSegments = async(inputUrl: string, ofile: string, downloadManager: DownloadManager, isVideo: boolean) => {
    let m3u8Buff = await downloadManager.downloadFile(inputUrl);
    await fs.promises.writeFile(path.join(ofile, `${isVideo ? 'video' : 'audio'}.m3u8`), m3u8Buff);
    let parser = new Parser();
    parser.push(m3u8Buff);
    parser.end();
    //log.verbose(isVideo ? 'Got video:' : 'Got audio:');
    //log.verbose(parser.manifest);
    if (!parser.manifest.segments) {
        log.error('No segment found');
    } else {
        let part = (parser.manifest.discontinuityStarts && parser.manifest.discontinuityStarts.length > 0) ? -1 : 0;
        let partMap = new Map<number, SegInfo[]>();
        let keyMap = new Map<string, Buffer>();
        let hasXMap = false;
        if (part == 0) {
            partMap.set(part, []);
        }
        for (let i = 0; i < parser.manifest.segments.length; i++) {
            let seg = parser.manifest.segments[i];
            if (seg.discontinuity) {
                part++;
                partMap.set(part, []);
            }
            let dlUrl = url.resolve(inputUrl, seg.uri);
            log.verbose(`Got seg${i}: ${dlUrl}`);
            let ptPath = path.join(ofile, isVideo ? 'video' : 'audio', `part${part}`);
            if (!fs.existsSync(ptPath)) {
                await fs.promises.mkdir(ptPath, { recursive: true });
            }
            if (seg.key) { /* EXT-X-KEY */
                let keyUrl = url.resolve(inputUrl, seg.key.uri);
                let key = keyMap.get(keyUrl);
                if (!key) {
                    key = await downloadManager.downloadFile(keyUrl);
                    keyMap.set(keyUrl, key);
                    log.info(`Got key from: ${keyUrl}`);
                    log.info(`Got key=${key}, iv=${seg.key.iv} method=${seg.key.method}`);
                }
                partMap.get(part)?.push({
                    idx: i,
                    dlUrl: dlUrl,
                    ptPath: ptPath,
                    length: seg.byterange?.length,
                    offset: seg.byterange?.offset,
                    key: key,
                    keyIV: seg.key.iv,
                    keyMethod: seg.key.method
                });
            } else {
                partMap.get(part)?.push({idx: i, dlUrl: dlUrl, ptPath: ptPath,
                    length: seg.byterange?.length, offset: seg.byterange?.offset });
            }
            if (seg.map && seg.map.uri) { /* EXT-MAP-KEY */
                if (!hasXMap) {
                    let xMapUrl = url.resolve(inputUrl, seg.map.uri);
                    let xMapBuff = await downloadManager.downloadFile(xMapUrl, seg.map.byterange?.length, seg.map.byterange?.offset);
                    await fs.promises.writeFile(path.join(ofile, isVideo ? 'video' : 'audio', 'init.mp4'), xMapBuff);
                    log.info(`Got map file from: ${xMapUrl}`);
                    hasXMap = true;
                }
            }
        }
        return partMap;
    }
}

/**
 * Download file from an m3u8 url
 * @param inputUrl
 * @param outputFile
 * @param downloadOptions
 */
const downloadM3u8 = async (inputUrl: string, outputFile: string, downloadOptions: DownloadOptions) => {

    //normal,feifei
    //let inputUrl = 'https://svipsvip.ffzy-online5.com/20240323/25193_10b4631c/index.m3u8';
    //proxy
    //let inputUrl = 'https://top.letvlist.com/202403/16/WCsDk21n5w3/video/index.m3u8';
    //aes,iv,niuniu
    //let inputUrl = 'https://64.32.20.246/play/QeZBnDge/index.m3u8';
    //x-map
    //let inputUrl = 'https://europe.olemovienews.com/hlstimeofffmp4/20210226/fICqcpqr/mp4/fICqcpqr.mp4/master.m3u8';

    log.info(`Downloading: inputUrl=${inputUrl} outputFile=${outputFile} options=${JSON.stringify(downloadOptions)}`);
    downloadProcess = {
        isStop: false,
        totalSegs: 0,
        transferredSegs: 0,
        totalBytes: 0,
        transferredBytes: 0,
        speed: 0
    };

    let dot = outputFile.lastIndexOf('.');
    let ofile = (dot == -1) ? outputFile : outputFile.slice(0, dot);
    if (!fs.existsSync(ofile)) {
        await fs.promises.mkdir(ofile, { recursive: true });
    }
    let parser;
    let downloadManager = new DownloadManager(downloadOptions);
    let m3u8Buff = await downloadManager.downloadFile(inputUrl);
    parser = new Parser();
    parser.push(m3u8Buff);
    parser.end();
    //log.verbose('Got playlist:');
    //log.verbose(parser.manifest);
    /* playlist */
    let videoUrl = '';
    let audioUrl = '';
    if (parser.manifest.playlists) {
        await fs.promises.writeFile(path.join(ofile, 'playlist.m3u8'), m3u8Buff);
        let matchedVideoUri = '';
        let matchedVideoRes = '';
        let maxVideoWidth = 0;
        let matchedAudio = '';
        /* select highest resolution */
        for (let pl of parser.manifest.playlists) {
            let w = pl.attributes?.RESOLUTION?.width || 0;
            if (w > maxVideoWidth) {
                let h = pl.attributes?.RESOLUTION?.height || 0;
                maxVideoWidth = w;
                matchedVideoUri = pl.uri || '';
                matchedVideoRes = `${w}x${h}`;
                matchedAudio = pl.attributes?.AUDIO || '';
            }
        }
        if (matchedVideoUri === '') {
            log.error('No playlist found');
        } else {
            videoUrl = url.resolve(inputUrl, matchedVideoUri);
            log.info(`Selecting video resolution ${matchedVideoRes}: ${videoUrl}`);
            let matchedAudioUri = '';
            let matchedAudioLang = '';
            if (matchedAudio !== '' && parser.manifest.mediaGroups) {
                let langs = parser.manifest.mediaGroups.AUDIO[matchedAudio];
                if (langs) {
                    for (const [k, v] of Object.entries<any>(langs)) {
                        if (matchedAudioLang === '') {
                            matchedAudioLang = v.language;
                            matchedAudioUri = v.uri || '';
                        } else if (v.language === 'en') {
                            matchedAudioLang = v.language;
                            matchedAudioUri = v.uri || '';
                        }
                    }
                }
            }
            if (matchedAudioUri !== '') {
                audioUrl = url.resolve(inputUrl, matchedAudioUri);
                log.info(`Selecting audio language ${matchedAudioLang}: ${audioUrl}`);
            }
        }
    }
    /* download video & audio segments */
    let segs: SegInfo[] = [];
    let videoPartMap;
    if (videoUrl) {
        videoPartMap = await parseSegments(videoUrl, ofile, downloadManager, true);
        if (videoPartMap) {
            let c = 0;
            for (let [_, v] of videoPartMap) {
                for (let seg of v) {
                    segs.push(seg);
                    c++;
                }
            }
            log.info(`Found ${c} video segments in ${videoPartMap.size} parts`);
        }
    }
    let audioPartMap;
    if (audioUrl) {
        audioPartMap = await parseSegments(audioUrl, ofile, downloadManager, false);
        if (audioPartMap) {
            let c = 0;
            for (let [_, v] of audioPartMap) {
                for (let seg of v) {
                    segs.push(seg);
                    c++;
                }
            }
            log.info(`Found ${c} audio segments in ${audioPartMap.size} parts`);
        }
    }
    await downloadManager.downloadSegments(segs, downloadProcess);
    /* now merge parts */
    if (!downloadProcess.isStop) {
        let videoPartFiles = [];
        let audioPartFiles = [];
        if (videoPartMap) {
            let hasXMap = fs.existsSync(path.join(ofile, 'video', 'init.mp4'));
            for (let [k, v] of videoPartMap) {
                if (v && v.length > 0) {
                    let ptPath = v[0].ptPath;
                    let tsFiles = hasXMap ? [path.join('..', 'init.mp4')] : [];
                    v.forEach((seg) => tsFiles.push(`${seg.idx}.ts`));
                    //await binaryConcat(tsFiles, ptPath, ptPath);
                    await ffmpegConcat(tsFiles, null, ptPath, ptPath, 'mpegts');
                    videoPartFiles.push(path.join('video', `part${k}.ts`));
                }
            }
        }
        if (audioPartMap) {
            let hasXMap = fs.existsSync(path.join(ofile, 'audio', 'init.mp4'));
            for (let [k, v] of audioPartMap) {
                if (v && v.length > 0) {
                    let ptPath = v[0].ptPath;
                    let tsFiles = hasXMap ? [path.join('..', 'init.mp4')] : [];
                    v.forEach((seg) => tsFiles.push(`${seg.idx}.ts`));
                    //await binaryConcat(tsFiles, ptPath, ptPath);
                    await ffmpegConcat(tsFiles, null, ptPath, ptPath, 'aac');
                    audioPartFiles.push(path.join('audio', `part${k}.aac`));
                }
            }
        }
        await ffmpegConcat(videoPartFiles, audioPartFiles, ofile, ofile, 'mp4');
    }
    /* clean up */
    if (!downloadOptions.preserveFiles) {
        await fs.promises.rm(ofile, { force: true, recursive: true });
    }
}

const stopDownloadM3u8 = () => {
    log.info('Stopping download');
    downloadProcess.isStop = true;
}

const getDownloadProgress = () => {
    return downloadProcess;
}

export { downloadM3u8, stopDownloadM3u8, getDownloadProgress };
