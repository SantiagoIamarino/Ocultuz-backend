const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const messageSchema = new Schema({
    senderId: { type: String, required: true },
    receiverId: { type: String, required: true },
    date: { type: Date, default: new Date() },
    content: { type: String, required: true }
})

module.exports = mongoose.model('Message', messageSchema);