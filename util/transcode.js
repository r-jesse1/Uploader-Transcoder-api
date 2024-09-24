
import { path as ffmpegPath } from '@ffmpeg-installer/ffmpeg';
import { path as ffprobePath } from '@ffprobe-installer/ffprobe';
import ffmpeg from 'fluent-ffmpeg';
import { PassThrough } from 'stream';
import { setTranProgress } from '../database.js';
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



  
  function transcodeVideo(inputStream, resolution, format, progressID) {
    console.log(`transcoding video with id ${progressID}`)
    const transcodedStream = new PassThrough();
    let totalTime = 0;
    ffmpeg(inputStream)
      .outputFormat('mp4')
      .videoCodec('libx264')
      .audioCodec('aac')
    //   .format(format)
    //   .size(resolution)
      .outputOptions([
        '-movflags frag_keyframe+empty_moov',  // Important for streaming MP4s
        '-preset fast',  // Choose an appropriate encoding preset
        '-profile:v baseline',  // Ensures compatibility with MP4 players
        '-level 3.0'
      ])
        .on('codecData', data => {
            totalTime = parseInt(data.duration.replace(/:/g, ''));
        })
        .on('progress', progress => {
            const time = parseInt(progress.timemark.replace(/:/g, ''));
            const percent = (time / totalTime) * 100;
            console.log(percent);

            try {
                // Save progress in Memcached
                setTranProgress(progressID, percent);
                //socket.emit("progress", { progress: percent });
            } catch (err) {
                console.error('Error saving progress in Memcached:', err);
            }
        })
      .on('error', (err) => {
        console.error("Error during transcoding:", err);
        transcodedStream.destroy(); // Destroy the stream if an error occurs
      })
      .on('end', () => {
        //socket.emit("progress", { progress: 100 });
        setTranProgress(progressID, 100);
        console.log("Transcoding finished.");
        transcodedStream.end(); // Properly end the stream
      })
      .pipe(transcodedStream);
  
    return transcodedStream;
  }


export default transcodeVideo;