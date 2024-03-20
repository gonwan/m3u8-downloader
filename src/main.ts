import fs from 'node:fs';
import { Parser } from 'm3u8-parser'
import { DownloadOptions, DownloadManager } from './downloader.ts'
import { binaryConcat, ffmpegConcat } from "./ffmpeg.ts";
import path from "node:path";

const test = () => {
    let manifest = [
        '#EXTM3U',
        '#EXT-X-VERSION:3',
        '#EXT-X-TARGETDURATION:6',
        '#EXT-X-MEDIA-SEQUENCE:0',
        '#VOD-FRAMERATE:29.97',
        '#EXT-X-DISCONTINUITY-SEQUENCE:0',
        '#EXTINF:6,',
        '0.ts',
        '#EXTINF:6,',
        '1.ts',
        '#EXT-X-PROGRAM-DATE-TIME:2019-02-14T02:14:00.106Z',
        '#EXTINF:6,',
        '2.ts',
        '#EXT-X-ENDLIST'
    ].join('\n');

    let parser = new Parser();
    parser.addParser({
        expression: /^#VOD-FRAMERATE/,
        customType: 'framerate',
        dataParser: function(line: string) {
            return parseFloat(line.split(':')[1]);
        }
    });

    parser.push(manifest);
    parser.end();

    let parsedManifest = parser.manifest;
    console.log(parsedManifest)
}

async function test2() {

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
    let downloadManager = new DownloadManager(downloadOptions);
    for (let i = 0; i < 2; i++) {
        let m3u8Buff = null;
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
                let pt = (part==0) ? 'part' + (part+'').padStart(2, '0') : '';
                let pts = (part==0) ? [pt] : [];
                let dlUrls = [];
                let ptPaths = [];
                let indexes = [];
                for (let i = 0; i < parser.manifest.segments.length; i++) {
                    let sg = parser.manifest.segments[i];
                    if (sg.discontinuity) {
                        part++;
                        pt = 'part' + (part+'').padStart(2, '0');
                        pts.push(pt);
                    }
                    let dlUrl = sg.uri;
                    if (!sg.uri.startsWith('http') && !sg.uri.startsWith('https')) {
                        dlUrl = `${baseUrl}/${sg.uri}`.replace('\/\/', '\/');
                    }
                    console.log('downloading: ' + dlUrl);
                    let ptPath = path.join(ofile, pt);
                    if (!fs.existsSync(ptPath)) {
                        fs.mkdirSync(ptPath);
                    }
                    dlUrls.push(dlUrl);
                    ptPaths.push(ptPath);
                    indexes.push(i);
                }
                await downloadManager.downloadSegments(dlUrls, ptPaths, indexes);
                /* now merge parts */
                for (let i = 0; i < pts.length; i++) {
                    let ptPath = path.join(ofile, pts[i]);
                    let tsFiles = fs.readdirSync(ptPath, { withFileTypes: true })
                        .filter(item => item.isFile() && item.name.endsWith('.ts'))
                        .map(item => item.name);
                    console.log('concat: ' + ptPath);
                    await ffmpegConcat(tsFiles, ptPath, ptPath, 'mpegts');
                }
                /* now merge all */
                let partFiles = pts.map(item => item + '.ts');
                await ffmpegConcat(partFiles, ofile, ofile, 'mp4');
            }
        }
    }

}

test2();
