const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const chatNotificationSchema = new Schema({
    receiverId: { type: String, required: true },
    senderId: { type: String, required: true }
})

module.exports = mongoose.model('ChatNotification', chatNotificationSchema);