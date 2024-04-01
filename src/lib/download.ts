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
    length?: number;
    offset?: number;
    key?: Buffer;
    keyIV?: Uint32Array;
    keyMethod?: string
};

type DownloadProgress = {
    isStop: boolean;
    totalSegs: number;
    transferredSegs: number;
    totalBytes: number;
    transferredBytes: number;
    speed: number /* per second */
};

type DownloadOptions = {
    /* electron ipc only supports map */
    headers?: Map<string, string | string[]>;
    proxy?: string;
    concurrency?: number;
    timeout?: number;
    retries?: number;
    /* for debugging */
    preserveFiles?: boolean
};

type StatCallback = (idx: number, progress: Progress) => void;

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

    async downloadFile(url: string, length?: number, offset?: number) {
        let hds = this.options.headers ? new Map(this.options.headers) : new Map;
        if (typeof length !== 'undefined' && typeof offset !== 'undefined') {
            hds.set('Range', `bytes=${offset}-${offset+length-1}`);
        }
        return got.get(url,
            {
                headers: (hds.size > 0) ? this.mapToRecord(hds) : undefined,
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

    async downloadOneSegment(seg: SegInfo, signal: AbortSignal, statCallback?: StatCallback) {
        let outputPath = path.join(seg.ptPath, `${seg.idx}.ts`);
        if (fs.existsSync(outputPath)) {
            return;
        }
        let hds = this.options.headers ? new Map(this.options.headers) : new Map;
        if (typeof seg.length !== 'undefined' && typeof seg.offset !== 'undefined') {
            hds.set('Range', `bytes=${seg.offset}-${seg.offset+seg.length-1}`);
        }
        let buff = await got.get(seg.dlUrl,
            {
                headers: (hds.size > 0) ? this.mapToRecord(hds) : undefined,
                agent: {
                    http: this.options.proxy ? new HttpProxyAgent(this.options.proxy) : undefined,
                    https: this.options.proxy ? new HttpsProxyAgent(this.options.proxy) : undefined
                },
                timeout: {
                    response: this.options.timeout
                },
                retry: {
                    limit: this.options.retries
                },
                signal: signal
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
                    // FIXME
                    break;
                case 'NONE':
                default:
                    break;
            }
        }
        await fs.promises.writeFile(outputPath, buff);
    }

    async downloadSegments(segs: SegInfo[], downloadProgress: DownloadProgress) {
        downloadProgress.totalSegs = segs.length;
        let requests = new Map<number, any>();
        let transferredBytes = new Map<number, number>();
        const statCallback = (idx: number, progress: Progress) => {
            transferredBytes.set(idx, progress.transferred);
        }
        let statTimer = setInterval(() => {
            let prev = downloadProgress.transferredBytes;
            let current = 0;
            transferredBytes.forEach((v) => {
                current += v;
            })
            downloadProgress.transferredBytes = current;
            downloadProgress.speed = current - prev;
            }, 1000);
        const abortController = new AbortController();
        for (let i = 0; i < segs.length; i++) {
            if (downloadProgress.isStop) {
                break;
            }
            // @ts-ignore
            if (requests.size <= this.options.concurrency) {
                let p = this.downloadOneSegment(segs[i], abortController.signal, statCallback).then(() => {
                    requests.delete(segs[i].idx);
                    downloadProgress.transferredSegs++;
                });
                requests.set(segs[i].idx, p);
                if (requests.size == this.options.concurrency) {
                    await Promise.any(requests.values());
                }
            }
        }
        if (downloadProgress.isStop) {
            abortController.abort();
        }
        await Promise.all(requests.values())
            .catch((err) => {
                log.info('Download failed: ', err);
            });
        /* sleep to get progress updated to 100% */
        await new Promise(r => setTimeout(r, 1000));
        clearInterval(statTimer);
    }

}

export { SegInfo, DownloadProgress, DownloadOptions, DownloadManager };

// master.m3u8 --> playlists.json(no use..already selected), raw.m3u8 --> meta.json...
// catch awaits...
// index.m3u8 contains multiple sequences???

