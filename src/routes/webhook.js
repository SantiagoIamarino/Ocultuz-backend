const express = require('express');
const app = express();

const Subscription = require('../models/subscription');
const User = require('../models/user');

const config = require('../config/vars');
const Openpay = require('openpay');
const openpay = new Openpay(config.openpayId, config.openpayPrivateKey, false);

app.post('/', (req, res) => {
    console.log('entro!2123');
    if(req.body.type == 'charge.succeeded') {
        console.log('1');
        if(req.body.transaction.subscription_id) {
            console.log('2');
            const subData = req.body;
            const subscriptionId = subData.transaction.subscription_id;

            Subscription.findOne({paymentId: subscriptionId}, 
            (err, subscriptionDB) => {
                console.log('3');
                if(err) {
                    console.log(err);
                    return res.status(200).json({
                        ok: true
                    })
                }

                if(!subscriptionDB) {
                    console.log('No hay sub');
                    // return res.status(200).json({
                    //     ok: true
                    // })
                }

                if(subscriptionDB.paymentData.transaction.id !== subData.transaction.id) {
                    console.log('4');
                    subscriptionDB.active = true;
                    subscriptionDB.paymentData.transaction = subData.transaction;
                } else {
                    console.log('5');
                    const customerId = subData.transaction.card.customer_id;

                    openpay.customers.subscriptions.get(customerId, subscriptionId, (errSub, subscription) => {
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
        console.log('else');
    }
})

module.exports = app;