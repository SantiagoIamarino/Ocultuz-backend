const express = require('express');
const bcrypt = require('bcrypt');
const Girl = require('../models/girl');
const User = require('../models/user');
const Purchase = require('../models/purchase');
const Content = require('../models/content');
const Subscription = require('../models/subscription');
const Verification = require('../models/verification');

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
const girl = require('../models/girl');
const key = require('../config/vars').key;

const mdAuth = require('../middlewares/auth').verifyToken;
const mdSameUser = require('../middlewares/same-user').verifySameUserOrAdmin;
const mdAdmin = require('../middlewares/admin').verifyRole;

const app = express();

app.get('/', (req, res) => {

    Girl.find({}, '_id previewImage nickname status', (err, girls) => {

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

app.post('/admin', (req, res) => { //Get girls by filters

  const filters = req.body.filters;
  const regex = new RegExp( filters.text, 'i' );

  let mongooseFilters = {};

  if(filters.status !== 'ACTIVE') {
    mongooseFilters = {
        $or:[ {'name':regex}, {'email':regex} ],
        status: filters.status
    }
  } else {
    mongooseFilters = {
        $or:[ {'name':regex}, {'email':regex} ],
        $or:[ {'status':'ACTIVE'}, {'status':'PENDING'} ],
    }
  }

  const page = parseInt(req.body.pagination.page);
  const perPage = parseInt(req.body.pagination.perPage);

  Girl.find(mongooseFilters)
  .skip((page - 1) * perPage)
  .limit(perPage)
  .exec((err, girls) => {

      if(err) {
          return res.status(500).json({
              ok: false,
              error: err
          })
      }

      Girl.count(mongooseFilters, (errCount, total) => {
          return res.status(200).json({
            ok: true,
            girls,
            pagination: {
              total,
              currentPage: page,
              lastPage: Math.ceil(total / perPage)
            }
          })
      })
  })

})

app.get('/search/:term', (req, res) => {

    const term = req.params.term;
    const regex = new RegExp( term, 'i' );

    Girl.find({nickname: regex}, (err, girls) => {

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

function validateContent(content, user) {
  return new Promise((resolve, reject) => {

    content.allowed = true;
      
    if(user._id != content.girlId) { // Allow if same girl is requesting
        Purchase.findOne({
            contentId: content._id,
            userId: user._id
        }, (err, contentDB) => {
            if(err) {
                reject(err);
            }

            if(!contentDB || contentDB.pending) { // Don't show content to user
                content.fileUrl = '';
                content.allowed = false;
            }

            resolve(content);
        })

    } else {
        resolve(content);
    }
  })
  
}

app.post('/get-basic-content/:girlId', mdAuth, (req, res) => {
    const girlId = req.params.girlId;
    const perPage = req.body.perPage;
    const page = req.body.page;

    if(req.user._id != girlId) { //Another user
        Subscription.findOne({ // Validating subscription
            girlId,
            userId: req.user._id
          }, async (errSubs, subscriptionDB) => {
    
            if(errSubs) {
                return res.status(500).json({
                    ok: false,
                    error: errSubs
                })
            }
    
            if(!subscriptionDB && req.user.role !== 'ADMIN_ROLE') {
              return res.status(400).json({
                    ok: false,
                    message: 'No te encuentras subscripto a esta creadora'
              }) 
            }

            if(subscriptionDB) {
                const now = new Date();
                const subscriptionEnding = new Date(subscriptionDB.nextPaymentDueDate);
                console.log(now, subscriptionEnding);

                if(now >= subscriptionEnding && false) {

                    subscriptionDB.delete((errDlt, subscriptionDeleted) => {
                        if(errDlt) {
                            return res.status(500).json({
                                ok: false,
                                error: errDlt
                            }) 
                        }

                        return res.status(400).json({
                            ok: false,
                            message: 'Tu subscripción ha caducado'
                        })
                    })
                }
            }

            
            Content.find({
                girlId: girlId,
                type: 'general'
            })
            .skip((perPage * page) - perPage)
            .limit(perPage * page)
            .exec((errCont, contentsDB) => {
                if(errCont) {
                    return res.status(500).json({
                        ok: false,
                        error: errCont
                    })
                }

                Content.count({
                    girlId: girlId,
                    type: 'general'
                }, (errCount, basicTotal) => {
        
                    return res.status(200).json({
                        ok: true,
                        basicContent: contentsDB,
                        basicTotal
                    })
                })
                
            })

        })
    } else { // Same user (owner of her content)
        Content.find({
            girlId: girlId,
            type: 'general'
        })
        .skip((perPage * page) - perPage)
        .limit(perPage * page)
        .exec((errCont, contentsDB) => {
            if(errCont) {
                return res.status(500).json({
                    ok: false,
                    error: errCont
                })
            }

            Content.count({
                girlId: girlId,
                type: 'general'
            }, (errCount, basicTotal) => {
                return res.status(200).json({
                    ok: true,
                    basicContent: contentsDB,
                    basicTotal
                })
            })
        })
    } 
})

app.post('/get-exclusive-content/:girlId', mdAuth, (req, res) => {
    const girlId = req.params.girlId;
    const perPage = req.body.perPage;
    const page = req.body.page;

    Subscription.findOne({
        girlId,
        userId: req.user._id
      }, async (errSubs, subscriptionDB) => {

        if(errSubs) {
            return res.status(500).json({
                ok: false,
                error: errSubs
            })
        }

        if(!subscriptionDB && req.user.role !== 'ADMIN_ROLE') {
          return res.status(400).json({
              ok: false,
              message: 'No te encuentras subscripto a esta creadora'
            })
        }

        Purchase.find({
            girlId: girlId,
            userId: req.user._id,
            type: 'product',
            contentType: { $ne: 'subscription' },
            pending: false
        })
        .skip((perPage * page) - perPage)
        .limit(perPage * page)
        .exec((errCont, contentsDB) => {
            if(errCont) {
                return res.status(500).json({
                    ok: false,
                    error: errCont
                })
            }

            Purchase.count({
                girlId: girlId,
                userId: req.user._id,
                type: 'product',
                pending: false
            }, (errCount, tipsTotal) => {
                return res.status(200).json({
                    ok: true,
                    tips: contentsDB,
                    tipsTotal
                })
            })
        })

      })
})

app.get('/:girlId', [mdAuth, mdSameUser], (req, res) => {
  const girlId = req.params.girlId;

  Girl.findById(girlId, (err, girlDB) => {
    if(err) {
      return res.status(500).json({
        ok: false,
        error: err
      })
    }

    if(!girlDB) {
        return res.status(400).json({
            ok: false,
            message: 'No existe esta creadora'
        })
    }

    girlDB.password = '';
    girlDB.basicContent = null;
    girlDB.products = null;

    return res.status(200).json({
      ok: true,
      girl: girlDB
    })
  })
})

app.get('/profile/:girlNickname', mdAuth, (req, res) => {
    const girlNickname = req.params.girlNickname;

    const contentToRetrieve = '_id nickname description status banner previewImage identityVerified tips paypalAccount';
  
    Girl.findOne({nickname: girlNickname}, contentToRetrieve, (err, girlDB) => {
      if(err) {
        return res.status(500).json({
          ok: false,
          error: err
        })
      }
  
      if(!girlDB) {
          return res.status(400).json({
              ok: false,
              message: 'No existe esta creadora'
          })
      }
  
      girlDB.password = '';
      girlDB.basicContent = null;
      girlDB.products = null;
  
      return res.status(200).json({
        ok: true,
        girl: girlDB
      })
    })
  })

app.post('/', (req, res) => {
    const body = req.body;
    User.findOne({email: body.email}, (errUsr, userDB) => {
        if(errUsr) {
            return res.status(500).json({
                ok: false,
                error: errUsr
            })
        }

        if(userDB) {
            return res.status(400).json({
                ok: false,
                message: 'El email ya se encuentra registrado'
            })
        }

        Girl.findOne({
            $or: [ { email: body.email }, { nickname: body.nickname} ] 
        }, (err, girlDB) => {
            if(err) {
                return res.status(500).json({
                    ok: false,
                    error: err
                })
            }
    
            if(girlDB) {
                return res.status(400).json({
                    ok: false,
                    message: 'El email o nombre de usuario ya se encuentra registrado'
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

            Verification.findOneAndDelete({girl: girlDB._id}, (errDelVer, verificationDeleted) => {
                return res.status(200).json({
                    ok: true,
                    message: 'Creadora eliminada correctemente'
                })
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
                message: 'Las credenciales son incorrectas'
            })
        }

        if(!girlDB.emailVerified) {
            return res.status(400).json({
                ok: false,
                message: 'Tu email no se ha verificado aún, revisa tu correo'
            })
        }

        if(!bcrypt.compareSync(body.password, girlDB.password)) {
            return res.status(400).json({
                ok: false,
                message: 'Las credenciales son incorrectas'
            })
        }

        girlDB.password = '';

        const girlToReturn = {
            role: girlDB.role,
            _id: girlDB._id,
            nickname: girlDB.nickname,
            subscriptions: girlDB.subscriptions,
            adminRole: girlDB.adminRole
        }

        const payload = {
            check:  true,
            girl: girlToReturn
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

// Register Verification
app.post('/verification', (req, res) => {
    const girlEmail = req.body.email;
    const girlUrl = req.body.image;

    Girl.findOne({email: girlEmail}, (err, girlDB) => {
        if(err) {
            return res.status(500).json({
                ok: false,
                error: err
            })
        }

        if(!girlDB) {
            return res.status(400).json({
                ok: false,
                message: 'No existe esta creadora'
            })
        }

        const verification = new Verification({
            girl: girlDB._id,
            url: girlUrl
        })

        verification.save((errVer, verificationSaved) => {
            if(errVer) {
                return res.status(500).json({
                    ok: false,
                    error: errVer
                })
            }

            return res.status(200).json({
                ok: true
            });
        })
    })
})

app.post('/verifications', [mdAuth, mdAdmin], (req, res) => {

    const page = parseInt(req.body.page);
    const perPage = parseInt(req.body.perPage);
    let mongooseFilters = {};

    if(req.body.verified !== 'all') {
        mongooseFilters.verified = (req.body.verified == 'verified') ? true : false;
    }
  
    Verification.find(mongooseFilters)
    .skip((page - 1) * perPage)
    .limit(perPage)
    .populate('girl')
    .exec((err, verifications) => {
        if(err) {
            return res.status(500).json({
                ok: false,
                error: err
            })
        }

        Verification.count({}, (errCount, total) => {
            return res.status(200).json({
                ok: true,
                verifications,
                total
            })
        })
    })
})

app.post('/verifications/verify-girl', [mdAuth, mdAdmin], (req, res) => {
    const verificationId = req.body.verificationId;

    Verification.findById(verificationId, (err, verificationDB) => {
        if(err) {
            return res.status(500).json({
                ok: false,
                error: err
            })
        }

        if(!verificationDB) {
            return res.status(400).json({
                ok: false,
                message: 'No existe una verificación con ese ID'
            })
        }

        verificationDB.verified = true;

        verificationDB.update(verificationDB, (errVer, verificationUpdated) => {
            if(errVer) {
                return res.status(500).json({
                    ok: false,
                    error: errVer
                })
            }

            return res.status(200).json({
                ok: true
            })
        })
    })
})

app.delete('/verification/:verificationId', [mdAuth, mdAdmin], (req, res) => { 
  const verificationId = req.params.verificationId;

  Verification.findById(verificationId, (err, verificationDB) => {
    if(err) {
      return res.status(500).json({
        ok: true,
        error: err
      })
    }

    if(!verificationDB) {
      return res.status(400).json({
        ok: false,
        message: 'No existe una verificación con es ID'
      })
    }

    verificationDB.delete(async (errDelete, verificationDeleted) => {
      if(errDelete) {
        return res.status(500).json({
          ok: true,
          error: errDelete
        })
      }

      await deleteGirlPhoto(verificationDB.url);

      return res.status(200).json({
        ok: true,
        message: 'Registro eliminado correctamente'
      })
    })
  })
})

module.exports = app;