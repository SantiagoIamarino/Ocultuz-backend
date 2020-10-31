const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const userSchema = new Schema({
    name: { type: String, required: [true, 'El nombre es necesario'] },
    email: { 
        type: String, 
        required: [true, 'El email es necesario'], 
        unique: [ true, 'Ya existe un usuario registrado con ese email' ] 
    },
    subscriptions: { type: Array, default: [] },
    role: { type: String, required: [true, 'El rol es necesario'] },
    password: { type: String, required: [true, 'La contraseña es necesaria'] },
    birthDay: { type: String, required: [true, 'La fecha de nacimiento es necesaria'] },
    // code: { type: String, required: [true, 'El codigo es necesario'] },
});

module.exports = mongoose.model('User', userSchema);