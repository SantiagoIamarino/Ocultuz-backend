const express = require('express');
const mdAuth = require('../middlewares/auth').verifyToken;
const Subscription = require('../models/subscription');
const Message = require('../models/message');
const ChatNotification = require('../models/chat-notification');

const app = express();

function getNewMessages(senderId, receiverId) {
    return new Promise((resolve, reject) => {
        ChatNotification.find({
            senderId,
            receiverId
        }, (err, notifications) => {
            if(err) {
                console.log(err)
                reject(err);
            }

            if(notifications.length > 0) {
                resolve( true );
            } else {
                resolve( false );
            }
        })
    })
   
}

// Get user contacts by filter
app.post('/user-contacts', mdAuth, (req, res) => {
    //Vencimiento verificar ACA--------------------
    // --------------------------------------------

    const term = new RegExp( req.body.term, 'i' );

    Subscription.find({
        userId: req.user._id
    })
    .populate('girlId')
    .exec(async (err, subscriptions) => {
        if(err) {
            return res.status(500).json({
                ok: false,
                error: err
            })
        }

        let contacts = [];

        new Promise(async (resolve, reject) => {
            for(const [index, subscription] of subscriptions.entries()) {
                subscription.girlId.password = '';
                subscription.girlId.products = [];
                subscription.girlId.basicContent = [];
    
                const hasNewMessages = await getNewMessages(
                    subscription.girlId._id,
                    req.user._id
                );

                const contact = {
                    ...JSON.parse(JSON.stringify(subscription.girlId)),
                    newMessages: hasNewMessages
                };

                contacts.push(contact);

                if((index + 1) == subscriptions.length) {
                    resolve();
                };
            };
        }).then(() => {
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
        }).catch((err) => console.log(err));

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

        new Promise(async (resolve, reject) => {
            for(const [index, subscription] of subscriptions.entries()) {
                subscription.userId.password = '';
    
                const hasNewMessages = await getNewMessages(
                    subscription.userId._id,
                    req.user._id
                );
    
                const contact = {
                    ...JSON.parse(JSON.stringify(subscription.userId)),
                    newMessages: hasNewMessages
                };
    
                contacts.push(contact);
                
                if((index + 1) == subscriptions.length) {
                    resolve()
                };
            };
        }).then(() => {

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

//Delete notification
app.delete('/notification/:senderId', mdAuth, (req, res) => {
    const userId = req.user._id;
    const senderId = req.params.senderId;

    ChatNotification.deleteMany({
        receiverId: userId,
        senderId: senderId
    }, (err, notificationDeleted) => {
        if(err) {
            return res.status(500).json({
                ok: false,
                error: err
            })
        }

        return res.status(200).json({
            ok: true,
            message: 'Notification deleted'
        })
    })
})

module.exports = app;