const express =  require('express');

const mdAuth = require('../middlewares/auth').verifyToken;
const mdSameUser = require('../middlewares/same-user').verifySameUserOrAdmin;

const Subscription = require('../models/subscription');
const User = require('../models/user');

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

    Subscription.find({girlId: girlId })
    .populate('userId')
    .limit(limit)
    .exec((err, subscriptions) => {
        if(err) {
            return res.status(500).json({
                ok: false,
                error: err
            })
        }

        Subscription.count({girlId: girlId }, (errCount, total) => {
          return res.status(200).json({
            ok: true,
            total,
            subscriptions
          })
        })

        
    })

})

app.post('/', (req, res) => { // Se realiza luego del pago
    const body = req.body;

    User.findById(body.userId, (findErr, userDB) => {
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

        if(userDB.subscriptions && userDB.subscriptions.indexOf(body.girlId) < 0){
            userDB.subscriptions.push(body.girlId);

            const subscriptionData = {
                userId: body.userId,
                girlId: body.girlId
            }
        
            const subscription = new Subscription(subscriptionData);
        
            subscription.save((err, subscriptionSaved) => {
                if(err) {
                    return res.status(500).json({
                        ok: false,
                        error: err
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

        Subscription.findByIdAndDelete(body.subscriptionId, (errDel, subscriptionDeleted) => {
            if(errDel) {
                return res.status(500).json({
                    ok: false,
                    error: errDel
                })
            }

            userDB.subscriptions.splice(userDB.subscriptions.indexOf(body.girlId), 1);

            userDB.update(userDB, (errUpdt, userUpdated) => {
                if(errUpdt) {
                    return res.status(500).json({
                        ok: false,
                        error: errUpdt
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
module.exports = app;