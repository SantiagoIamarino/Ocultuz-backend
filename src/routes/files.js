const express = require('express');
const AWS = require('aws-sdk');
const multer = require('multer');
const multerS3 = require('multer-s3');

const spacesEndpoint = new AWS.Endpoint('nyc3.digitaloceanspaces.com');

process.env.SPACES_KEY = "PKUGPKZX5KPU3ESW4GUK";
process.env.SPACES_SECRET = "leocn1edNgznf7nzAQ3TQ697pCG+gRAsHgabJXtEGVY";

const s3 = new AWS.S3({
    endpoint: spacesEndpoint,
    accessKeyId: process.env.SPACES_KEY,
    secretAccessKey: process.env.SPACES_SECRET
});

const allowedExtensions = ['jpg', 'jpeg', 'png', 'jfif', 'gif', 'svg', 'mp4', 'webm', 'mp3' ,'ogg', 'flac', 'acc'];

const app = express();

const limit = 26843545600; // 25MB

app.post('/', (req, res) => {

  let fileName = req.files.upload.name;
  const fileNameSplitted = fileName.split('.');
  const extension = fileNameSplitted[fileNameSplitted.length - 1];

  if(allowedExtensions.indexOf(extension) < 0) {
        return res.status(400).json({
          ok: false,
          message: "La extension no es valida"
      })
  }

  fileName = `${new Date().getTime()}_${fileName}`;

  const params = {
    Bucket: "ocultuz",
    Key: fileName,
    Body: req.files.upload.data,
    ACL: "public-read"
  };

  s3.putObject(params, function(err, data) {
    if (err) {
        return res.status(500).json({
            ok: false,
            error: err
        })
    }

    const url = `https://ocultuz.nyc3.digitaloceanspaces.com/${fileName}`;

    return res.status(200).json({
        ok: true,
        message: 'Archivo subido correctamente',
        url
    })
  });
})

module.exports = app;