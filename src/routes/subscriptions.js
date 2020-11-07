const express =  require('express');

const mdAuth = require('../middlewares/auth').verifyToken;
const mdSameUser = require('../middlewares/same-user').verifySameUserOrAdmin;

const Subscription = require('../models/subscription');
const User = require('../models/user');

const app = express();

app.get('/user-subscriptions/:userId', [mdAuth, mdSameUser], (req, res) => {
    const userId = req.params.userId;
    Subscription.find({userId:userId }, (err, subscriptions) => {
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

app.get('/girl-subscriptions/:userId', [mdAuth, mdSameUser], (req, res) => {
    const userId = req.params.userId;

    Subscription.find({userId:userId }, (err, subscriptions) => {
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

app.post('/', (req, res) => { // Se realiza luego del pago
    const body = req.body;

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

            if(userDB.subscriptions){
                userDB.subscriptions.push(body.girlId);
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
                    user: userUpdated,
                    message: 'Te has subscrito correctamente!'
                })
            })
        })
    })
})

module.exports = app;