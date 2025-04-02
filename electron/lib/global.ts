type SegInfo = {
    idx: number;
    dlUrl: string;
    ptPath: string;
    length?: number;
    offset?: number;
    hasXMap: boolean;
    key?: Buffer;
    keyIV?: string | Uint32Array;
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

export { type StreamInfo, type VideoInfo, type SegInfo, type DownloadProgress, type DownloadOptions };
