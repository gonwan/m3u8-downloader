import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import got, { Progress } from 'got';
import log from 'electron-log/main';
import { HttpProxyAgent } from 'http-proxy-agent';
import { HttpsProxyAgent } from 'https-proxy-agent';

type SegInfo = {
    idx: number;
    dlUrl: string;
    ptPath: string;
    key?: Buffer;
    keyIV?: Uint32Array;
    keyMethod?: string;
}

type DownloadOptions = {
    /* electron ipc only supports map */
    headers?: Map<string, string | string[]>;
    proxy?: string;
    concurrency?: number;
    timeout?: number;
    retries?: number;
}

type ProgressCallback = {
    callback:  (idx: number, progress: Progress) => void;
}

// see: https://datatracker.ietf.org/doc/html/rfc8216, HTTP Live Streaming
class DownloadManager {

    options: DownloadOptions;

    constructor(options: DownloadOptions) {
        this.options = options;
        this.options.concurrency = options.concurrency ?? 3;
        this.options.timeout = options.timeout ?? 10*1000;
        this.options.retries = options.retries ?? 3;
    }

    mapToRecord<V>(m: Map<string, V>) {
        let r: Record<string, V> = {};
        for (let [k, v] of m) {
            r[k] = v;
        }
        return r;
    }

    async downloadFile(url: string) {
        return got.get(url,
            {
                headers: this.options.headers ? this.mapToRecord(this.options.headers) : undefined,
                agent: {
                    http: this.options.proxy ? new HttpProxyAgent(this.options.proxy) : undefined,
                    https: this.options.proxy ? new HttpsProxyAgent(this.options.proxy) : undefined
                },
                timeout: {
                    response: this.options.timeout
                },
                retry: {
                    limit: this.options.retries
                }
            })
            .buffer();
    }

    async downloadOneSegment(seg: SegInfo, statCallback?: (idx: number, progress: Progress) => void) {
        let buff = await got.get(seg.dlUrl,
            {
                headers: this.options.headers ? this.mapToRecord(this.options.headers) : undefined,
                agent: {
                    http: this.options.proxy ? new HttpProxyAgent(this.options.proxy) : undefined,
                    https: this.options.proxy ? new HttpsProxyAgent(this.options.proxy) : undefined
                },
                timeout: {
                    response: this.options.timeout
                },
                retry: {
                    limit: this.options.retries
                }
            })
            .on('downloadProgress', progress => {
                if (statCallback) {
                    statCallback(seg.idx, progress);
                }
            })
            .buffer();
        if (seg.keyMethod) {
            switch (seg.keyMethod) {
                case 'AES-128':
                    if (seg.key && seg.keyIV) {
                        let cipher = crypto.createDecipheriv('aes-128-cbc', seg.key, seg.keyIV);
                        buff = Buffer.concat([ cipher.update(buff), cipher.final()]);
                    }
                    break;
                case 'SAMPLE-AES':
                    //FIXME
                    break;
                case 'NONE':
                default:
                    break;
            }
        }
        let outputPath = path.join(seg.ptPath, `${seg.idx}.ts`);
        await fs.promises.writeFile(outputPath, buff);
    }

    async downloadSegments(segs: SegInfo[]) {
        let finishedSegs = 0;
        let totalTransferredBytes = 0;
        let requests = new Map<number, any>();
        let transferredBytes = new Map<number, number>();
        const statCallback = (idx: number, progress: Progress) => {
            transferredBytes.set(idx, progress.transferred);
        }
        let statTimer = setInterval(() => {
            let prev = totalTransferredBytes;
            totalTransferredBytes = 0;
            transferredBytes.forEach((v) => {
                totalTransferredBytes += v;
            })
            log.verbose(`Download speed: ${(totalTransferredBytes-prev)/1000.0}kb/s, percent: ${(finishedSegs/segs.length*100).toFixed(2)}%.`);
            }, 1000);
        for (let i = 0; i < segs.length; i++) {
            // @ts-ignore
            if (requests.size <= this.options.concurrency) {
                let p = this.downloadOneSegment(segs[i], statCallback).then(() => {
                    requests.delete(segs[i].idx);
                    finishedSegs++;
                })
                requests.set(segs[i].idx, p);
                if (requests.size == this.options.concurrency) {
                    await Promise.any(requests.values());
                }
            }
        }
        await Promise.all(requests.values());
        clearInterval(statTimer);
    }

}

export { SegInfo, DownloadOptions, DownloadManager };

// master.m3u8 --> playlists.json(no use..already selected), raw.m3u8 --> meta.json...
// catch awaits...
// index.m3u8 contains multiple sequences???

