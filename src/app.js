//Requires
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const Message = require('./models/message');
const ChatNotification = require('./models/chat-notification');

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

const fs = require('fs');

const httpsOptions = {

    key: fs.readFileSync("/etc/ssl/ocultuz_com.key"),
<<<<<<< HEAD

=======
  
>>>>>>> parent of 9e7bc49... Ready to work in payments
    cert: fs.readFileSync("/etc/ssl/ocultuz_com.crt"),
};

const https = require('https').createServer(httpsOptions, app);
const io = require('socket.io')(https, {
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
    socket.on('message', (data) => {
        const message = new Message(data);

        message.save((err, messageSaved) => {
            if(!err) {
                io.emit('message-broadcast', data);
            } else {
                console.log(err);   
            }
        })

        const chatNotification = new ChatNotification(data);

        chatNotification.save((err, chatNotification) => {
            io.emit('message-notification', data);
        });
    });

});

//Escuchar peticiones
<<<<<<< HEAD
https.listen(8443, () => {
    console.log('Express running on port 8443');
=======
https.listen(3000, () => {
    console.log('Express running on port 3000test');
>>>>>>> parent of 9e7bc49... Ready to work in payments
})