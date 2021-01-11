const express = require('express');
const app = express();

app.post('/', (req, res) => {
    console.log(req.body.verification_code);

    return res.status(200).json({
        ok: true,
        verification_code: req.body.verification_code
    })
})

module.exports = app;