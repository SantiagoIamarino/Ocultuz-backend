const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const userSchema = new Schema({
    name: { type: String, required: [true, 'El nombre es necesario'] },
    profileImage: { type: String },
    customerId: { type: String },
    paypalAccount: { type: String },
    phoneNumber: { type: String },
    email: { 
        type: String, 
        required: [true, 'El email es necesario'], 
        unique: [ true, 'Ya existe un usuario registrado con ese email' ] 
    },
    emailVerified: { type: Boolean, default: false },
    status: { type: String },
    subscriptions: { type: Array, default: [] },
    role: { type: String, default: 'USER_ROLE' },
    password: { type: String, required: [true, 'La contraseña es necesaria'] },
    birthDay: { type: String },
    adminRole: { type: String, default: 'SECONDARY' },
    terms: { type: Boolean, default: true },
    address: { type: String },
    postalCode: { type: String },
    city: { type: String },
    country: { type: String },
    cards: { type: Array, default: [] },
    loginStatus: { type: Object, default: { logged: false, sessionId: null } }
});

module.exports = mongoose.model('User', userSchema);