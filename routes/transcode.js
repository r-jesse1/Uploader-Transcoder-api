//source: https://medium.com/@ayushnandanwar003/video-transcoding-in-node-js-saving-videos-in-multiple-resolutions-0ad8e6217d8c

import { path as ffmpegPath } from '@ffmpeg-installer/ffmpeg';
import { path as ffprobePath } from '@ffprobe-installer/ffprobe';
import ffmpeg from 'fluent-ffmpeg';
import express from 'express';
import { nanoid } from 'nanoid';
import { getTranProgress, insertVideo, createTranscodingJournal, updateTranscodingJournal } from '../database.js';
import { DateTime } from 'luxon';
import JWT from '../util/jwt.js';
import { Server } from 'socket.io';
import cors from 'cors';
import http from 'http';
import { transcodeVideo } from '../util/transcode.js';
import { CreateThumbnail } from '../util/createThumbnail.js';
import { getVideoStream, uploadStream, getVideoToTempFile } from '../controllers/S3Controller.js';
import { PassThrough } from 'stream';
const app = express();
const router = express.Router();
import { json } from 'express';

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

app.use(cors());

const server = http.createServer(app);



const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ["GET", "POST"]
    }
});




  router.post('/', JWT.authenticateToken, async (req, res) => {

        console.log(req)
        try {
            console.log(req.body);
            console.log(req.body.id)
            const progressID = nanoid()
            let fileType = req.body.fileType
            const s3input = "videos/" + req.body.id
            const newID = nanoid() + '.' + fileType
            const user = await JWT.decodeUserToken(req)
            const s3vidOutput = "videos/" + newID
            const s3thumbOutput = "thumbnails/" + newID + '.png'
            console.log(progressID);
            res.status(200).json({ progressID });
            console.log(newID)
            console.log(`got trans id ${progressID}`)



            createTranscodingJournal(req.body.id, progressID, req.body.resolution, fileType, user)

            const tempFilePath  = await getVideoToTempFile(s3input)

            const transcodedStream = transcodeVideo(tempFilePath, req.body.resolution, fileType, progressID)

            const thumbnailStream = CreateThumbnail(tempFilePath, newID);
 
            ffmpeg.ffprobe(tempFilePath, async function (err, metadata) {
                        if (err) {
                            //res.status(400).send({ msg: err });
                            console.log(err)
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
                                //res.status(400).send({ msg: err });
                            }
                    }
        })
            await Promise.all([
            uploadStream(transcodedStream, s3vidOutput),
            uploadStream(thumbnailStream, s3thumbOutput)
        ]);

            console.log('Transcoding and thumbnail creation completed.');
            updateTranscodingJournal(progressID, "completed")
        }
        catch (err) {
            console.log(err)
            res.status(500).send({ msg: 'Error transcoding video', error: err.message });
        }
    })


io.on("connection", (socket) => {
    console.log("Socket connected")
    socket.on("requestProgress", async (data) => {
        console.log(`data: ${data}`)

        try {
            const progressID = data;
            console.log(`got request${progressID}`)
            const percent = await getTranProgress(progressID);
            console.log(`progress is:  ${percent}`)

            if (percent) {
                socket.emit("progress", { progress: percent });
            console.log(`sent ${percent}`)

            }
        } catch (err) {
            console.error("Error fetching progress from Memcached:", err);
        }
    });















})


function normalizePort(val) {
    var port = parseInt(val, 10);

    if (isNaN(port)) {
        return val;
    }

    if (port >= 0) {
        return port;
    }

    return false;
}
var socketport = normalizePort(process.env.SOCKETPORT || '3005');

server.listen(socketport, () => {
    console.log(`server running at http://localhost:${socketport}`);
});


export default router;