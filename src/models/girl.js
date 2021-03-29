const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const tipsDefault = {
    video: {
        allowed: false,
        price: 0
    },
    audio: {
        allowed: false,
        price: 0
    },
    photo: {
        allowed: false,
        price: 0
    }
}

const girlSchema = new Schema({
    name: { type: String, required: true },
    nickname: { type: String, required: true, unique: true },
    paypalAccount: { type: String },
    email: { type: String, required: true },
    emailVerified: { type: Boolean, default: false },
    identityVerified: { type: Boolean, default: false },
    role: { type: String, default: 'GIRL_ROLE' },
    phoneNumber: { type: String, required: true },
    password: { type: String, required: true },
    description: { type: String },
    birthDay: { type: String, required: true },
    bankAccountNumber: { type: String},
    instagram: { type: String, required: true },
    status: { type: String, default: 'ACTIVE' },
    social:  { type: Array, required: true },
    terms:  { type: Boolean, default: true },
    banner: { type: String },
    previewImage: { type: String },
    basicContent: { type: Array },
    products: { type: Array },
    tips: { type: Object, default: tipsDefault }
});

module.exports = mongoose.model('Girl', girlSchema);