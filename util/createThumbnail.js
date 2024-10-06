import { path as ffmpegPath } from '@ffmpeg-installer/ffmpeg';
import { path as ffprobePath } from '@ffprobe-installer/ffprobe';
import ffmpeg from 'fluent-ffmpeg';
import { PassThrough } from 'stream';
import tmp from 'tmp';
import fs from 'fs';


ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);


const CreateUploadThumbnail = async (filename, filepath) => {
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

function CreateThumbnail(inputStream, id) {

      const thumbnailStream = new PassThrough();
      
      ffmpeg(inputStream)
      .seekInput('00:00:05')
      .frames(1) // Extract only one frame
      .outputOptions('-vf', 'scale=720:-1') // Resize the thumbnail to 720p width, keeping aspect ratio
      .outputFormat('image2')
        .on('error', (err) => {
            console.log(err)
        })
        .on('end', () => {
          console.log("Thumbnail stream created");
        })
        .pipe(thumbnailStream);
  
        return thumbnailStream;

  };
  



export { CreateThumbnail, CreateUploadThumbnail }