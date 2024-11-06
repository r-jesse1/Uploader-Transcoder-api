import createError from "http-errors";
import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import { handleIncompleteTranscodes } from './util/transcode.js';
import usersRouter from "./routes/users.js";
import videoRouter from "./routes/video.js";
import streamRouter from "./routes/stream.js";
import uploadRouter from "./routes/upload.js";
import transcodeRouter from "./routes/transcode.js";

import RateLimit from "express-rate-limit";

const app = express();
const limiter = RateLimit({
  windowMs: 1 * 10 * 1000, // 10 seconds
  max: 500,
});

// Apply rate limiter to all requests
app.use(limiter);

// Allow requests from any origin
app.use(cors());


app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
const version = "/v1"
app.use(version + "/users", usersRouter);
app.use(version + "/video", videoRouter);
app.use(version + "/stream", streamRouter);
app.use(version + "/upload", uploadRouter);
app.use(version + "/transcode", transcodeRouter);



// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404, 'Endpoint not found'));
});

app.use(function (err, req, res, next) {
  // Log 500 Internal Server Errors
  if (err.status === 500 || !err.status) {
    console.error("Internal Server Error:", err);
  }

  // If the error doesn't have a status, default to 500
  const status = err.status || 500;

  // Send the error response
  res.status(status).json({
    error: {
      status: status,
      message: err.message
    },
  });
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.json(err);
});

// Run during startup
//handleIncompleteTranscodes();



export default app;
