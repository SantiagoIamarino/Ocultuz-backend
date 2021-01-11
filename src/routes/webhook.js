const express = require('express');
const app = express();

app.post('/', (req, res) => {
    console.log(req.body);

    return res.status(200).json({
        ok: true
    })
})

module.exports = app;