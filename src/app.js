//Requires
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();

//Habilitando CORS, no valido para produccion

app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*"); // update to match the domain you will make the request from
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    res.header("Access-Control-Allow-Methods", "POST, GET, PUT, DELETE, OPTIONS");
    next();
});

//Body parser
app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())


//Importar rutas
var userRoutes =  require('./routes/users');


//Conexion db
// mongoose.connection.openUri('mongodb://localhost:27017/OcultuzDB', (err, res) => {
mongoose.connection.openUri('mongodb://ocultuz:Ocultuz12@157.230.215.128:27017/OcultuzDB', (err, res) => {
    if (err) throw err;

    console.log('Database running fine!');
})


//Rutas 
app.use('/users', userRoutes);

//Escuchar peticiones
app.listen(3000, () => {
    console.log('Express running on port 3000');
})