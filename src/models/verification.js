const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const verificationSchema = new Schema({
    girl: { type: Schema.Types.ObjectId, ref: 'Girl', required: true },
    url: { type: String, required: true },
    verified: { type: Boolean, default: false }
})

module.exports = mongoose.model('Verification', verificationSchema);