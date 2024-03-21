import ff from '@ffmpeg-installer/ffmpeg';
import ffmpeg from 'fluent-ffmpeg';

ffmpeg.setFfmpegPath(ff.path)
console.log("version: " + ff.version)

class M3u8convertor {

    input: string;
    output: string;

    constructor(input: string, output : string) {
        this.input = input;
        this.output = output;
    }

    test0() {
        let aa = ffmpeg()
        aa.availableCodecs((err: Error, codecs: ffmpeg.Codecs) => {
            if (err) {
                console.error("err");
            } else {
                console.log(Object.keys(codecs));
            }
        })
    }

    test1() {
        // no ad, why???!!!, part15 is ad..
        // fulilian-27
        // https://svipsvip.ffzy-online5.com/20240316/24963_edf36ed5/index.m3u8
        let aa = ffmpeg("https://svipsvip.ffzy-online5.com/20240316/24963_edf36ed5/index.m3u8")
        aa
            .on("error", error => {
                console.error(error);
            })
            .on("end", () => {
                console.log("finished");
            })
            .on('progress', function(progress) {
                console.log('progress: ' + (progress.percent || 0).toFixed(2) + '%。');
            })
            .outputOptions("-c copy")
            .outputOptions("-bsf:a aac_adtstoasc")
            .output("D:\\a.mp4")
            .run();
    }

}

console.log("hello");
let a = new M3u8convertor("", "");
a.test1();

// hls is live...
// main download logic is DownloadManager...

