import * as S3 from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Upload } from "@aws-sdk/lib-storage";
import fs from 'fs';
import tmp from 'tmp';

const bucketName = 'n11411911-assessment'

const s3Client = new S3.S3Client({ region: 'ap-southeast-2' });

const getThumbnailURL = async (data) => {
    let id = 'thumbnails/' + data.ID + '.png';
    try {
        const command = new S3.GetObjectCommand({
                Bucket: bucketName,
                Key: id,
            });
        const presignedURL = await getSignedUrl(s3Client, command, {expiresIn: 3600} );
        data.thumbnail = presignedURL;
        return data
    } catch (err) {
        console.log(err);
    }
    }


async function addThumbnails(metadata) {
    const promiseArray = metadata.map((data) => {
      return getThumbnailURL(data);
    })
    const result = await Promise.all(promiseArray);
    return result
  }



const getVideoURL = async (data) => {
    let id = 'videos/' + data.ID;
    try {
        const command = new S3.GetObjectCommand({
                Bucket: bucketName,
                Key: id,
            });
        const presignedURL = await getSignedUrl(s3Client, command, {expiresIn: 3600} );
        data.url = presignedURL;
        return data
    } catch (err) {
        console.log(err);
    }
    }


const deleteVideo = async (data) => {
    console.log("deletedata : " + data)
    const vidParams = {
        Bucket: bucketName,
        Key: "videos/" + data
}
const imageParams = {
    Bucket: bucketName,
    Key: "thumbnails/" + data + ".png"
}
    // Delete video
    try {
        await s3Client.send(new S3.HeadObjectCommand(vidParams));  // Check if the file exists
        console.log("File Found in S3");
        try {
            await s3Client.send(new S3.DeleteObjectCommand(vidParams));  // Delete the video file
            console.log("file deleted Successfully");
        } catch (err) {
            console.log("ERROR in file Deleting : " + JSON.stringify(err));
        }
    } catch (err) {
        console.log("File not Found ERROR : " + err.code);
    }

    // Delete thumbnail
    try {
        await s3Client.send(new S3.HeadObjectCommand(imageParams));  // Check if the thumbnail exists
        console.log("File Found in S3");
        try {
            await s3Client.send(new S3.DeleteObjectCommand(imageParams));  // Delete the thumbnail
            console.log("file deleted Successfully");
        } catch (err) {
            console.log("ERROR in file Deleting : " + JSON.stringify(err));
        }
    } catch (err) {
        console.log("File not Found ERROR : " + err.code);
    }
};


async function getVideoStream(id) {
    try {
      const command = new S3.GetObjectCommand({ Bucket: bucketName, Key: id });
      const response = await s3Client.send(command);
      return response.Body; // Return the video as a stream
    } catch (err) {
      console.error("Error getting video from S3:", err);
      throw err;
    }
  }

  async function getVideoToTempFile(id) {
    const tempFile = tmp.fileSync({ postfix: '.mp4' });

    try {
        const command = new S3.GetObjectCommand({ Bucket: bucketName, Key: id });
        const response = await s3Client.send(command);
        const writeStream = fs.createWriteStream(tempFile.name);
        response.Body.pipe(writeStream);

        return new Promise((resolve, reject) => {
            writeStream.on('finish', () => resolve(tempFile.name));
            writeStream.on('error', (err) => {
                console.error("Error writing to temporary file:", err);
                reject(err);
            });
        });
    } catch (err) {
        console.error("Error getting video from S3:", err);
        throw err;
    }
}








  async function uploadStream(stream, id) {
  try {
    const upload = new Upload({
      client: s3Client,
      params: {
        Bucket: bucketName,
        Key: id,
        Body: stream,
        //ContentType: contentType,
      },
    });

    // Start the upload and wait for it to complete
    await upload.done();

    console.log(`Transcoded ${id} uploaded successfully`);
  } catch (err) {
    console.error("Error uploading video to S3:", err);
    throw err;
  }
}



export { getThumbnailURL, addThumbnails, getVideoURL, deleteVideo, getVideoStream, uploadStream, getVideoToTempFile };