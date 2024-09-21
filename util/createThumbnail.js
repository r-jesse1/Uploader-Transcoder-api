import { path as ffmpegPath } from '@ffmpeg-installer/ffmpeg';
import { path as ffprobePath } from '@ffprobe-installer/ffprobe';
import ffmpeg from 'fluent-ffmpeg';
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);


const CreateThumbnail = async (filename, filepath) => {
    return new Promise((resolve, reject) => {
        ffmpeg(filepath)
            .screenshots({
                timestamps: ['10%'],
                folder: './thumbnails',
                filename: `${filename}.png`,
                size: '720x?'
            })
            .on('error', function (err) {
                reject(err)
            })
            .on('end', function () {
                resolve()
            })
    })
}

export default CreateThumbnail