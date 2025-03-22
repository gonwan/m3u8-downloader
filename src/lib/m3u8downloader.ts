import { Buffer } from 'node:buffer';
import fs from 'node:fs';
import path from "node:path";
import url from 'node:url';
import log from 'electron-log/main';
// @ts-ignore
import { Parser } from 'm3u8-parser';
import { StreamInfo, VideoInfo, SegInfo, DownloadProgress, DownloadOptions, DownloadManager } from './download';
import { binaryConcat, ffmpegConcat, ffmpegConvertToMpegTs } from "./ffmpeg";

const DEFAULT_IV = new Uint32Array([0, 0, 0, 0]);

let downloadProcess: DownloadProgress;

/**
 * Download and parse playlist.m3u8
 * @param inputUrl
 * @param outputFile
 * @param downloadOptions
 * @return void if it is not a playlist
 *         one pair of video/audio stream info if auto select best
 *         all video/audio stream info otherwise
 */
const m3u8CheckPlaylist = async (inputUrl: string, outputFile: string, downloadOptions: DownloadOptions) => {
    let dot = outputFile.lastIndexOf('.');
    let ofile = (dot == -1) ? outputFile : outputFile.slice(0, dot);
    if (!fs.existsSync(ofile)) {
        await fs.promises.mkdir(ofile, { recursive: true });
    }
    let downloadManager = new DownloadManager(downloadOptions);
    let m3u8Buff = await downloadManager.downloadFile(inputUrl);
    let parser = new Parser();
    parser.push(m3u8Buff);
    parser.end();
    if (!parser.manifest.playlists) {
        await fs.promises.writeFile(path.join(ofile, 'video.m3u8'), m3u8Buff);
    } else {
        //log.verbose('Got playlist:');
        //log.verbose(parser.manifest);
        await fs.promises.writeFile(path.join(ofile, 'playlist.m3u8'), m3u8Buff);
        let videoInfo: VideoInfo = {video: [], audio: []};
        for (let pl of parser.manifest.playlists) {
            let videoStream: StreamInfo = {
                resWidth: pl.attributes?.RESOLUTION?.width ?? 0,
                resHeight: pl.attributes?.RESOLUTION?.height ?? 0,
                bandwidth: pl.attributes?.BANDWIDTH ?? 0,
                url: pl.uri ? url.resolve(inputUrl, pl.uri) : '',
                codecs: pl.attributes?.CODECS ?? '',
                audioGroup: pl.attributes?.AUDIO ?? '',
                subtitlesGroup: pl.attributes?.SUBTITLES ?? ''
            };
            videoInfo.video.push(videoStream);
        }
        if (parser.manifest.mediaGroups && parser.manifest.mediaGroups.AUDIO) {
            for (const [group, groupInfo] of Object.entries<any>(parser.manifest.mediaGroups.AUDIO)) {
                for (const [lang, langInfo] of Object.entries<any>(groupInfo)) {
                    let audioStream: StreamInfo = {
                        audioGroup: group,
                        name: lang,
                        url: langInfo.uri ? url.resolve(inputUrl, langInfo.uri) : '',
                        language: langInfo.language ?? ''
                    };
                    videoInfo.audio.push(audioStream);
                }
            }
        }
        if (!downloadOptions.autoSelectBest) {
            return videoInfo;
        } else {
            let bestVideoStream;
            let bestAudioStream;
            let maxVideoWidth = 0;
            let maxVideoBandwidth = 0;
            if (videoInfo.video) {
                for (let si of videoInfo.video) {
                    if (si.resWidth && si.resWidth > maxVideoWidth) {
                        maxVideoWidth = si.resWidth;
                        bestVideoStream = si;
                    } else if (si.resWidth === maxVideoWidth && si.bandwidth && si.bandwidth > maxVideoBandwidth) {
                        maxVideoBandwidth = si.bandwidth;
                        bestVideoStream = si;
                    }
                }
            }
            if (bestVideoStream && videoInfo.audio) {
                for (let si of videoInfo.audio) {
                    if (si.audioGroup === bestVideoStream.audioGroup || bestVideoStream.audioGroup === '') {
                        if (!bestAudioStream || si.language === 'en' || si.language === 'en-US') {
                            bestAudioStream = si;
                        }
                    }
                }
            }
            let bestVideoInfo: VideoInfo = {video: [], audio: []};
            if (bestVideoStream) {
                //log.info(`Selecting video resolution ${bestVideoStream.resWidth}x${bestVideoStream.resHeight}: ${bestVideoStream.url}`);
                bestVideoInfo.video.push(bestVideoStream);
            }
            if (bestAudioStream) {
                //log.info(`Selecting audio language ${bestAudioStream.language}: ${bestAudioStream.url}`);
                bestVideoInfo.audio.push(bestAudioStream);
            }
            return bestVideoInfo;
        }
    }
}

const m3u8ParseSegments = async(inputUrl: string, ofile: string, downloadManager: DownloadManager, isVideo: boolean) => {
    let m3u8Buff = await downloadManager.downloadFile(inputUrl);
    await fs.promises.writeFile(path.join(ofile, `${isVideo ? 'video' : 'audio'}.m3u8`), m3u8Buff);
    let parser = new Parser();
    parser.push(m3u8Buff);
    parser.end();
    //log.verbose(isVideo ? 'Got video:' : 'Got audio:');
    //log.verbose(parser.manifest);
    if (!parser.manifest.segments) {
        log.error('No segment found');
        return new Map<number, SegInfo[]>();
    } else {
        let part = -1;
        let partMap = new Map<number, SegInfo[]>();
        let keyMap = new Map<string, Buffer>();
        let hasXMap = false;
        for (let i = 0; i < parser.manifest.segments.length; i++) {
            let seg = parser.manifest.segments[i];
            if (seg.discontinuity || i == 0) {
                part++;
                partMap.set(part, []);
            }
            let dlUrl = url.resolve(inputUrl, seg.uri);
            //log.verbose(`Got seg${i}: ${dlUrl}`);
            let ptPath = path.join(ofile, isVideo ? 'video' : 'audio', `part${part}`);
            if (!fs.existsSync(ptPath)) {
                await fs.promises.mkdir(ptPath, { recursive: true });
            }
            if (seg.key) { /* EXT-X-KEY */
                let keyUrl = url.resolve(inputUrl, seg.key.uri);
                let key = keyMap.get(keyUrl);
                if (!key) {
                    log.info(`Getting key from: ${keyUrl}`);
                    key = await downloadManager.downloadFile(keyUrl);
                    keyMap.set(keyUrl, key);
                    log.info(`Got key=${key} iv=${seg.key.iv} method=${seg.key.method}`);
                }
                partMap.get(part)?.push({
                    idx: i,
                    dlUrl: dlUrl,
                    ptPath: ptPath,
                    length: seg.byterange?.length,
                    offset: seg.byterange?.offset,
                    key: key,
                    keyIV: seg.key.iv ?? DEFAULT_IV,
                    keyMethod: seg.key.method
                });
            } else {
                partMap.get(part)?.push({idx: i, dlUrl: dlUrl, ptPath: ptPath,
                    length: seg.byterange?.length, offset: seg.byterange?.offset });
            }
            if (seg.map && seg.map.uri) { /* EXT-MAP-KEY */
                if (!hasXMap) {
                    let xMapUrl = url.resolve(inputUrl, seg.map.uri);
                    log.info(`Getting map file from: ${xMapUrl}`);
                    let xMapBuff = await downloadManager.downloadFile(xMapUrl, seg.map.byterange?.length, seg.map.byterange?.offset);
                    await fs.promises.writeFile(path.join(ofile, isVideo ? 'video' : 'audio', 'init.mp4'), xMapBuff);
                    hasXMap = true;
                }
            }
        }
        return partMap;
    }
}

/**
 * Download segments from an m3u8 url
 * @param inputUrl a video or audio m3u8 url
 * @param outputFile
 * @param downloadOptions
 * @param isVideo
 * @param removeAds
 */
const m3u8Download = async (inputUrl: string, outputFile: string, downloadOptions: DownloadOptions, isVideo: boolean, removeAds: boolean) => {
    let streamType = isVideo ? 'video' : 'audio';
    let optsJson = JSON.stringify(downloadOptions, (key, value) => {
        if (value instanceof Map) {
            return Object.fromEntries(value);
        } else {
            return value;
        }
    });
    log.info(`Downloading: ${streamType}Url=${inputUrl} outputFile=${outputFile}`);
    log.info(`Downloading: options=${optsJson}`)
    downloadProcess = {
        isStop: false,
        abortController: new AbortController(),
        totalSegs: -1, /* not filled */
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
    /* parse */
    let downloadManager = new DownloadManager(downloadOptions);
    let segs: SegInfo[] = [];
    let partMap = await m3u8ParseSegments(inputUrl, ofile, downloadManager, isVideo);
    if (!partMap || partMap.size == 0) {
        return [];
    }
    let c = 0;
    for (let [_, v] of partMap) {
        for (let seg of v) {
            segs.push(seg);
            c++;
        }
    }
    log.info(`Found ${c} ${streamType} segments in ${partMap.size} parts`);
    await downloadManager.downloadSegments(segs, downloadProcess);
    /* now merge parts */
    let partFiles = [];
    let partFilesMap = new Map<string, number[]>();
    if (!downloadProcess.isStop) {
        let hasXMap = fs.existsSync(path.join(ofile, streamType, 'init.mp4'));
        for (let [k, v] of partMap) {
            if (v && v.length > 0) {
                let ptPath = v[0].ptPath;
                let tsFiles = hasXMap ? [path.join('..', 'init.mp4')] : [];
                v.forEach((seg) => tsFiles.push(`${seg.idx}.ts`));
                //await binaryConcat(tsFiles, ptPath, ptPath);
                let videoDetails: string[] = [];
                if (tsFiles.length <= 1000) {
                    let [vd, _] = await ffmpegConcat(tsFiles, [], ptPath, ptPath, 'mpegts');
                    videoDetails = vd;
                } else {
                    /* prevent 'too many open files', windows=2048, linux=1024 by default. */
                    let tsGroups: string[] = [];
                    for (let i = 0; i*1000 < tsFiles.length; i++) {
                        tsGroups.push(`group${i}`);
                        await ffmpegConcat(tsFiles.slice(i*1000, (i+1)*1000), [], tsGroups[tsGroups.length-1], ptPath, 'mpegts');
                    }
                    let groupFiles = tsGroups.map((g) => `${g}.ts`);
                    let [vd, _] = await ffmpegConcat(groupFiles, [], ptPath, ptPath, 'mpegts');
                    videoDetails = vd;
                }
                let videoRes = 'DUMMY_VIDEO_RES';
                if (removeAds && isVideo && videoDetails) {
                    /*
                     * h264 (High) ([27][0][0][0] / 0x001B),yuv420p(progressive),1080x606 [SAR 404:405 DAR 16:9],23.98 fps,23.98 tbr,90k tbn
                     * aac (LC) ([15][0][0][0] / 0x000F),44100 Hz,stereo,fltp,66 kb/s
                     */
                    let res = '';
                    let fps = '';
                    for (let d of videoDetails) {
                        if (/\dx\d.*DAR.*/.test(d)) {
                            res = d;
                        }
                        if (d.indexOf('fps') != -1) {
                            fps = d;
                        }
                    }
                    videoRes = `${videoDetails[0]}-${res}-${fps}`;
                }
                let parts = partFilesMap.get(videoRes);
                if (!parts) {
                    partFilesMap.set(videoRes, [k]);
                } else {
                    parts.push(k);
                }
            }
        }
        if (partFilesMap.size > 0) {
            let maxPartRes = '';
            let maxPartFiles: number[] = [];
            for (let [k, v] of partFilesMap.entries()) {
                if (v && v.length > maxPartFiles.length) {
                    maxPartRes = k;
                    maxPartFiles = v;
                }
            }
            let adsFileParts = [];
            for (let [k, v] of partFilesMap.entries()) {
                if (k !== maxPartRes) {
                    adsFileParts.push(v);
                }
            }
            if (adsFileParts.length > 0) {
                log.info(`Removing ads parts: ${adsFileParts}`);
            }
            for (let i of maxPartFiles) {
                partFiles.push(path.join(streamType, `part${i}.ts`));
            }
        }
    }
    return partFiles;
}

const m3u8StopDownload = () => {
    log.info('Stopping download');
    if (downloadProcess) {
        downloadProcess.isStop = true;
        downloadProcess.abortController.abort();
    }
}

const m3u8GetDownloadProgress = () => {
    return downloadProcess;
}

const m3u8ConcatStreams = async (videoPartFiles: string[], audioPartFiles: string[], outputFile: string, workingDir: string, downloadOptions: DownloadOptions, videoCodecs: string) => {
    let dot = outputFile.lastIndexOf('.');
    let ofile = (dot == -1) ? outputFile : outputFile.slice(0, dot);
    let codec = 'h264';
    if (videoCodecs) {
        if (videoCodecs.indexOf('hvc1') != -1) {
            codec = 'h265';
        } else {
            codec = 'h264';
        }
    }
    await ffmpegConcat(videoPartFiles, audioPartFiles, ofile, workingDir, codec);
    /* clean up */
    if (!downloadOptions.preserveFiles) {
        await fs.promises.rm(workingDir, { force: true, recursive: true });
    }
}

export { m3u8CheckPlaylist, m3u8Download, m3u8StopDownload, m3u8GetDownloadProgress, m3u8ConcatStreams };
