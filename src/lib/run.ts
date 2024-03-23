import { Buffer } from 'node:buffer';
import fs from 'node:fs';
import path from "node:path";
import { Parser } from 'm3u8-parser';
import { DownloadOptions, DownloadManager } from './downloader.ts';
import { binaryConcat, ffmpegConcat, ffmpegConvertToMpegTs } from "./ffmpeg.ts";

type SegInfo = {
    idx: number;
    dlUrl: string;
    ptPath: string;
}

async function test2(aurl: string, dldir: string) {

    let outputFile = "C:\\Users\\gonwan\\Downloads\\ttt.mp4";
    //normal
    let baseUrl = "https://svipsvip.ffzy-online5.com/20240316/24963_edf36ed5";
    let inputUrl = "https://svipsvip.ffzy-online5.com/20240316/24963_edf36ed5/index.m3u8";
    //proxy
    //let baseUrl = "https://top.letvlist.com/202403/16/WCsDk21n5w3/video";
    //let inputUrl = "https://top.letvlist.com/202403/16/WCsDk21n5w3/video/index.m3u8";
    //aes,iv
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
            baseUrl = inputUrl.slice(0, idx+1);
            m3u8Buff = await downloadManager.downloadM3u8File(inputUrl);
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
                inputUrl = matchedUri;
                if (!matchedUri.startsWith('http') && !matchedUri.startsWith('https')) {
                    inputUrl = `${baseUrl}/${matchedUri}`.replace('\/\/', '\/');
                }
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
                if (part == 0) {
                    partMap.set(part, []);
                }
                for (let i = 0; i < parser.manifest.segments.length; i++) {
                    let sg = parser.manifest.segments[i];
                    if (sg.discontinuity) {
                        part++;
                        partMap.set(part, []);
                    }
                    let dlUrl = sg.uri;
                    if (!sg.uri.startsWith('http') && !sg.uri.startsWith('https')) {
                        dlUrl = `${baseUrl}/${sg.uri}`.replace('\/\/', '\/');
                    }
                    console.log('downloading: ' + dlUrl);
                    let ptPath = path.join(ofile, `part${part}`);
                    if (!fs.existsSync(ptPath)) {
                        fs.mkdirSync(ptPath);
                    }
                    partMap.get(part)?.push({ idx: i, dlUrl: dlUrl, ptPath: ptPath });
                }
                let indexes: number[] = [];
                let dlUrls: string[] = [];
                let ptPaths: string[] = [];
                for (let [k, v] of partMap) {
                    for (let seg of v) {
                        indexes.push(seg.idx);
                        dlUrls.push(seg.dlUrl);
                        ptPaths.push(seg.ptPath);
                    }
                }
                await downloadManager.downloadSegments(dlUrls, ptPaths, indexes);
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
