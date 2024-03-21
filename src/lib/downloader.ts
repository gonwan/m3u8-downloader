import fs from 'node:fs';
import path from 'node:path';
import got, { Progress } from 'got';
import { HttpProxyAgent } from 'http-proxy-agent';
import { HttpsProxyAgent } from 'https-proxy-agent';

class DownloadOptions {

    //headers: object = {};
    proxy?: string;

    concurrency: number = 1;
    //timeoutMs: number = 10*1000;
    //totalRetry: number = 10;

    //preferredResolution: number = -1;
    //loggerCallback: object = {};

}

class DownloadManager {

    options: DownloadOptions;

    currentChunks: number = 0;
    totalChunks: number = 0;
    speedKB: number = 0;

    constructor(options: DownloadOptions) {
        this.options = options;
    }

    async downloadM3u8File(url: string) {
        //console.log(this.options.headers);
        return got.get(url,
            {
                headers: { 'User-Agent': 'Lavf/58.24.101' },
                //headers: JSON.parse(JSON.stringify(this.options.headers)) /* object to record */
                agent: {
                    http: this.options.proxy ? new HttpProxyAgent(this.options.proxy) : undefined,
                    https: this.options.proxy ? new HttpsProxyAgent(this.options.proxy) : undefined
                }
            })
            .buffer();
    }

    async downloadOneSegment(dlUrl: string, ptPath: string, index: number, progressCallback?: (idx: number, progress: Progress) => void) {
        let buff = await got.get(dlUrl,
            {
                headers: { 'User-Agent': 'Lavf/58.24.101' },
                //headers: JSON.parse(JSON.stringify(this.options.headers)) /* object to record */
                agent: {
                    http: this.options.proxy ? new HttpProxyAgent(this.options.proxy) : undefined,
                    https: this.options.proxy ? new HttpsProxyAgent(this.options.proxy) : undefined
                }
            })
            .on('downloadProgress', progress => {
                //console.log(`index: ${index}, progress: ${JSON.stringify(progress)}`);
                if (progressCallback) {
                    progressCallback(index, progress);
                }
            })
            .buffer();
        let outputPath = path.join(ptPath, `${index}.ts`);
        await fs.promises.writeFile(outputPath, buff);
    }

    async downloadFirstSegment(dlUrl: string, ptPath: string) {
        await this.downloadOneSegment(dlUrl, ptPath, 0);
    }

    async downloadSegments(dlUrls: string[], ptPaths: string[], indexes: number[]) {
        let finishedSegs = 0;
        let totalTransferredBytes = 0;
        let requests = new Map<number, any>();
        let transferredBytes = new Map<number, number>();
        const pcb = (idx: number, progress: Progress) => {
            transferredBytes.set(idx, progress.transferred);
        }
        let stats = setInterval(() => {
            let prev = totalTransferredBytes;
            totalTransferredBytes = 0;
            transferredBytes.forEach((v) => {
                totalTransferredBytes += v;
            })
            console.log(`download speed: ${(totalTransferredBytes-prev)/1000.0}kb/s, percent: ${finishedSegs/dlUrls.length*100}%.`);
            }, 1000);
        for (let i = 0; i < dlUrls.length; i++) {
            if (requests.size <= this.options.concurrency) {
                let p = this.downloadOneSegment(dlUrls[i], ptPaths[i], indexes[i], pcb).then(() => {
                    requests.delete(indexes[i]);
                    finishedSegs++;
                })
                requests.set(indexes[i], p);
                //console.log('keys: ' + Array.from(requests.keys()));
                if (requests.size == this.options.concurrency) {
                    await Promise.any(requests.values());
                }
            }
        }
        await Promise.all(requests.values());
        clearInterval(stats);
    }

}

export { DownloadOptions, DownloadManager };

// master.m3u8 --> playlists.json(no use..already selected), raw.m3u8 --> meta.json...
// catch awaits...
// index.m3u8 contains multiple sequences???
// see: https://datatracker.ietf.org/doc/html/rfc8216, HTTP Live Streaming