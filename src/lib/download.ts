import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import got, { AbortError, Progress } from 'got';
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

type StreamInfo = {
    resWidth?: number;
    resHeight?: number;
    bandwidth?: number;
    url: string;
    codecs?: string,
    audioGroup?: string, /* video */
    subtitlesGroup?: string /* video */
    name?: string, /* audio/subtitle */
    language?: string /* audio/subtitle */
};

type VideoInfo = {
    video: StreamInfo[],
    audio: StreamInfo[]
}

type DownloadProgress = {
    isStop: boolean;
    abortController: AbortController;
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
    autoSelectBest: boolean;
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

    /*
     * Some sites append a png header to the ts files, skip it.
     * See: https://en.wikipedia.org/wiki/MPEG_transport_stream#Packet
     */
    skipToTsHeader(buff: Buffer, idx: number) {
        let len = (buff.length < 16384) ? buff.length : 16384;
        let i = 0;
        for ( ; i < len-188*2; i++) {
            if (buff[i] == 0x47 && buff[i+188] == 0x47 && buff[i+188*2] == 0x47) {
                break;
            }
        }
        if (i == len) {
            log.error(`Seg${idx}: Failed to find a valid Ts header`);
            return Buffer.alloc(0);
        }
        if (i > 0) {
            log.info(`Seg${idx}: Skipped ${i} bytes to find a Ts header`);
            return buff.subarray(i);
        }
        return buff;
    }

    async downloadFile(url: string, length?: number, offset?: number) {
        let hds = this.options.headers ? new Map(this.options.headers) : new Map();
        /* do not use length && offset, since they can be 0. */
        if (typeof length != 'undefined' && typeof offset != 'undefined') {
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
                    request: this.options.timeout
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
        let hds = this.options.headers ? new Map(this.options.headers) : new Map();
        /* do not use length && offset, since they can be 0. */
        if (typeof seg.length != 'undefined' && typeof seg.offset != 'undefined') {
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
                    request: this.options.timeout
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
                        buff = Buffer.concat([cipher.update(buff), cipher.final()]);
                    }
                    break;
                case 'SAMPLE-AES':
                    log.error('SAMPLE-AES not supported!');
                    break;
                case 'NONE':
                default:
                    break;
            }
        }
        buff = this.skipToTsHeader(buff, seg.idx);
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
        for (let i = 0; i < segs.length; i++) {
            if (downloadProgress.isStop) {
                break;
            }
            // @ts-ignore
            if (requests.size <= this.options.concurrency) {
                log.info(`Downloading seg${i}: ${segs[i].dlUrl}`);
                let p = this.downloadOneSegment(segs[i], downloadProgress.abortController.signal, statCallback).then(() => {
                    requests.delete(segs[i].idx);
                    downloadProgress.transferredSegs++;
                });
                requests.set(segs[i].idx, p);
                if (requests.size == this.options.concurrency) {
                    await Promise.any(requests.values())
                        .catch((err) => {
                            log.error('Download failed', err);
                        });
                }
            }
        }
        await Promise.all(requests.values())
            .catch((err) => {
                if (err instanceof AbortError) {
                    log.info("Download aborted");
                } else {
                    log.error('Download failed', err);
                    throw err;
                }
            });
        /* sleep to get progress updated to 100% */
        await new Promise(r => setTimeout(r, 1000));
        clearInterval(statTimer);
    }

}

export { StreamInfo, VideoInfo, SegInfo, DownloadProgress, DownloadOptions, DownloadManager };
