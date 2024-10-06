

import jwt from "jsonwebtoken";
import { path as ffmpegPath } from '@ffmpeg-installer/ffmpeg';
import { path as ffprobePath } from '@ffprobe-installer/ffprobe';
import ffmpeg from 'fluent-ffmpeg';
import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { nanoid } from 'nanoid';
import { insertVideo, getVideoDataByID, getPublicVideos, getPrivateVideos, deleteVideoDataByID } from '../database.js';
import { DateTime } from 'luxon';
import url from 'url';
import querystring from 'querystring';
import { body } from 'express-validator';
import JWT from '../util/jwt.js';
import { Server } from 'socket.io';
import cors from 'cors';
import http from 'http';
import CreateThumbnail from '../util/createThumbnail.js';
import { addThumbnails, getVideoURL, deleteVideo } from '../controllers/S3Controller.js';
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";
const app = express();
const router = express.Router();
const PORT = process.env.PORT || 3000;

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

app.use(cors());


router.get('/metadata', (req, res) => {
  let id = req.query.id;
  getVideoDataByID(id).then(async metadata => {
      const data = await getVideoURL(metadata);

    if (metadata.private) {
      console.log("inside private")
      const user = JWT.decodeUserToken(req)
      
      if (user !== metadata.owner) {
        console.log("inside auth")
        res.status(401).send({
          msg: "Unauthorized"
        });
        return
      }
    }

    res.status(200).send({
      data
    });
  })


});


router.get('/public', (req, res) => {
  let sort = req.query.sort;
  let search = req.query.search;

  if (!sort) {
    sort = "name";
  }
  if (!search) {
    search = null;
  }

  getPublicVideos(sort, search)
    .then(async data => {
      const newData = await addThumbnails(data);
      //console.log(`data_1 is : ${JSON.stringify(data_1)}`);
      return newData;
    })
    .then(data => {
      //console.log(`data is : ${JSON.stringify(data)}`);
      res.status(200).send({
        data
      });
    })
    .catch(error => {
      console.error('Error fetching public videos:', error);
      res.status(500).send({ error: 'An error occurred while fetching public videos' });
    });
});

router.get('/private', JWT.authenticateToken, (req, res) => {
  let user = req.user["cognito:username"];
  getPrivateVideos(user)
    .then(async data => {
      const newData = await addThumbnails(data);
      return newData;
    })
    .then(data => {
      res.status(200).send({
        data
      });
    })
    .catch(error => {
      console.error('Error fetching private videos:', error);
      res.status(500).send({ error: 'An error occurred while fetching private videos' });
    });
});



router.get('/thumbnail', (req, res) => {
  let id = 'thumbnails/' + req.query.id;
  // imagePath = path.join(__dirname, '..', 'thumbnails', id)
  getThumbnailURL(id).then(url => {
    console.log(url);
    res.status(200).send({
      url
    });
  })
});

router.delete('/', JWT.authenticateToken, (req, res) => {
  console.log("DELETING FILE")
  let user = req.user["cognito:username"];
  let groups = req.user["cognito:groups"] || [];
  let id = req.query.id;
  console.log(`id: ${id}`)
  console.log(`groups: ${groups}`);
  // let videoPath = path.join(__dirname, '..', 'uploads', id)
  // let imagePath = path.join(__dirname, '..', 'thumbnails', id + ".png",)
  console.log(user)
  getVideoDataByID(id).then(metadata => {
    console.log(`user: ${user}`)
    console.log(`metadata: ${metadata.owner}`)
    if (user !== metadata.owner && !groups.includes('Admin')) {
      console.log("inside auth")
      res.status(401).send({
        msg: "Unauthorized"
      });
      return
    }
    try {
    deleteVideoDataByID(id).then(_ => { // Metadata
      deleteVideo(id) // S3
      res.status(200).send({
        msg: "video deleted"
      });
    })
  } catch (err) {
    res.status(400).send({
      msg: err
    });
  }
  });
})









export default router;