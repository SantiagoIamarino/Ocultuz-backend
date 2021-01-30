const express = require('express');
const Content = require('../models/content');
const Purchase = require('../models/purchase');
const Subscription = require('../models/subscription');
const Girl = require('../models/girl');
const User = require('../models/user');

const mdAuth = require('../middlewares/auth').verifyToken;
const mdSameUser = require('../middlewares/same-user').verifySameUserOrAdmin;

const config = require('../config/vars');

const Openpay = require('openpay');
const openpay = new Openpay(config.openpayId, config.openpayPrivateKey, false);

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

            console.log(girlDB);

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
            
            const cardSelected = req.user.cards.find(card => card.default == true);

            const chargeRequest = {
                'source_id' : cardSelected.id,
                'method' : 'card',
                'currency': 'USD',
                'amount' : contentDB.amount,
                'description' : contentDB.description,
                'device_session_id': req.body.deviceSessionId
            }

            openpay.customers.charges.create(
                req.user.openPayCustomerId,
                chargeRequest, 
            (error, charge) => {

                if(error) {
                    return res.status(500).json({
                        ok: false,
                        error
                    })
                }

                const newPurchase = new Purchase({
                    girlId: contentDB.girlId,
                    userId,
                    contentId,
                    type: 'product'
                  })
      
                  newPurchase.save((errPurchase, purchaseSaved) => {
                    if(errPurchase ){
                      return res.status(500).json({
                        ok: false,
                        error: errPurchase
                      })
                    }
      
                    return res.status(200).json({
                      ok: true,
                      message: 'Adquiriste el contenido correctamente'
                    })
                  })
            });
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
