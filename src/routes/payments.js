const express = require('express');
const app = express();
const User = require('../models/user');

const config = require('../config/vars');

const Openpay = require('openpay');
const openpay = new Openpay(config.openpayId, config.openpayPrivateKey, false);

const mdAuth = require('../middlewares/auth').verifyToken;
const mdSameUser = require('../middlewares/same-user').verifySameUserOrAdmin;

app.post('/create-user', mdAuth, (req, res) => {
    const customerRequest = {
        name: req.body.name,
        email: req.body.email
    }

    openpay.customers.create(customerRequest, (err, customer) => {
        if(err) {
            return res.status(500).json({
                ok: false,
                error: err
            })
        }

        return res.status(200).json({
            ok: true,
            customer
        })
    })
})

app.post('/add-card', [mdAuth, mdSameUser], (req, res) => {
    const customerId = req.body.customerId;
    const cardRequest = {
        token_id : req.body.cardData.id,
        'device_session_id' : 'sadasdasda13131da'
    }
      
    openpay.customers.cards.create(customerId, cardRequest, (error, card) =>  {
        if(error) {
            return res.status(500).json({
                ok: false,
                error
            })
        }

        User.findById(req.user._id, (err, userDB) => {
            if(err) {
                return res.status(500).json({
                    ok: false,
                    error: err
                })
            }

            const cardData = {
                ...card,
                default: (userDB.cards.length > 0) ? false : true
            }

            userDB.cards.push(cardData);

            userDB.update(userDB, (errUpdt, userUpdated) => {
                if(errUpdt) {
                    return res.status(500).json({
                        ok: false,
                        error: errUpdt
                    })
                }

                return res.status(200).json({
                    ok: true,
                    message: 'Tarjeta añadida correctamente'
                })
            })
        })
    });
})

app.post('/remove-card', [mdAuth, mdSameUser], (req, res) => {
    const body = req.body;

    openpay.customers.cards.delete(body.customerId, body.cardId, (err, cardDeleted) => {
        if(err) {
            return res.status(500).json({
                ok: false,
                error: err
            })
        }

        User.findById(req.user._id, (errUsr, userDB) => {
            if(errUsr) {
                return res.status(500).json({
                    ok: false,
                    error: errUsr
                })
            }

            const cardIndex = userDB.cards.findIndex((card => card.id == body.cardId));
            userDB.cards.splice(cardIndex, 1);

            userDB.update(userDB, (errUpdt, userUpdated) => {
                if(errUpdt) {
                    return res.status(500).json({
                        ok: false,
                        error: errUpdt
                    })
                }

                return res.status(200).json({
                    ok: true,
                    message: 'Tarjeta removida correctamente'
                })
            })
        })
    })
})


module.exports = app;