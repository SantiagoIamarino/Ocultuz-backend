const express = require('express');
const app = express();

const Subscription = require('../models/subscription');
const Purchase = require('../models/purchase');
const User = require('../models/user');

const axios = require('axios');
const config = require('../config/vars');

const Openpay = require('openpay');
const openpay = new Openpay(config.openpayId, config.openpayPrivateKey, false);


app.post('/', (req, res) => {
    const body = req.body;
    console.log(body);

    if(body.type == 'payment') {
        const paymentId = body.data.id;
        const url = `https://api.mercadopago.com/v1/payments/${paymentId}`;

        axios.get(url, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + config.mpAccessToken
            }
        }).then((response) => {
            const paymentData = response.data;
            console.log(paymentData);

            if(paymentData.status == 'pending') {
                return res.status(200).json({
                    ok: true
                })
            }

            Purchase.findOne({paymentId: paymentId}, (err, purchaseDB) => {
                if(!purchaseDB) {
                    return res.status(200).json({
                        ok: true
                    })
                }

                if(purchaseDB.type == 'product') {
                    if(err) {
                        return res.status(200).json({
                            ok: true
                        })
                    }
    
                    if(!purchaseDB) {
                        return res.status(200).json({
                            ok: true
                        })
                    }
    
                    purchaseDB.pending = false;
                    purchaseDB.update(purchaseDB, (errUpdt, purchaseUpdated) => {
                        if(errUpdt) {
                            return res.status(200).json({
                                ok: true
                            })
                        }
                    });
                } else {

                }
            })
            

        }).catch((error) => {
            console.log(error.data);
            return res.status(200).json({
                ok: true
            })
        })
    } else {
        return res.status(200).json({
            ok: true
        })
    }
    // if(req.body.type == 'charge.succeeded') {
    //     if(req.body.transaction.method == 'card') {
    //         if(req.body.transaction.subscription_id) {
    //             const subData = req.body;
    //             const subscriptionId = subData.transaction.subscription_id;
    
    //             Subscription.findOne({paymentId: subscriptionId}, 
    //             (err, subscriptionDB) => {
    //                 if(err) {
    //                     return res.status(200).json({
    //                         ok: true
    //                     })
    //                 }
    
    //                 if(!subscriptionDB) {
    //                     return res.status(200).json({
    //                         ok: true
    //                     })
    //                 }
    
    //                 if(subscriptionDB.paymentData.transaction.id !== subData.transaction.id) {
    //                     const customerId = subData.transaction.card.customer_id;
    
    //                     openpay.customers.subscriptions.get(customerId, subscriptionId, 
    //                     (errSub, subscription) => {
    //                         if(errSub) {
    //                             return res.status(200).json({
    //                                 ok: true
    //                             })
    //                         }
    
    //                         subscriptionDB.active = true;
    //                         subscriptionDB.paymentData.transaction = subData.transaction;
    
    //                         const daysBeforeCancell = config.daysBeforeCancell;
    
    //                         let nextPaymentDueDate = new Date(subscription.period_end_date);
    //                         nextPaymentDueDate.setDate(nextPaymentDueDate.getDate() + daysBeforeCancell);
    
    //                         subscriptionDB.nextPaymentDue = nextPaymentDueDate;
    
    //                         subscriptionDB.update(subscriptionDB, (errUpt, subUpdated) => {
    //                             return res.status(200).json({
    //                                 ok: true
    //                             })
    //                         })
    //                     })
    //                 } else {
    //                     return res.status(200).json({
    //                         ok: true
    //                     })
    //                 }
    //             })
    //         } else {
    //             return res.status(200).json({
    //                 ok: true
    //             })
    //         }
    //     } else {
    //         Purchase.findOne({
    //             paymentId: req.body.transaction.id,
    //             pending: true
    //         }, (err, purchaseDB) => {
    //             if(err) {
    //                 return res.status(200).json({
    //                     ok: true
    //                 })
    //             }

    //             if(!purchaseDB) {
    //                 return res.status(200).json({
    //                     ok: true
    //                 })
    //             }

    //             purchaseDB.pending = false;
    //             purchaseDB.update(purchaseDB, (errUpdt, purchaseUpdated) => {
    //                 if(errUpdt) {
    //                     return res.status(200).json({
    //                         ok: true
    //                     })
    //                 }

    //                 if(purchaseDB.contentType == 'subscription') {

    //                     let nextPaymentDueDate = new Date();
    //                     nextPaymentDueDate.setMonth(nextPaymentDueDate.getMonth() + 1);

    //                     const subscription = new Subscription({
    //                         userId: purchaseDB.userId,
    //                         girlId: purchaseDB.girlId,
    //                         subscribedSince: new Date(),
    //                         nextPaymentDueDate,
    //                         paymentData: req.body,
    //                         paymentId: purchaseDB.paymentId,
    //                         active: true
    //                     })

    //                     subscription.save((errSave, subscriptionSaved) => {
    //                         if(errSave) {
    //                             return res.status(200).json({
    //                                 ok: true
    //                             })
    //                         }

    //                         User.findById(purchaseDB.userId, (errSubs, userDB) => {
    //                             if(!userDB) {
    //                                 return res.status(200).json({
    //                                     ok: true
    //                                 })
    //                             }
    //                             if(userDB.subscriptions && userDB.subscriptions.indexOf(purchaseDB.girlId) < 0) {
    //                                 userDB.subscriptions.push(purchaseDB.girlId);
    //                                 userDB.update(userDB, (errUpdtSub, userUpdated) => {
    //                                     return res.status(200).json({
    //                                         ok: true
    //                                     })
    //                                 })
    //                             } else {
    //                                 return res.status(200).json({
    //                                     ok: true
    //                                 })
    //                             }
    //                         })
    //                     })
    //                 } else {
    //                     return res.status(200).json({
    //                         ok: true
    //                     })
    //                 }
    //             })
    //         })
    //     }
       
        
    // } else {
    //     return res.status(200).json({
    //         ok: true
    //     })
    // }
})

module.exports = app;