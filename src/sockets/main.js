const Message = require('../models/message');
const ChatNotification = require('../models/chat-notification');
const User = require('../models/user');

function verifyUserStatus(io = null, user, socketId) {
    if(user.loginStatus.sessionId !== socketId){
        if(!io) {
            return;
        }

        io.emit('logout-user', socketId);
    }
}

function handleUserStatus(io = null, userId, socketId, status = true) {
    User.findById(userId, (err, userDB) => {
        if(err || !userDB) {
            return;
        }

        if(!userDB.loginStatus || userDB.loginStatus.logged == status) {
            verifyUserStatus(io, userDB, socketId);
            return;
        }

        userDB.loginStatus.logged = status;

        if(status){
            userDB.loginStatus.sessionId = socketId;
        } else {
            userDB.loginStatus.sessionId = null;
        }

        userDB.update(userDB, (errUpdt, userUpdated) => {
            if(errUpdt) {
                return;
            }
        })
    })
}

function handleSocket(io, socket) {    
    handleUserStatus(
        io,
        socket.request._query.userId,
        socket.id
    );

    socket.on('message', (data) => {
        const message = new Message(data);

        message.save((err, messageSaved) => {
            if(!err) {
                io.emit('message-broadcast', data);
            } else {
                console.log(err);   
            }
        })

        const chatNotification = new ChatNotification(data);

        chatNotification.save((err, chatNotification) => {
            io.emit('message-notification', data);
        });
    });

    socket.on('disconnect', function (data) {
        handleUserStatus(
            io,
            socket.request._query.userId, 
            socket.id,
            false
        );
    });

    socket.on('user-logout', function (userId) {
        handleUserStatus(
            io,
            userId, 
            socket.id,
            false
        );
    });
}

module.exports = handleSocket;
