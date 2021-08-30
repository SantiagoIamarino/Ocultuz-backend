const express =  require('express');
const axios = require('axios');

const mdAuth = require('../middlewares/auth').verifyToken;
const mdSameUser = require('../middlewares/same-user').verifySameUserOrAdmin;

const Subscription = require('../models/subscription');
const Purchase = require('../models/purchase');
const User = require('../models/user');

const config = require('../config/vars');

const app = express();

app.get('/user-subscriptions/:userId', [mdAuth, mdSameUser], (req, res) => {
    const userId = req.params.userId;
    Subscription
        .find({userId:userId })
        .populate('userId')
        .populate('girlId')
        .exec((err, subscriptions) => {
            if(err) {
                return res.status(500).json({
                    ok: false,
                    error: err
                })
            }

            return res.status(200).json({
                ok: true,
                subscriptions
            })
        })
})

app.post('/girl-subscriptions/:userId', [mdAuth, mdSameUser], (req, res) => {
    const girlId = req.params.userId;
    const limit = req.body.limit;
    const page = req.body.page;

    const mongooseFilters = {
      girlId: girlId
    }

    if(req.body.filter && req.body.filter.from && req.body.filter.to) {
      mongooseFilters.$and = [
        { subscribedSince: { $gte: req.body.filter.from } },
        { subscribedSince: { $lte: req.body.filter.to } }
      ];
    }

    Subscription.find(mongooseFilters)
    .populate('userId')
    .skip(page * limit - limit)
    .limit(limit)
    .exec((err, subscriptions) => {
        if(err) {
            return res.status(500).json({
                ok: false,
                error: err
            })
        }

        Subscription.count(mongooseFilters, (errCount, total) => {
          return res.status(200).json({
            ok: true,
            total,
            subscriptions
          })
        })

        
    })

})

function createPlan(amount) {
    return new Promise((resolve, reject) => {
        const planRequest = {
            "back_url":"https://www.mercadopago.com.ar",
            "reason":"Ocultuz subscripción mensual",
            "auto_recurring":{
                "frequency":"1",
                "frequency_type":"days",
                "transaction_amount": amount,
                "currency_id":"MXN",
                "repetitions":12,
                "free_trial":{
                    "frequency_type":"months",
                    "frequency":"1"
                }
            }
        };
    
        axios.post('https://api.mercadopago.com/preapproval_plan', planRequest, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + config.mpAccessToken
            }
        }).then((response) => {
            resolve(response.data.id);
        }).catch((error) => {
            console.log(error)
            reject(error.data);
        })
    })
}

function updateUserSubs(userToUpdate) {
    return new Promise((resolve, reject) => {
        User.findById(userToUpdate._id, (err, userDB) => {
            if(err) {
                reject(err)
            }

            userDB.subscriptions = userToUpdate.subscriptions;
            userDB.update(userDB, (errUpdt, userUpdated) => {
                if(errUpdt) {
                    reject(errUpdt)
                }

                resolve(userDB);
                
            })
        })
    })
}

app.post('/', (req, res) => {
    const body = req.body;

    User.findById(body.user._id, async (findErr, userDB) => {
        if(findErr) {
            return res.status(500).json({
                ok: false,
                error: findErr
            })
        }

        if(!userDB) {
            return res.status(400).json({
                ok: false,
                message: 'No existe un usuario con ese ID'
            })
        }

        if(userDB.subscriptions && userDB.subscriptions.indexOf(body.girl._id) < 0){
            try {
                const planId = await createPlan(body.amount);

                const subscriptionRequest = {
                    "preapproval_plan_id":planId,
                    "card_token_id":body.cardToken,
                    "payer_email": "test_user_9965551@testuser.com"
                };
            
                axios.post('https://api.mercadopago.com/preapproval', subscriptionRequest, {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + config.mpAccessToken
                    }
                }).then((response) => {
                    const subscription = response.data;
                    // const daysBeforeCancell = config.daysBeforeCancell;
                    const startDate = subscription.auto_recurring.start_date;
        
                    let nextPaymentDueDate = new Date(startDate);
                
                    const subscriptionData = {
                        userId: body.user._id,
                        girlId: body.girl._id,
                        type: 'subscription',
                        subscribedSince: new Date(),
                        nextPaymentDueDate,
                        paymentId: subscription.id,
                        paymentData: subscription,
                        status: (subscription.status == 'authorized') ? 'completed' : 'pending'
                    }
                
                    const newSubscription = new Subscription(subscriptionData);
                
                    newSubscription.save((err, subscriptionSaved) => {
                        if(err) {
                            return res.status(500).json({
                                ok: false,
                                error: err
                            })
                        }
        
                        // Creating purchase
        
                        const purchase = new Purchase(subscriptionData);
                        
                        purchase.save(async (purchaseErr, purchaseSaved) => {
                            if(purchaseErr) {
                                return res.status(500).json({
                                    ok: false,
                                    error: purchaseErr
                                })
                            }
        
                            userDB.subscriptions.push(body.girl._id);
        
                            await updateUserSubs(userDB);
        
                            return res.status(201).json({
                                ok: true,
                                user: userDB,
                                message: 'Te has subscripto correctamente a esta creadora'
                            })
                        })
                    })
                }).catch((error) => {
                    console.log(error);
                    return res.status(200).json({
                        ok: false,
                        error: error
                    })
                })
        
            } catch (error) {
                console.log(error);
                return res.status(500).json({
                    ok: false,
                    message: 'Ha ocurrido un error al procesar el pago'
                })
            }
        } else {
            return res.status(400).json({
                ok: false,
                message: 'Ya te has subscrito a esta creadora'
            })
        }
    
    })
    
})

app.post('/unsubscribe/:userId', [mdAuth, mdSameUser], (req, res) => {
    const body = req.body;
    const userId = req.params.userId;

    User.findById(userId, (err, userDB) => {
        if(err) {
            return res.status(500).json({
                ok: false,
                error: err
            })
        }

        if(!userDB) {
            return res.status(400).json({
                ok: false
            })
        }

        if(userDB.subscriptions && userDB.subscriptions.indexOf(body.girlId) < 0) {
            return res.status(400).json({
                ok: false,
                message: 'No te encuentras subscripto'
            })
        }

        Subscription.findById(body.subscriptionId, (errSub, subscriptionDB) => {
            if(errSub) {
                return res.status(500).json({
                    ok: false,
                    error: errSub
                })
            }

            const planId = subscriptionDB.paymentData.id;
            const data = {
              status: 'cancelled'
            }

            axios.put(`https://api.mercadopago.com/preapproval/${planId}`, data, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + config.mpAccessToken
                }
            }).then((response) => {
              subscriptionDB.active = false;
              subscriptionDB.update(subscriptionDB, async (errSubUpdt, subscriptionUpdt) => {
                  if(errSubUpdt) {
                      return res.status(500).json({
                          ok: false,
                          error: errSubUpdt
                      })
                  }

                  return res.status(200).json({
                      ok: true,
                      message: 'Has cancelado tu subscripción correctamente'
                  })
              })
            }).catch((error) => {
                return res.status(500).json({
                  ok: false,
                  error: error.data
                })
            })
        })
    })
})



module.exports = app;
