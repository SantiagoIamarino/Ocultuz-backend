const express = require('express');
const app = express();

const Subscription = require('../models/subscription');
const User = require('../models/user');

const Openpay = require('openpay');
const openpay = new Openpay(config.openpayId, config.openpayPrivateKey, false);

app.post('/', (req, res) => {
    if(req.body.type == 'change.succeeded') {
        if(req.body.subscription_id) {
            const subData = req.body;

            Subscription.findOne({paymentId: subData.id}, (err, subscriptionDB) => {
                if(err) {
                    console.log(err);
                    return res.status(200).json({
                        ok: true
                    })
                }

                if(!subscriptionDB) {
                    console.log('No hay sub');
                    return res.status(200).json({
                        ok: true
                    })
                }

                if(subscriptionDB.paymentData.transaction.id !== subData.transaction.id) {
                    subscriptionDB.active = true;
                    subscriptionDB.paymentData.transaction = subData.transaction;
                } else {
                    const customerId = subData.transaction.card.customer_id;

                    openpay.customers.subscriptions.get(customerId, subData.id, (errSub, subscription) => {
                        if(errSub) {
                            console.log(errSub);
                            return res.status(200).json({
                                ok: true
                            })
                        }

                        console.log(subscription);

                        return res.status(200).json({
                            ok: true
                        })
                    })

                    
                }
            })
        } else {
            return res.status(200).json({
                ok: true
            })
        }
        
    } else {
        
    }

    Subscription
})

module.exports = app;