//Requires
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const handleSocket = require('./sockets/main');

const app = express();

//Habilitando CORS, no valido para produccion

app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*"); // update to match the domain you will make the request from
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    res.header("Access-Control-Allow-Methods", "POST, GET, PUT, DELETE, OPTIONS");
    next();
});

//Body parser
app.use(bodyParser.urlencoded({limit: '25mb', extended: true}));
app.use(bodyParser.json({limit: '25mb'}));
var fileupload = require("express-fileupload");
app.use(fileupload());

const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: {
        origin: "*", // -----Change in PROD-----
        methods: ["GET", "POST"]
    }
});

//Importar rutas
const userRoutes =  require('./routes/users');
const girlRoutes =  require('./routes/girls');
const subscriptionRoutes =  require('./routes/subscriptions');
const emailRoutes =  require('./routes/emails');
const fileRoutes =  require('./routes/files');
const contentRoutes =  require('./routes/contents');
const chatRoutes =  require('./routes/chat');
const paymentsRoutes = require('./routes/payments');
const webhookRoutes = require('./routes/webhook');

//Conexion db
// mongoose.connection.openUri('mongodb://localhost:27017/OcultuzDB', (err, res) => {
mongoose.connection.openUri('mongodb://ocultuz:Ocultuz12@157.230.215.128:27017/OcultuzDB', (err, res) => {
    if (err) throw err;

    console.log('Database running fine!');
})


//Rutas 
app.use('/users', userRoutes);
app.use('/girls', girlRoutes);
app.use('/subscriptions', subscriptionRoutes);
app.use('/emails', emailRoutes);
app.use('/files', fileRoutes);
app.use('/contents', contentRoutes);
app.use('/chat', chatRoutes);
app.use('/payments', paymentsRoutes);
app.use('/webhook', webhookRoutes);


//Socket.io
io.on('connection', (socket) => {   
    handleSocket(io, socket);
});

//Escuchar peticiones
http.listen(8443, () => {
    console.log('Express running on port 8443');
})