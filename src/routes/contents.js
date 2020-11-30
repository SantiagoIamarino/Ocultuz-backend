const express = require('express');
const Content = require('../models/content');
const Subscription = require('../models/subscription');
const Girl = require('../models/girl');
const User = require('../models/user');

const mdAuth = require('../middlewares/auth').verifyToken;
const mdSameUser = require('../middlewares/same-user').verifySameUserOrAdmin;

const app = express();

app.get('/:contentId', mdAuth, (req, res) => {
    const contentId = req.params.contentId;

    Content.findById(contentId, (err, contentDB) => {
        if(err) {
            return res.status(500).json({
                ok: false,
                error: err
            })
        }

        if(!contentDB) {
            return res.status(400).json({
                ok: false,
                message: 'No existe un contenido con esa ID'
            })
        }

        if(contentDB.type === 'general') {
            Subscription.findOne({
                girlId: contentDB.girlId,
                userId: req.user._id
            },)
            .exec((subsErr, (subscriptionDB) => {
                if(subsErr) {
                    return res.status(500).json({
                        ok: false,
                        error: subsErr
                    })
                }

                if(!subscriptionDB) {
                    return res.status(400).json({
                        ok: false,
                        message: 'No hay registros de subscripciones'
                    })
                } 

                //Vencimiento verificar ACA--------------------
                // --------------------------------------------

                return res.status(200).json({
                    ok: true,
                    content: contentDB
                })

            }))
        } else {
            if(contentDB.usersSubscribed.indexOf(req.user._id) < 0) {
                return res.status(400).json({
                    ok: false,
                    message: 'No has pagado este contenido'
                })
            }

            return res.status(200).json({
                ok: true,
                content: contentDB
            })
        }

        
    })
})

async function getUsersSubscribed(users) {
  return new Promise((resolve, reject) => {
    const usersToRetrieve = [];

    users.forEach(async (userId, index) => {
      await User.findById(userId, 'name _id email', (err, userDB) => {
        if(err) {
          reject(err);
        } 

        if(!userDB) {
          reject('No hay usuario con esa ID')
        }

        usersToRetrieve.push(userDB);

        if((index + 1) == users.length) {
          resolve(usersToRetrieve);
        }
      })
    });
  })
  
  
}

app.get('/purchased/:girlId', [mdAuth, mdSameUser], (req, res) => {
  const girlId = req.params.girlId;

  Content.find({girlId, type: 'exclusive'}, async (err, contentsDB) => {
    if(err) {
      return res.status(500).json({
        ok: false, 
        error: err
      })
    }

    if(!contentsDB) {
      return res.status(400).json({
        ok: false,
        message: 'Esta creadora no posee contenido exclusivo'
      })
    }

    const contentToRetrieve = [];

    new Promise((resolve, reject) => {
      if(contentsDB.length <= 0) {
        resolve(contentToRetrieve);
      }

      contentsDB.forEach(async (content, index) => {
        if(content.usersSubscribed.length > 0) {
            const usersSubscribed = await getUsersSubscribed(content.usersSubscribed);
            content.usersSubscribed = usersSubscribed;
  
            contentToRetrieve.push(content);
        }

        if((index + 1) == contentsDB.length) {
          resolve(contentToRetrieve);
        }
      });
    }).then((content) => {
      return res.status(200).json({
        ok: true,
        content
      })
    })
  })

} )

app.post('/', mdAuth, (req, res) => {
    const body = req.body;

    if(body.girlId !== req.user._id) {
        return res.status(400).json({
            ok: false,
            message: 'Solo puedes subir contenido para ti'
        })
    }

    const content = new Content(body);

    content.save((err, contentSaved) => {
        if(err) {
            return res.status(500).json({
                ok: false,
                error: err
            })
        }

        Girl.findById(body.girlId, (errGrl, girlDB) => {
            if(errGrl) {
                return res.status(500).json({
                    ok: false,
                    error: errGrl
                })
            }

            if(!girlDB) {
                return res.status(400).json({
                    ok: false,
                    message: 'No existe una creadora con ese ID'
                })
            }

            if(body.type === 'general') {
                girlDB.basicContent.push(content);
            } else {
                girlDB.products.push(content);
            }

            girlDB.update(girlDB, (errUpdt, girlUpdated) => {
                if(errUpdt) {
                    return res.status(500).json({
                        ok: false,
                        error: errUpdt
                    })
                }

                return res.status(200).json({
                    ok: true,
                    message: 'Has subido el contenido correctamente'
                })
            })
        })

    })
})

app.put('/buy/:contentId', mdAuth, (req, res) => {
  const contentId = req.params.contentId;
  const userId = req.user._id;

  Content.findById(contentId, (err, contentDB) => {
    if(err) {
        return res.status(500).json({
            ok: false,
            error: err
        })
    }

    if(!contentDB) {
        return res.status(400).json({
            ok: false,
            message: 'No existe un contenido con esa ID'
        })
    }

    if(contentDB.type === 'exclusive') {
        Subscription.findOne({
            girlId: contentDB.girlId
        })
        .exec((subsErr, subscriptionDB) => {
            if(subsErr) {
                return res.status(500).json({
                    ok: false,
                    error: subsErr
                })
            }

            if(!subscriptionDB) {
                return res.status(400).json({
                    ok: false,
                    message: 'No hay registros de subscripciones'
                })
            } 

            // --------------------------------------------
            //------Verificar vencimiento y pago ACA-------
            // --------------------------------------------

            if(contentDB.usersSubscribed.indexOf(userId) >= 0) {
              return res.status(400).json({
                ok: false,
                message: 'Ya has comprado este contenido'
              })
            }

            contentDB.usersSubscribed.push(userId);

            contentDB.update(contentDB, (errContentUpdt, contentUpdated) => {
              if(errContentUpdt) {
                return res.status(500).json({
                    ok: false,
                    error: errContentUpdt
                })
              }

              Girl.findById(contentDB.girlId, (errGrl, girlDB) => {
                if(errGrl) {
                  return res.status(500).json({
                      ok: false,
                      error: errGrl
                  })
                }

                if(!girlDB){
                  return res.status(400).json({
                      ok: false,
                      message: 'No existe creadora con ese ID'
                  })
                }

                if(contentDB.type == 'general') {
                  let contentToUpdateIndex = girlDB.basicContent.findIndex(content => {
                    return content._id == contentDB._id;
                  })

                  girlDB.basicContent[contentToUpdateIndex] = contentDB;
                } else {
                  let contentToUpdateIndex = girlDB.products.findIndex(content => {
                    return (content._id.toString()) == (contentDB._id.toString());
                  })

                  girlDB.products[contentToUpdateIndex] = contentDB;
                }

                girlDB.update(girlDB, (girlUpdtErr, girlUpdated) => {
                  if(girlUpdtErr) {
                    return res.status(500).json({
                        ok: false,
                        error: girlUpdtErr
                    })
                  }

                  return res.status(200).json({
                      ok: true,
                      message: 'Has comprado este contenido correctamente'
                  })
                })

              })
            })

        })
    } else {
        return res.status(400).json({
          ok: false,
          message: 'El contenido general no puede comprarse por separado'
        })
    }
  })
})

module.exports = app;
