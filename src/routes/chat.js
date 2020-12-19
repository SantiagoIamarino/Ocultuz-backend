const express = require('express');
const mdAuth = require('../middlewares/auth').verifyToken;
const Subscription = require('../models/subscription');
const Message = require('../models/message');

const app = express();

// Get user contacts by filter
app.post('/user-contacts', mdAuth, (req, res) => {
    //Vencimiento verificar ACA--------------------
    // --------------------------------------------

    const term = new RegExp( req.body.term, 'i' );

    Subscription.find({
        userId: req.user._id
    })
    .populate('girlId')
    .exec((err, subscriptions) => {
        if(err) {
            return res.status(500).json({
                ok: false,
                error: err
            })
        }

        let contacts = [];

        subscriptions.forEach(subscription => {
            subscription.girlId.password = '';
            subscription.girlId.products = [];
            subscription.girlId.basicContent = [];

            contacts.push(subscription.girlId);
        });

        if(!term) {
            return res.status(200).json({
                ok: true,
                contacts
            })
        }

        contacts = contacts.filter((contact) => {
            return contact.nickname.search(term) >= 0;
        })

        return res.status(200).json({
            ok: true,
            contacts
        })

    })

})

// Get girl contacts by filter
app.post('/girl-contacts', mdAuth, (req, res) => {
    //Vencimiento verificar ACA--------------------
    // --------------------------------------------
    
    const term = new RegExp( req.body.term, 'i' );

    Subscription.find({
        girlId: req.user._id
    })
    .populate('userId')
    .exec((err, subscriptions) => {
        if(err) {
            return res.status(500).json({
                ok: false,
                error: err
            })
        }

        let contacts = [];

        subscriptions.forEach(subscription => {
            subscription.userId.password = '';

            contacts.push(subscription.userId);
        });

        if(!term) {
            return res.status(200).json({
                ok: true,
                contacts
            })
        }

        contacts = contacts.filter((contact) => {
            return contact.name.search(term) >= 0;
        })

        return res.status(200).json({
            ok: true,
            contacts
        })

    })

})

// Get messages
app.post('/messages/:contactId', mdAuth, (req, res) => {
    const contactId = req.params.contactId;
    const page = req.body.page;
    const perPage = req.body.perPage;

    Message.count({
        $or:[
            { $and: [{'senderId':req.user._id}, {'receiverId':contactId}] },
            { $and: [{'senderId':contactId}, {'receiverId':req.user._id}] },
        ]
    }, (errCount, totalMessages) => {
        if(errCount) {
            return res.status(500).json({
                ok: false,
                error: errCount
            })
        }

        let skip = totalMessages - (page * perPage);
        let limit = perPage;

        if(skip < 0) {
            limit = perPage + skip;
            skip = 0;
        }

        Message.find({
            $or:[
                { $and: [{'senderId':req.user._id}, {'receiverId':contactId}] },
                { $and: [{'senderId':contactId}, {'receiverId':req.user._id}] },
            ]
        })
        .skip(skip)
        .limit(limit)
        .exec((err, messages) => {
            return res.status(200).json({
                ok: true,
                messages,
                total: totalMessages
            })
        })
    })

})

module.exports = app;