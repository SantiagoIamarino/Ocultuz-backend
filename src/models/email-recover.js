const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const emailRecoverSchema = new Schema({
    email: { type: String, required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    code: { type: String, required: true },
    role: { type: String }
})

module.exports = mongoose.model('emailRecover', emailRecoverSchema);