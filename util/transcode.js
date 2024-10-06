
import { path as ffmpegPath } from '@ffmpeg-installer/ffmpeg';
import { path as ffprobePath } from '@ffprobe-installer/ffprobe';
import ffmpeg from 'fluent-ffmpeg';
import { PassThrough } from 'stream';
import { setTranProgress, getIncompleteTranscodes } from '../database.js';
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);
  
  function transcodeVideo(inputStream, resolution, format, progressID) {
    console.log(`transcoding video with id ${progressID}`)
    const transcodedStream = new PassThrough();
    let totalTime = 0;
    ffmpeg(inputStream)
      .outputFormat('mp4')
      .videoCodec('libx264')
      .audioCodec('aac')
       .format(format)
       .size(resolution)
      .outputOptions([
        '-movflags frag_keyframe+empty_moov',
        '-preset fast',
        '-profile:v baseline',
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
            } catch (err) {
                console.error('Error saving progress in Memcached:', err);
            }
        })
      .on('error', (err) => {
        console.error("Error during transcoding:", err);
        transcodedStream.destroy(); // Destroy the stream if an error occurs
      })
      .on('end', () => {
        setTranProgress(progressID, 100);
        console.log("Transcoding finished.");
        transcodedStream.end(); // Properly end the stream
      })
      .pipe(transcodedStream);
  
    return transcodedStream;
  }


  const handleIncompleteTranscodes = async () => {
    try {
      const incompleteTranscodes = await getIncompleteTranscodes();
      
      if (incompleteTranscodes.length > 0) {
        console.log("Found incomplete transcodes: ", incompleteTranscodes);
        
        for (const transcode of incompleteTranscodes) {
          const { video_id, progress_id, status, resolution, fileType, user } = transcode;
  
          try {
            console.log(`Restarting transcode for video ID: ${video_id}, progress ID: ${progress_id}`);
            await restartTranscode(video_id, progress_id, resolution, fileType, user);
  
          } catch (err) {
            console.error(`Failed to restart transcode for video ID: ${video_id}. Marking as failed.`);
            await updateTranscodingStatus(progress_id, 'failed', 'Server restart: could not resume transcoding');
          }
        }
      } else {
        console.log("No incomplete transcodes found.");
      }
  
    } catch (error) {
      console.error("Error handling incomplete transcodes: ", error.message);
    }
  };



  const restartTranscode = async (video_id, progressID, resolution, fileType, user) => {
        const s3input = "videos/" + video_id
        const newID = nanoid() + '.' + fileType

        const s3vidOutput = "videos/" + newID
        const s3thumbOutput = "thumbnails/" + newID + '.png'

        const tempFilePath  = await getVideoToTempFile(s3input)

        const transcodedStream = transcodeVideo(tempFilePath, resolution, fileType, progressID)

        const thumbnailStream = CreateThumbnail(tempFilePath, newID);

        ffmpeg.ffprobe(tempFilePath, async function (err, metadata) {
                    if (err) {
                      throw new Error(err)
                    }

                    else {
                        const formattedMetadata = {
                            ID: newID,
                            name: req.body.name,
                            owner: user,
                            resolution: Math.min(metadata.streams[0].width, metadata.streams[0].height),
                            uploadDate: DateTime.now().toFormat('yyyy-MM-dd'),
                            private: req.body.private,
                            size: metadata.format.size / 1048576,
                            length: Math.floor(metadata.format.duration),
                            fileType: fileType
                        }

                        let err = await insertVideo(formattedMetadata);
                        if (err) {
                          throw new Error(err)
                        }
                }
    })
        await Promise.all([
        uploadStream(transcodedStream, s3vidOutput),
        uploadStream(thumbnailStream, s3thumbOutput)
    ]);
        console.log('Transcoding and thumbnail creation completed.');
}

























export {transcodeVideo, handleIncompleteTranscodes};