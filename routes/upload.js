// Upload source: https://medium.com/@ayushnandanwar003/video-transcoding-in-node-js-saving-videos-in-multiple-resolutions-0ad8e6217d8c

import { path as ffmpegPath } from '@ffmpeg-installer/ffmpeg';
import { path as ffprobePath } from '@ffprobe-installer/ffprobe';
import ffmpeg from 'fluent-ffmpeg';
import express from 'express';
import multer from 'multer';
import path from 'path';
import { nanoid } from 'nanoid';
import { insertVideo } from '../database.js';
import { DateTime } from 'luxon';
import JWT from '../util/jwt.js';
import { CreateUploadThumbnail } from '../util/createThumbnail.js';  // Adjust import if CreateThumbnail is a default export
import fs from 'fs';
import * as S3 from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';


const router = express.Router();

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);


//require("dotenv").config();

//const S3Presigner = require("@aws-sdk/s3-request-presigner");
const bucketName = 'n11411911-assessment'




const s3Client = new S3.S3Client({ region: 'ap-southeast-2' });

const storage = multer.diskStorage({
    destination: './uploads/',
    filename: function (req, file, cb) {
        cb(null, nanoid() + path.extname(file.originalname));
    }
});

// Init upload
const upload = multer({
    storage: storage,
    limits: { fileSize: 1000000000 }, // Limit file size to 1000MB
    fileFilter: function (req, file, cb) {
        checkFileType(file, cb);
    }
}).single('video');

// Check file type
function checkFileType(file, cb) {
    // Allowed file extensions
    const filetypes = /mp4|mov|avi|mkv/;
    // Check extension
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    // Check mime type
    const mimetype = filetypes.test(file.mimetype);

    if (mimetype && extname) {
        return cb(null, true);
    } else {
        cb('Error: Videos Only!');
    }
}


router.post('/', JWT.authenticateToken, async (req, res) => {
    let user = req.user["cognito:username"];
    const uploadID = nanoid();
    const progressID = nanoid();
    const newID = nanoid();
    const fileKey = `uploads/${uploadID}`;
    let privateVal = "false";
    if (req.body.private) {
        privateVal = "true"
    }
    try {
        // Generate a presigned URL with user metadata
        const url = await getSignedUrl(
            s3Client,
            new S3.PutObjectCommand({
                Bucket: bucketName,
                Key: fileKey,
                ContentType: req.body.contentType,
                Metadata: {
                    user: user,
                    private: privateVal,
                    name: req.body.name,
                    id: uploadID,
                    progressID: progressID,
                    newID: newID,
                    new: "true"
                }
            }),
            { expiresIn: 3600 }
        );

        res.status(200).json({ url, key: fileKey });
    } catch (err) {
        console.error("Error generating presigned URL", err);
        res.status(500).send({ msg: "Could not generate presigned URL" });
    }
});

// const jobMessage = {
//     id: req.body.id,
//     progressID: progressID,
//     s3input: s3input,
//     s3vidOutput: s3vidOutput,
//     s3thumbOutput: s3thumbOutput,
//     resolution: req.body.resolution,
//     fileType: fileType,
//     user: user,
//     newID: newID,
//     private: req.body.private,
//     name: req.body.name
// };



















router.post('/', JWT.authenticateToken, (req, res) => {
  let user = req.user["cognito:username"];

    console.log(res.body);
    console.log("videos is running")
    upload(req, res, async (err) => {
        if (err) {
            console.log(err)
            res.status(400).send({ msg: err });
        } else {
            if (req.file == undefined) {
                res.status(400).send({ msg: 'No file selected!' });
            } else {

                const inputPath = req.file.path;
                try {
                    const response = await s3Client.send(
                        new S3.PutObjectCommand({
                            Bucket: bucketName,
                            Key: "videos/" + req.file.filename, 
                            Body: fs.createReadStream(inputPath)
                        })
                    );
                    console.log(response);
                } catch (err) {
                    console.log(err);
                }


                try {
                    await CreateUploadThumbnail(req.file.filename, inputPath)
                    .then(_ => {
                        return s3Client.send(
                            new S3.PutObjectCommand({
                                Bucket: bucketName,
                                Key: "thumbnails/" + req.file.filename + ".png", 
                                Body: fs.createReadStream("./thumbnails/" + req.file.filename + ".png"),
                                contentType:  "image/png"
                            })
                        );
                        })
                        .then(response => console.log(response))
                } catch (err) {
                    console.log(err);
                }
                ffmpeg.ffprobe(inputPath, async function (err, metadata) {
                    if (err) {
                        res.status(400).send({ msg: err });
                    }
                    else {
                        let formattedMetadata = {
                            ID: req.file.filename,
                            name: req.body.name,
                            owner: user,
                            resolution: Math.min(metadata.streams[0].width, metadata.streams[0].height),
                            uploadDate: DateTime.now().toFormat('yyyy-MM-dd'),
                            private: ((req.body.private === 'false') ? false : true),
                            size: metadata.format.size / 1048576,
                            length: Math.floor(metadata.format.duration),
                            fileType: path.extname(inputPath)
                        }
                        console.log(formattedMetadata)
                        try {
                            let err = await insertVideo(formattedMetadata);
                            fs.unlink(inputPath, (err) => {
                                if (err) {
                                  console.error(`Failed to delete video file: ${err}`);
                                } else {
                                  console.log("Video file deleted.");
                                }
                              });
                    
                              fs.unlink("./thumbnails/" + req.file.filename + ".png", (err) => {
                                if (err) {
                                  console.error(`Failed to delete thumbnail file: ${err}`);
                                } else {
                                  console.log("Thumbnail file deleted.");
                                }
                              });

                            if (err) {
                                res.status(400).send({ msg: err });
                            } else {
                                console.log(req.body);
                                console.log("File Uploaded");
                                res.status(200).send({ msg: "File Uploaded" });
                            }
                        } catch (err) {
                            console.error("Error during video insert:", err);
                            res.status(500).send({ msg: "Internal server error" });
                        }
                    }
                })
            }
        }
    })
})

export default router;
