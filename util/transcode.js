
import { path as ffmpegPath } from '@ffmpeg-installer/ffmpeg';
import { path as ffprobePath } from '@ffprobe-installer/ffprobe';
import ffmpeg from 'fluent-ffmpeg';

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);





function transcodeVideo(inputPath, outputPath, resolution, format, socket) {

    let totalTime = 0
    return new Promise((resolve, reject) => {
        ffmpeg(inputPath)
            .output(outputPath)
            .videoCodec('libx264')
            .format(format)
            .size(resolution)
            .on('codecData', data => {
                // HERE YOU GET THE TOTAL TIME
                totalTime = parseInt(data.duration.replace(/:/g, ''))
            })
            .on('progress', progress => {
                // HERE IS THE CURRENT TIME
                const time = parseInt(progress.timemark.replace(/:/g, ''))

                // AND HERE IS THE CALCULATION
                const percent = (time / totalTime) * 100
                console.log(percent)
                socket.emit("progress", { progress: percent })
            })
            .on('end', () => {
                console.log(100)
                socket.emit("progress", { progress: 100 })
                console.log(`File has been transcoded to ${resolution}`);
                resolve();
            })
            .on('error', (err) => {
                console.error(`Error transcoding file: ${err.message}`);
                reject(err);
            })
            .run();
    });

}

export default { transcodeVideo };