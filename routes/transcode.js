//source: https://medium.com/@ayushnandanwar003/video-transcoding-in-node-js-saving-videos-in-multiple-resolutions-0ad8e6217d8c

import { path as ffmpegPath } from '@ffmpeg-installer/ffmpeg';
import { path as ffprobePath } from '@ffprobe-installer/ffprobe';
import ffmpeg from 'fluent-ffmpeg';
import express from 'express';
import { nanoid } from 'nanoid';
import { insertVideo } from '../database.js';
import { DateTime } from 'luxon';
import JWT from '../util/jwt.js';
import { Server } from 'socket.io';
import cors from 'cors';
import http from 'http';
import transcodeVideo from '../util/transcode.js';
import CreateThumbnail from '../util/createThumbnail.js';  // Adjust if `CreateThumbnail` is a default export

const app = express();
const router = express.Router();

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



// Update progress using socketio
//router.post('/transcode', JWT.authenticateToken, async function (req, res) {
io.on("connection", (socket) => {
    // console.log(`User connected: ${socket.id}`)
    socket.on("transcode", async (req) => {
        console.log(req)
        try {
            console.log(req.body);
            console.log(req.body.id)
            fileType = req.body.fileType
            const inputPath = "uploads/" + req.body.id
            const newID = nanoid() + '.' + fileType
            console.log(newID)
            const newPath = "uploads/" + newID

            const err = await transcodeVideo(inputPath, newPath, req.body.resolution, fileType, socket)
            if (err) {
                console.log(err)
                res.status(500).send({ msg: 'Error transcoding video', error: err.message });
            }
            else {


                CreateThumbnail(newID, newPath);
                ffmpeg.ffprobe(newPath, async function (err, metadata) {
                    if (err) {
                        res.status(400).send({ msg: err });
                    }

                    else {
                        const user = JWT.decodeUserToken(req)
                        formattedMetadata = {
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
                            res.status(400).send({ msg: err });
                        }
                        else {
                            console.log(req.body);
                            //console.dir(metadata);
                            console.log("File Uploaded");
                        }
                    }
                })
            }
        }
        catch (err) {
            console.log(err)
            res.status(500).send({ msg: 'Error transcoding video', error: err.message });
        }
    })
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