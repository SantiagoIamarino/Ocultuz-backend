const express = require('express');
const app = express();

app.post('/', (req, res) => {
    console.log(req.body.verification_code);
})

module.exports = app;