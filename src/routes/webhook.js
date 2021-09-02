const express = require('express');
const app = express();

const Subscription = require('../models/subscription');
const Purchase = require('../models/purchase');
const User = require('../models/user');

const axios = require('axios');
const config = require('../config/vars');

function getSubscriptionInfo(paymentId) {
    return new Promise((resolve, reject) => {
        let url = "https://api.mercadopago.com/preapproval/search"
        url += `?access_token=${config.mpAccessToken}`;
        url += `&preapproval_plan_id=${paymentId}`;

        axios.get(url, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + config.mpAccessToken
            }
        }).then((response) => {
            resolve(response.data.results[0]);
        })
        .catch(error => console.log('getSubscriptionInfo ', error));
    })
}


app.post('/', (req, res) => {
    const body = req.body;
    console.log(req.body);

    if(body.type == 'payment') {
        const paymentId = body.data.id;
        const url = `https://api.mercadopago.com/v1/payments/${paymentId}`;

        axios.get(url, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + config.mpAccessToken
            }
        }).then((response) => {
            console.log('PaymentData', response.data);
            const paymentData = response.data;

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

                    if(paymentData.status == 'approved') {
                        purchaseDB.pending = false;
                    }
    
                    purchaseDB.update(purchaseDB, (errUpdt, purchaseUpdated) => {
                        if(errUpdt) {
                            return res.status(200).json({
                                ok: true
                            })
                        }
                    });
                } else {
                    //https://api.mercadopago.com/preapproval/search?access_token=APP_USR-5994785052999824-080720-b06d309f87d8a213c21a8b6676c1543d-803836590&preapproval_plan_id=2c9380847b62931d017b9973f148280d

                    Subscription.findOne({paymentId: paymentId}, 
                        async (err, subscriptionDB) => {
                            if(err) {
                                return res.status(200).json({
                                    ok: true
                                })
                            }
            
                            if(!subscriptionDB) {
                                return res.status(200).json({
                                    ok: true
                                })
                            }

                            const subscription = await getSubscriptionInfo();
                            console.log('Sub', subscription);

                            subscriptionDB.active = true;
                            const startDate = subscription.auto_recurring.start_date;
                            subscriptionDB.nextPaymentDueDate = new Date(startDate);
    
    
                            subscriptionDB.update(subscriptionDB, (errUpt, subUpdated) => {
                                return res.status(200).json({
                                    ok: true
                                })
                            })
                    })
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
})

module.exports = app;