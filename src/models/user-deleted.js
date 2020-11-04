const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const userDeletedSchema = new Schema({
    userDeleted: { type: Object, required: true },
    deletedDate: { type: Date, default: new Date() }
})

module.exports = mongoose.model('UserDeleted', userDeletedSchema);