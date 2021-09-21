const express = require('express');
const app = express();


app.post('/', (req, res) => {
    const body = req.body;

    console.log(body);

    return res.status(200).json({
        ok: true
    })
})


module.exports = app;