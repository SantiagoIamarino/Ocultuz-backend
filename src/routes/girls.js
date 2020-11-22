const express = require('express');
const bcrypt = require('bcrypt');
const Girl = require('../models/girl');

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

const jwt = require('jsonwebtoken');
const key = require('../config/vars').key;

const mdAuth = require('../middlewares/auth').verifyToken;
const mdSameUser = require('../middlewares/same-user').verifySameUserOrAdmin;
const mdAdmin = require('../middlewares/admin').verifyRole;

const app = express();

app.get('/', (req, res) => {

    Girl.find({}, '_id previewImage', (err, girls) => {

        if(err) {
            return res.status(500).json({
                ok: false,
                error: err
            })
        }

        return res.status(200).json({
            ok: true,
            girls
        })

    })

})

app.post('/admin', [mdAuth, mdAdmin], (req, res) => { //Get girls by filters

  const filters = req.body;
  const regex = new RegExp( filters.text, 'i' );

  const mongooseFilters = {
    $or:[ {'name':regex}, {'email':regex} ],
    status: filters.status
  }

  Girl.find(mongooseFilters, (err, girls) => {

      if(err) {
          return res.status(500).json({
              ok: false,
              error: err
          })
      }

      return res.status(200).json({
          ok: true,
          girls
      })

  })

})

app.get('/search/:term', (req, res) => {

    const term = req.params.term;
    const regex = new RegExp( term, 'i' );

    Girl.find({name: regex}, (err, girls) => {

        if(err) {
            return res.status(500).json({
                ok: false,
                error: err
            })
        }

        return res.status(200).json({
            ok: true,
            girls
        })

    })

})

function validateContent(contents, user) {
  let contentToShow = [];

  contents.forEach(content => {
    content.allowed = true;

    if(user._id != content.girlId) { // Allow if same girl is requesting

      if(content.usersSubscribed.indexOf(user._id) < 0) { //User isn't subscribed
        delete content.fileUrl;
        content.allowed = false; // Don't show content to user
      }

    }

    contentToShow.push(content);

  });

  return contentToShow;
}

app.get('/:girlId', mdAuth, (req, res) => {

    const girlId = req.params.girlId;

    const contentToRetrive = '_id name description banner previewImage status basicContent products';

    Girl.findById(girlId, contentToRetrive, (err, girl) => {

        if(err) {
            return res.status(500).json({
                ok: false,
                error: err
            })
        }

        if(!girl) {
            return res.status(400).json({
                ok: false,
                message: 'No se ha encontrado ninguna creadora con ese ID'
            })
        }

        girl.products = validateContent(girl.products, req.user);

        return res.status(200).json({
            ok: true,
            girl
        })

    })

})

app.post('/', (req, res) => {
    const body = req.body;

    Girl.findOne({email: body.email}, (err, girlDB) => {
        if(err) {
            return res.status(500).json({
                ok: false,
                error: err
            })
        }

        if(girlDB) {
            return res.status(400).json({
                ok: false,
                message: 'El email ya se encuentra registrado'
            })
        }

        body.password = bcrypt.hashSync(body.password, 10);

        const girl = new Girl(body);

        girl.save((err, girlDB) => {
            if(err) {
                return res.status(500).json({
                    ok: false,
                    error: err
                })
            }

            girlDB.password = '';

            return res.status(201).json({
                ok: true,
                message: 'Te has registrado correctamente',
                girlDB
            })
        })
    })

    
})

function deleteGirlPhoto(photo) {
    const fileName = photo.split('.com/')[1]; // Getting filename
    return new Promise((resolve, reject) => {
        const params = {
            Bucket: "ocultuz",
            Key: fileName
        };
        
        s3.deleteObject(params, (err, data) => {
           if (err) {
            reject(err)
           }else{
            resolve(data);
           }
        });
    })
}

app.put('/:girlId', [mdAuth, mdSameUser], (req, res) => {
    const girl = req.body;
    const girlId = req.params.girlId;

    if(girl.password) {
        girl.password = bcrypt.hashSync(girl.password, 10);
    } else {
      delete girl.password;
    }

    Girl.findById(girlId, async (err, girlDB) => {
        if(err) {
            return res.status(500).json({
                ok: false,
                error: err
            })
        }

        if((girlDB.banner && girl.banner) && girlDB.banner !== girl.banner) {
            await deleteGirlPhoto(girlDB.banner);
        }

        if((girlDB.previewImage && girl.previewImage) && girlDB.previewImage !== girl.previewImage) {
            await deleteGirlPhoto(girlDB.previewImage);
        }

        girlDB.update(girl, (errUpdt, girlUpdated) => {
            if(errUpdt) {
                return res.status(500).json({
                    ok: false,
                    error: errUpdt
                })
            }


            return res.status(200).json({
                ok: true,
                message: 'Creadora modificada correctemente'
            })
        })
        
    })

})

app.delete('/:girlId', [mdAuth, mdSameUser], (req, res) => {
    const girlId = req.params.girlId;

    Girl.findById(girlId, async (err, girlDB) => {
        if(err) {
            return res.status(500).json({
                ok: false,
                error: err
            })
        }

        if(girlDB.banner) {
            await deleteGirlPhoto(girlDB.banner);
        }

        if(girlDB.previewImage) {
            await deleteGirlPhoto(girlDB.previewImage);
        }

        girlDB.basicContent.forEach(async (content) => {
            if(content.fileUrl) {
                await deleteGirlPhoto(content.fileUrl);
            }
        });

        girlDB.products.forEach(async (product) => {
            if(product.fileUrl) {
                await deleteGirlPhoto(product.fileUrl);
            }
        });

        girlDB.delete((errDlt, girlDeleted) => {
            if(errDlt) {
                return res.status(500).json({
                    ok: false,
                    error: errDlt
                })
            }

            return res.status(200).json({
                ok: true,
                message: 'Creadora eliminada correctemente'
            })
        })
    })
})


// Login ----------------------

app.post('/login', (req, res) => {
    const body = req.body;

    Girl.findOne({email: body.email}, (err, girlDB) => {
        if(err) {
            return res.status(500).json({
                ok: false,
                error: err
            })
        }

        if(!girlDB) {
            return res.status(400).json({
                ok: false,
                message: 'El email no se encuentra registrado'
            })
        }

        if(!bcrypt.compareSync(body.password, girlDB.password)) {
            return res.status(400).json({
                ok: false,
                message: 'La contraseña es incorrecta'
            })
        }

        girlDB.password = '';

        const payload = {
            check:  true,
            girl: girlDB
        };

        const token = jwt.sign(payload, key, {
            expiresIn: "3d"
        });

        girlDB.password = '';

        return res.status(200).json({
            ok: true,
            girl: girlDB,
            token
        })
    })
})

module.exports = app;