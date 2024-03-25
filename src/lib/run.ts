import { Buffer } from 'node:buffer';
import fs from 'node:fs';
import path from "node:path";
import url from 'node:url';
import log from 'electron-log/main';
// @ts-ignore
import { Parser } from 'm3u8-parser';
import { SegInfo, DownloadOptions, DownloadManager } from './downloader';
import { binaryConcat, ffmpegConcat, ffmpegConvertToMpegTs } from "./ffmpeg";

log.transports.console.level = 'info';
log.transports.console.level = 'verbose';

/**
 * Download file from an m3u8 url
 * @param inputUrl
 * @param outputFile
 * @param downloadOptions
 */
async function downloadM3u8(inputUrl: string, outputFile: string, downloadOptions: DownloadOptions) {

    // let outputFile = "C:\\Users\\gonwan\\Downloads\\ttt.mp4";
    // //normal,feifei
    // //let inputUrl = "https://svipsvip.ffzy-online5.com/20240323/25193_10b4631c/index.m3u8";
    // //proxy
    // //let inputUrl = "https://top.letvlist.com/202403/16/WCsDk21n5w3/video/index.m3u8";
    // //aes,iv,niuniu
    // let inputUrl = "https://64.32.20.246/play/QeZBnDge/index.m3u8";

    let dot = outputFile.lastIndexOf('.');
    let ofile = (dot == -1) ? outputFile : outputFile.slice(0, dot);
    if (!fs.existsSync(ofile)) {
        fs.mkdirSync(ofile, { recursive: true });
    }

    let downloadManager = new DownloadManager(downloadOptions);
    for (let i = 0; i < 2; i++) {
        let m3u8Buff = await downloadManager.downloadFile(inputUrl);
        let parser = new Parser();
        parser.push(m3u8Buff);
        parser.end();
        //log.verbose('Got manifest:');
        //log.verbose(parser.manifest);
        if (parser.manifest.playlists) {
            await fs.promises.writeFile(path.join(ofile, 'master.m3u8'), m3u8Buff);
            let matchedUri = '';
            let matchedRes = 0;
            /* the master one, select highest resolution */
            for (let pl of parser.manifest.playlists) {
                let w = pl.attributes?.RESOLUTION?.width || 0;
                if (w > matchedRes) {
                    matchedRes = w;
                    matchedUri = pl.uri;
                }
            }
            /* reconstruct input */
            if (matchedUri == '') {
                log.error('error no res...');
                //FIXME!!!return; a promise??
            } else {
                inputUrl = url.resolve(inputUrl, matchedUri);
                log.info(`Selecting: ${inputUrl}`);
            }
        } else {
            await fs.promises.writeFile(path.join(ofile, 'index.m3u8'), m3u8Buff);
            if (parser.manifest.segments) {
                let part = (parser.manifest.discontinuityStarts && parser.manifest.discontinuityStarts.length > 0) ? -1 : 0;
                let partMap = new Map<number, SegInfo[]>();
                let keyMap = new Map<string, Buffer>();
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
                    log.verbose(`Downloading seg${i}: ${dlUrl}`);
                    let ptPath = path.join(ofile, `part${part}`);
                    if (!fs.existsSync(ptPath)) {
                        fs.mkdirSync(ptPath);
                    }
                    if (seg.key) {
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
                }
                let segs: SegInfo[] = [];
                for (let [_, v] of partMap) {
                    for (let seg of v) {
                        segs.push(seg);
                    }
                }
                await downloadManager.downloadSegments(segs);
                /* now merge parts */
                for (let [_, v] of partMap) {
                    if (v && v.length > 0) {
                        let ptPath = v[0].ptPath;
                        let tsFiles = v.map(seg => `${seg.idx}.ts`);
                        await ffmpegConcat(tsFiles, ptPath, ptPath, 'mpegts');
                    }
                }
                /* now merge all */
                let partFiles: string[] = [];
                for (let [k, v] of partMap) {
                    if (v && v.length > 0) {
                        partFiles.push(`part${k}.ts`)
                    }
                }
                await ffmpegConcat(partFiles, ofile, ofile, 'mp4');
            }
        }
    }

}

export { downloadM3u8 };
