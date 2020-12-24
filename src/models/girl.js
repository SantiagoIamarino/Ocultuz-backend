const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const girlSchema = new Schema({
    name: { type: String, required: true },
    nickname: { type: String, required: true },
    email: { type: String, required: true },
    emailVerified: { type: Boolean, default: false },
    identityVerified: { type: Boolean, default: false },
    role: { type: String, default: 'GIRL_ROLE' },
    phoneNumber: { type: String, required: true },
    password: { type: String, required: true },
    description: { type: String },
    birthDay: { type: String, required: true },
    bankAccountNumber: { type: String, required: true },
    instagram: { type: String, required: true },
    status: { type: String, default: 'ACTIVE' },
    social:  { type: Array, required: true },
    terms:  { type: Boolean, default: true },
    banner: { type: String },
    previewImage: { type: String },
    basicContent: { type: Array },
    products: { type: Array }
});

module.exports = mongoose.model('Girl', girlSchema);