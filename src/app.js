//Requires
const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const handleSocket = require("./sockets/main");

require("dotenv").config();

const app = express();

//Habilitando CORS, no valido para produccion

app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGINS);
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  res.header("Access-Control-Allow-Methods", "POST, GET, PUT, DELETE, OPTIONS");
  next();
});

//Body parser
app.use(bodyParser.urlencoded({ limit: "25mb", extended: true }));
app.use("/webhook/card-payments", express.raw({ type: "*/*" }));
app.use(bodyParser.json({ limit: "25mb" }));
var fileupload = require("express-fileupload");
app.use(fileupload());

let server = require("http").createServer(app);

if (process.env.ENV_TYPE == "prod") {
  // Prod only

  const fs = require("fs");

  const httpsOptions = {
    key: fs.readFileSync("/etc/ssl/ocultuz_com.key"),

    cert: fs.readFileSync("/etc/ssl/ocultuz_com.crt"),
  };

  server = require("https").createServer(httpsOptions, app);
}

const io = require("socket.io")(server, {
  cors: {
    origin: process.env.ALLOWED_ORIGINS,
    methods: ["GET", "POST"],
  },
});

//Importar rutas
const userRoutes = require("./routes/users");
const girlRoutes = require("./routes/girls");
const subscriptionRoutes = require("./routes/subscriptions");
const emailRoutes = require("./routes/emails");
const fileRoutes = require("./routes/files");
const contentRoutes = require("./routes/contents");
const chatRoutes = require("./routes/chat");
const paymentsRoutes = require("./routes/payments");
const webhookRoutes = require("./routes/webhook");

//Conexion db
console.log(process.env.DATABASE_URL);
mongoose.connection.openUri(process.env.DATABASE_URL, (err, res) => {
  if (err) throw err;

  console.log("Database running fine!");
});

//Rutas
app.use("/users", userRoutes);
app.use("/girls", girlRoutes);
app.use("/subscriptions", subscriptionRoutes);
app.use("/emails", emailRoutes);
app.use("/files", fileRoutes);
app.use("/contents", contentRoutes);
app.use("/chat", chatRoutes);
app.use("/payments", paymentsRoutes);
app.use("/webhook", webhookRoutes);

//Socket.io
io.on("connection", (socket) => {
  handleSocket(io, socket);
});

//Escuchar peticiones
server.listen(process.env.PORT, () => {
  console.log(`Express running on port ${process.env.PORT}`);
});
