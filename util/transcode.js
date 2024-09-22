
import { path as ffmpegPath } from '@ffmpeg-installer/ffmpeg';
import { path as ffprobePath } from '@ffprobe-installer/ffprobe';
import ffmpeg from 'fluent-ffmpeg';
import { PassThrough } from 'stream';

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);





// function transcodeVideo(stream, resolution, format, socket) {
//     const transcodedStream = new PassThrough();
//     let totalTime = 0
//     // return new Promise((resolve, reject) => {
//         ffmpeg(stream)
//         .videoCodec('libx264')
//         .audioCodec('aac') // Add audio codec if applicable
//         .format(format) // Ensure format matches codec
//         .size(resolution) // Make sure this is in the correct format (e.g., '1280x720')
//         .on('codecData', data => {
//             totalTime = parseInt(data.duration.replace(/:/g, ''));
//         })
//         .on('progress', progress => {
//             const time = parseInt(progress.timemark.replace(/:/g, ''));
//             const percent = (time / totalTime) * 100;
//             console.log(percent);
//             socket.emit("progress", { progress: percent });
//         })
//         .on('end', () => {
//             console.log(100);
//             socket.emit("progress", { progress: 100 });
//             console.log(`File has been transcoded to ${resolution}`);
//         })
//         .on('error', (err) => {
//             console.error(`Error transcoding file: ${err.message}`);
//             console.error(`Full error: ${JSON.stringify(err)}`); // Detailed error logging
//         })
//         .pipe(transcodedStream);

//     return transcodedStream;
//     // });

//}



  
  function transcodeVideo(inputStream) {
    const transcodedStream = new PassThrough();
  
    ffmpeg(inputStream)
      .outputFormat('mp4')
      .videoCodec('libx264')
      .audioCodec('aac')
      .outputOptions([
        '-movflags frag_keyframe+empty_moov',  // Important for streaming MP4s
        '-preset fast',  // Choose an appropriate encoding preset
        '-profile:v baseline',  // Ensures compatibility with MP4 players
        '-level 3.0'
      ])
      .on('error', (err) => {
        console.error("Error during transcoding:", err);
        transcodedStream.destroy(); // Destroy the stream if an error occurs
      })
      .on('end', () => {
        console.log("Transcoding finished.");
        transcodedStream.end(); // Properly end the stream
      })
      .pipe(transcodedStream);
  
    return transcodedStream;
  }


//   function transcodeAndCreateThumbnail(inputStream, socket) {
//     const transcodedStream = new PassThrough();
//     const thumbnailStream = new PassThrough();
  
//     // FFmpeg process for transcoding
//     const transcodingProcess = ffmpeg(inputStream)
//       .outputFormat('mp4')
//       .videoCodec('libx264')
//       .audioCodec('aac')
//       .outputOptions([
//         '-movflags frag_keyframe+empty_moov',
//         '-preset fast',
//         '-profile:v baseline',
//         '-level 3.0'
//       ])
//       .on('error', (err) => {
//         console.error("Error during transcoding:", err);
//       })
//       .on('progress', progress => {
//         socket.emit("progress", { progress: progress.percent });
//       })
//       .on('end', () => {
//         console.log("Transcoding finished.");
//         socket.emit("progress", { progress: 100 });
//       })
//       .pipe(transcodedStream);
  
//     // Separate FFmpeg process for thumbnail generation
//     ffmpeg(inputStream)
//       .seekInput('00:00:05') // Jump to a specific time in the video, like 5 seconds
//       .frames(1) // Extract only one frame
//       .outputOptions('-vf', 'scale=720:-1') // Resize the thumbnail to 720p width
//       .outputFormat('image2') // Output as an image format
//       .on('error', (err) => {
//         console.error("Error generating thumbnail:", err);
//       })
//       .on('end', () => {
//         console.log("Thumbnail created.");
//       })
//       .pipe(thumbnailStream);
  
//     // Return both streams (transcoded video and thumbnail)
//     return {
//       transcodedStream,
//       thumbnailStream
//     };
//   }


export default transcodeVideo;