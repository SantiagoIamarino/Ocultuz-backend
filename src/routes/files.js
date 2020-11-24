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

const allowedExtensions = ['jpg', 'jpeg', 'png', 'jfif', 'gif', 'svg', 'mp4', 'mov', 'avi', 'webm', 'wmv', 'flw'];

const app = express();

app.post('/', (req, res) => {

  const upload = multer({
    storage: multerS3({
      s3: s3,
      bucket: 'ocultuz',
      acl: 'public-read',
      key: (request, file, cb) => {
        let fileName = file.originalname;
        const fileNameSplitted = fileName.split('.');
        const extension = fileNameSplitted[fileNameSplitted.length - 1];

        if(allowedExtensions.indexOf(extension) < 0) {
            cb('La extension no es valida');
            return;
        }

        fileName = `${new Date().getTime()}_${fileName}`;

        req.fileName = fileName;

        cb(null, fileName);
      }
    })
  }).array('upload', 1);

  upload(req, res, (err) => {
      if (err) {
          return res.status(500).json({
              ok: false,
              error: err
          })
      }

      const url = `https://ocultuz.nyc3.digitaloceanspaces.com/${req.fileName}`;

      return res.status(200).json({
          ok: true,
          message: 'Archivo subido correctamente',
          url
      })
  });
})

module.exports = app;