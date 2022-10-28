const express = require("express");
const AWS = require("aws-sdk");
const multer = require("multer");
const multerS3 = require("multer-s3");

const spacesEndpoint = new AWS.Endpoint("nyc3.digitaloceanspaces.com");

const s3 = new AWS.S3({
  endpoint: spacesEndpoint,
  accessKeyId: process.env.SPACES_KEY,
  secretAccessKey: process.env.SPACES_SECRET,
});

const allowedExtensions = [
  "jpg",
  "jpeg",
  "png",
  "jfif",
  "gif",
  "svg",
  "mp4",
  "asf",
  "avi",
  "wmv",
  "webm",
  "mp3",
  "flac",
  "wav",
  "aiff",
  "au",
  "wma",
  "mid",
  "midi",
  "mov",
  "m4v",
  "m4a",
  "wave",
  "bwf",
  "bmp",
  "tif",
];

const app = express();

const limit = 26843545600; // 25MB

app.post("/", (req, res) => {
  let fileName = req.files.upload.name;
  const fileNameSplitted = fileName.split(".");
  const extension = fileNameSplitted[fileNameSplitted.length - 1];

  if (allowedExtensions.indexOf(extension) < 0) {
    let message = "La extension no es valida";

    if (req.files.upload.mimetype.indexOf("audio") >= 0) {
      message = "Sólo se admiten archivos de audio .wav, .mp3 o .flac";
    }

    return res.status(400).json({
      ok: false,
      message,
    });
  }

  fileName = `${new Date().getTime()}_${fileName}`;

  const params = {
    Bucket: "ocultuz",
    Key: fileName,
    Body: req.files.upload.data,
    ACL: "public-read",
  };

  s3.putObject(params, function (err, data) {
    if (err) {
      return res.status(500).json({
        ok: false,
        error: err,
      });
    }

    const url = `https://ocultuz.nyc3.digitaloceanspaces.com/${fileName}`;

    return res.status(200).json({
      ok: true,
      message: "Archivo subido correctamente",
      url,
    });
  });
});

module.exports = app;
