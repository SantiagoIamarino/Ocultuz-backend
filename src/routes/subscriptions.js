const express =  require('express');

const mdAuth = require('../middlewares/auth').verifyToken;
const mdSameUser = require('../middlewares/same-user').verifySameUserOrAdmin;

const Subscription = require('../models/subscription');
const Purchase = require('../models/purchase');
const User = require('../models/user');

const config = require('../config/vars');

const Openpay = require('openpay');
const openpay = new Openpay(config.openpayId, config.openpayPrivateKey, false);

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

app.post('/', (req, res) => {
    const body = req.body;

    User.findById(body.user._id, (findErr, userDB) => {
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
            userDB.subscriptions.push(body.girl._id);

            const planRequest = {
                'amount': body.amount,
                'status_after_retry': 'cancelled',
                'retry_times': 2,
                'name': `Subscripción Ocultuz - ${body.girl.nickname} - ${body.user.name}`,
                'repeat_unit': 'month',
                'trial_days': '0',
                'repeat_every': '1'
            };
                
            openpay.plans.create(planRequest, (error, plan) =>{
                if(error) {
                    return res.status(500).json({
                        ok: false,
                        error
                    })
                }
        
                const cardSelected = body.user.cards.find(card => card.default == true);
        
                const subscriptionRequest = {
                    'plan_id': plan.id,
                    'source_id' : cardSelected.id
                };
        
                openpay.customers.subscriptions.create(
                    body.user.openPayCustomerId, 
                    subscriptionRequest, 
                (errSub, subscription) => {
                    if(errSub) {
                        return res.status(500).json({
                            ok: false,
                            error: errSub
                        })
                    }

                    const daysBeforeCancell = config.daysBeforeCancell;
                    const endDateSplitted = subscription.period_end_date.split('-');

                    let nextPaymentDueDate = new Date();
                    nextPaymentDueDate.setFullYear(endDateSplitted[0]);
                    nextPaymentDueDate.setMonth(parseInt(endDateSplitted[1]) - 1);
                    nextPaymentDueDate.setDate(parseInt(endDateSplitted[2]) + daysBeforeCancell);
                   
                    const subscriptionData = {
                        userId: body.user._id,
                        girlId: body.girl._id,
                        type: 'subscription',
                        subscribedSince: new Date(),
                        nextPaymentDueDate,
                        paymentId: subscription.id,
                        paymentData: subscription
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
                        
                        purchase.save((purchaseErr, purchaseSaved) => {
                            if(purchaseErr) {
                                return res.status(500).json({
                                    ok: false,
                                    error: purchaseErr
                                })
                            }
        
                            userDB.update(userDB, (updateErr, userUpdated) => {
                                if(updateErr) {
                                    return res.status(500).json({
                                        ok: false,
                                        error: updateErr
                                    })
                                }
                    
                                return res.status(201).json({
                                    ok: true,
                                    user: userDB,
                                    message: 'Te has subscrito correctamente!'
                                })
                            })
                        })
                    })
        
                });
            });
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

            openpay.customers.subscriptions.delete(
                userDB.openPayCustomerId,
                subscriptionDB.paymentData.id,
                (errSubCancel, subscriptionCancelled) => {
                    if(errSubCancel) {
                        return res.status(500).json({
                            ok: false,
                            error: errSubCancel
                        })
                    }

                    subscriptionDB.active = false;

                    subscriptionDB.update(subscriptionDB, (errSubUpdt, subscriptionUpdt) => {
                        if(errSubUpdt) {
                            return res.status(500).json({
                                ok: false,
                                error: errSubUpdt
                            })
                        }

                        delete userDB.password;

                        return res.status(200).json({
                            ok: true,
                            message: 'Has cancelado tu subscripción correctamente',
                            user: userDB
                        })
                    })
                })
        })
    })
})



module.exports = app;