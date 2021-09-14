const express = require('express');
const Content = require('../models/content');
const Purchase = require('../models/purchase');
const Subscription = require('../models/subscription');
const Girl = require('../models/girl');
const User = require('../models/user');

const mdAuth = require('../middlewares/auth').verifyToken;
const mdSameUser = require('../middlewares/same-user').verifySameUserOrAdmin;

const config = require('../config/vars');

const mercadopago = require('mercadopago');
mercadopago.configure({
    access_token: config.mpAccessToken
});

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

//Pending contents

app.get('/pending/notification/:girlId', [mdAuth, mdSameUser], (req, res) => {
  const girlId = req.params.girlId;

  Purchase.count({
    type: 'product',
    contentType: { $ne: 'subscription' },
    hasBeenSent: false,
    girlId,
    pending: false
  }, (err, notificationTotals) => {
    if(err) {
      return res.status(500).json({
        ok: false,
        error: err
      })
    }

    return res.status(200).json({
      ok: true,
      notifications: notificationTotals
    })
  })
})

app.post('/pending/:girlId', [mdAuth, mdSameUser], (req, res) => {
  const girlId = req.params.girlId;
  const limit = req.body.limit;
  const page = req.body.page;

  const mongooseFilters = {
    type: 'product',
    contentType: { $ne: 'subscription' },
    hasBeenSent: false,
    girlId,
    pending: false
  };

  Purchase.find(mongooseFilters)
  .skip(page * limit - limit)
  .limit(limit)
  .populate('userId')
  .exec((err, contents) => {
    if(err) {
      return res.status(500).json({
        ok: false,
        error: err
      })
    }

    Purchase.count(mongooseFilters , (errCount, notificationTotals) => {
      if(errCount) {
        return res.status(500).json({
          ok: false,
          error: errCount
        })
      }

      return res.status(200).json({
        ok: true,
        total: notificationTotals,
        contents
      })
    })
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

app.post('/purchased/:girlId', [mdAuth, mdSameUser], (req, res) => {
  const girlId = req.params.girlId;

  const mongooseFilters = {
    girlId,
    type: 'product'
  }

  if(req.body.filter && req.body.filter.from && req.body.filter.to) {
    mongooseFilters.$and = [
      { date: { $gte: req.body.filter.from } },
      { date: { $lte: req.body.filter.to } }
    ];
  }

  Purchase.find(mongooseFilters)
  .populate('contentId') 
  .populate('userId') 
  .exec((err, purchasesDB) => {
    if(err) {
      return res.status(500).json({
        ok: false,
        error: err
      })
    }

    return res.status(200).json({
      ok: true,
      content: purchasesDB
    })
  })

} )

app.post('/add', mdAuth, (req, res) => {
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
                if(!girlDB.basicContent) {
                    girlDB.basicContent = [];
                }

                girlDB.basicContent.push(content);
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

app.post('/add-exclusive/:girlId', [mdAuth, mdSameUser], (req, res) => {
  const fileUrl = req.body.fileUrl;
  const girlId = req.params.girlId;
  const userId = req.body.userId;
  const contentId = req.body.contentId;

  Purchase.findOne({
    girlId,
    userId,
    _id: contentId,
    hasBeenSent: false
  }, (err, purchaseDB) => {
    if(err) {
      return res.status(500).json({
        ok: false,
        error: err
      })
    }

    if(!purchaseDB) {
      return res.status(400).json({
        ok: false,
        message: 'No existe una compra que coincida'
      })
    }

    if(!fileUrl) {
      return res.status(400).json({
        ok: false,
        message: 'Se debe subir un archivo válido'
      })
    }

    purchaseDB.hasBeenSent = true;
    purchaseDB.contentUrl = fileUrl;

    purchaseDB.update(purchaseDB, (errUpdt, purchaseUpdated) => {
      if(errUpdt) {
        return res.status(500).json({
          ok: false,
          error: errUpdt
        })
      }

      return res.status(200).json({
        ok: true,
        message: 'Archivo enviado correctamente'
      })
    })

  })
})

function validateContent(girlDB, contentType) {
  let isValid = true;

  if(!girlDB.tips) {
    return false;
  }

  switch (contentType) {
    case 'video':
      if(girlDB.tips.video) {
        isValid = true;
      }
    break;
  
    case 'photo':
      if(girlDB.tips.photo) {
        isValid = true;
      }
    break;

    case 'audio':
      if(girlDB.tips.audio) {
        isValid = true;
      }
    break;
  }

  return isValid;
}

app.post('/buy/:girlId', mdAuth, (req, res) => {
  const paymentData = req.body.paymentData;
  const girlId = req.params.girlId;
  const userId = req.user._id;
  const content = req.body;

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
            message: 'No existe una creadora con esa ID'
        })
    }

    Subscription.findOne({
      girlId: girlDB._id,
      userId: userId
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
                message: 'Debes estar subscripto para realizar esta compra'
            })
        }

        const isContentAllowed = validateContent(girlDB, content.type);

        if(!isContentAllowed) {
          return res.status(400).json({
            ok: false,
            message: 'Esa creadora no acepta este tipo de contenido'
          })
        }

        var payment_data = {
          transaction_amount: Number(paymentData.transactionAmount),
          token: paymentData.token,
          description: paymentData.description,
          installments: Number(paymentData.installments),
          payment_method_id: paymentData.paymentMethodId,
          issuer_id: paymentData.issuerId,
          payer: {
            email: paymentData.payer.email
          }
        };
        
        mercadopago.payment.save(payment_data)
          .then((response) => {
            const date_created = (response?.response?.date_created) ? response.response.date_created : new Date();
      
            const newPurchase = new Purchase({
              girlId,
              userId,
              contentType: content.type,
              type: 'product',
              amount: req.body.amount,
              date: date_created,
              pending: (response.body.status == 'approved') ? false : true,
              paymentId: response.body.id
            })
      
            newPurchase.save((errPurchase, purchaseSaved) => {
              if(errPurchase ){
                return res.status(500).json({
                  ok: false,
                  error: errPurchase
                })
              }
      
              res.status(response.status).json({
                status: response.body.status,
                status_detail: response.body.status_detail,
                id: response.body.id
              });
            })
          })
          .catch(function(error) {
            console.log(error);
            // res.status(error.status).send(error);
          });
        
    })
  })
})

module.exports = app;
