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
    for (let i = 0; i < 2; i++) {
        let m3u8Buff = await downloadManager.downloadFile(inputUrl);
        parser = new Parser();
        parser.push(m3u8Buff);
        parser.end();
        //log.verbose('Got manifest:');
        //log.verbose(parser.manifest);
        if (parser.manifest.playlists) {
            await fs.promises.writeFile(path.join(ofile, 'master.m3u8'), m3u8Buff);
            let matchedUri = '';
            let matchedRes = '';
            let maxWidth = 0;
            /* the master one, select highest resolution */
            for (let pl of parser.manifest.playlists) {
                let w = pl.attributes?.RESOLUTION?.width || 0;
                if (w > maxWidth) {
                    let h = pl.attributes?.RESOLUTION?.height || 0;
                    maxWidth = w;
                    matchedUri = pl.uri;
                    matchedRes = `${w}x${h}`;
                }
            }
            /* reconstruct input */
            if (matchedUri === '') {
                log.error('No playlist found');
                break;
            } else {
                inputUrl = url.resolve(inputUrl, matchedUri);
                log.info(`Selecting resolution ${matchedRes}: ${inputUrl}`);
            }
        } else {
            await fs.promises.writeFile(path.join(ofile, 'index.m3u8'), m3u8Buff);
            break;
        }
    }
    /* work with segments */
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
            let ptPath = path.join(ofile, `part${part}`);
            if (!fs.existsSync(ptPath)) {
                await fs.promises.mkdir(ptPath);
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
                partMap.get(part)?.push({ idx: i, dlUrl: dlUrl, ptPath: ptPath, key: key, keyIV: seg.key.iv, keyMethod: seg.key.method });
            } else {
                partMap.get(part)?.push({ idx: i, dlUrl: dlUrl, ptPath: ptPath });
            }
            if (seg.map && seg.map.uri) { /* EXT-MAP-KEY */
                if (!hasXMap) {
                    let xMapUrl = url.resolve(inputUrl, seg.map.uri);
                    let xMapBuff = await downloadManager.downloadFile(xMapUrl);
                    fs.promises.writeFile(path.join(ofile, 'init.mp4'), xMapBuff);
                    log.info(`Got map file from: ${xMapUrl}`);
                    hasXMap = true;
                }
            }
        }
        let segs: SegInfo[] = [];
        for (let [_, v] of partMap) {
            for (let seg of v) {
                segs.push(seg);
            }
        }
        log.info(`Found ${segs.length} segments in ${part+1} parts`);
        await downloadManager.downloadSegments(segs, downloadProcess);
        if (!downloadProcess.isStop) {
            /* now merge parts */
            for (let [_, v] of partMap) {
                if (v && v.length > 0) {
                    let ptPath = v[0].ptPath;
                    let tsFiles = hasXMap ? [path.join('..', 'init.mp4')] : [];
                    v.forEach((seg) => tsFiles.push(`${seg.idx}.ts`));
                    await ffmpegConcat(tsFiles, ptPath, ptPath, 'mpegts');
                }
            }
            /* now merge all */
            let partFiles = [];
            for (let [k, v] of partMap) {
                if (v && v.length > 0) {
                    partFiles.push(`part${k}.ts`)
                }
            }
            await ffmpegConcat(partFiles, ofile, ofile, 'mp4');
        }
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
