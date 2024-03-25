import { Buffer } from 'node:buffer';
import fs from 'node:fs';
import path from "node:path";
import url from 'node:url';
import { Parser } from 'm3u8-parser';
import { SegInfo, DownloadOptions, DownloadManager } from './downloader';
import { binaryConcat, ffmpegConcat, ffmpegConvertToMpegTs } from "./ffmpeg";

async function test2(aurl: string, dldir: string) {

    let outputFile = "C:\\Users\\gonwan\\Downloads\\ttt.mp4";
    //normal,feifei
    //let baseUrl = "https://svipsvip.ffzy-online5.com/20240323/25193_10b4631c";
    //let inputUrl = "https://svipsvip.ffzy-online5.com/20240323/25193_10b4631c/index.m3u8";
    //proxy
    //let baseUrl = "https://top.letvlist.com/202403/16/WCsDk21n5w3/video";
    //let inputUrl = "https://top.letvlist.com/202403/16/WCsDk21n5w3/video/index.m3u8";
    //aes,iv,niuniu
    let baseUrl = "https://64.32.20.246/play/QeZBnDge";
    let inputUrl = "https://64.32.20.246/play/QeZBnDge/index.m3u8";

    let expectedRes = 1080;

    let downloadOptions: DownloadOptions = {
        //headers: 'User-Agent: java',
        //proxy: 'http://127.0.0.1:10809',
        concurrency: 10,
    };

    if (aurl) {
        inputUrl = aurl;
    }
    if (dldir) {
        outputFile = path.join(dldir, 'ttt.mp4');
    }

    let downloadManager = new DownloadManager(downloadOptions);
    for (let i = 0; i < 2; i++) {
        let m3u8Buff: Buffer;
        if (inputUrl.startsWith('file://')) {
            m3u8Buff = await fs.promises.readFile(inputUrl);
        } else {
            let idx = inputUrl.lastIndexOf('/')
            baseUrl = inputUrl.slice(0, idx);
            m3u8Buff = await downloadManager.downloadFile(inputUrl);
        }
        let parser = new Parser();
        parser.push(m3u8Buff);
        parser.end();
        console.log(parser.manifest);
        let dot = outputFile.lastIndexOf('.');
        let ofile = (dot == -1) ? outputFile : outputFile.slice(0, dot);
        if (!fs.existsSync(ofile)) {
            fs.mkdirSync(ofile, { recursive: true });
        }
        if (parser.manifest.playlists) {
            let matchedUri = '';
            let matchedRes = 0;
            /* the master one, select most matched resolution */
            for (let pl of parser.manifest.playlists) {
                // add debug log
                let w = pl.attributes?.RESOLUTION?.width || 0;
                if (w == expectedRes) {
                    matchedRes = w;
                    matchedUri = pl.uri;
                    break;
                } else if (w > matchedRes) {
                    matchedRes = w;
                    matchedUri = pl.uri;
                }
            }
            /* reconstruct input */
            if (matchedUri == '') {
                console.log('error no res...');
            } else {
                inputUrl = url.resolve(inputUrl, matchedUri);
                console.log('selecting: ' + inputUrl);
            }
            await fs.promises.writeFile(path.join(ofile, 'master.m3u8'), m3u8Buff);
        } else {
            await fs.promises.writeFile(path.join(ofile, 'index.m3u8'), m3u8Buff);
            parser = new Parser();
            parser.push(m3u8Buff);
            parser.end();
            console.log(parser.manifest);
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
                    console.log('downloading: ' + dlUrl);
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
                        }
                        partMap.get(part)?.push({ idx: i, dlUrl: dlUrl, ptPath: ptPath, key: key, keyIV: seg.key.iv, keyMethod: seg.key.method });
                    } else {
                        partMap.get(part)?.push({ idx: i, dlUrl: dlUrl, ptPath: ptPath });
                    }
                }
                let segs: SegInfo[] = [];
                for (let [k, v] of partMap) {
                    for (let seg of v) {
                        segs.push(seg);
                    }
                }
                await downloadManager.downloadSegments(segs);
                /* now merge parts */
                for (let [k, v] of partMap) {
                    if (v && v.length > 0) {
                        let ptPath = v[0].ptPath;
                        let tsFiles = v.map(seg => `${seg.idx}.ts`);
                        console.log('concat: ' + ptPath);
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

export { test2 };
