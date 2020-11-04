const express = require('express');
const bcrypt = require('bcrypt');
const Girl = require('../models/girl');

const jwt = require('jsonwebtoken');
const key = require('../config/vars').key;

const mdAuth = require('../middlewares/auth').verifyToken;
const mdSameUser = require('../middlewares/same-user').verifySameUserOrAdmin;
const mdAdmin = require('../middlewares/admin').verifyRole;

const app = express();

app.get('/', mdAdmin, (req, res) => {

    Girl.find({}, (err, girls) => {

        if(err) {
            return res.status(500).json({
                ok: false,
                error: err
            })
        }

        return res.status(200).json({
            ok: true,
            girls
        })

    })

})

app.get('/:girlId', mdSameUser, (req, res) => {

    const girlId = req.params.girlId;

    Girl.findById(girlId, (err, girl) => {

        if(err) {
            return res.status(500).json({
                ok: false,
                error: err
            })
        }

        if(!girl) {
            return res.status(400).json({
                ok: false,
                message: 'No se ha encontrado ninguna creadora con ese ID'
            })
        }

        return res.status(200).json({
            ok: true,
            girl
        })

    })

})

app.post('/', (req, res) => {
    const body = req.body;

    Girl.findOne({email: body.email}, (err, girlDB) => {
        if(err) {
            return res.status(500).json({
                ok: false,
                error: err
            })
        }

        if(girlDB) {
            return res.status(400).json({
                ok: false,
                message: 'El email ya se encuentra registrado'
            })
        }

        body.password = bcrypt.hashSync(body.password, 10);

        const girl = new Girl(body);

        girl.save((err, girlDB) => {
            if(err) {
                return res.status(500).json({
                    ok: false,
                    error: err
                })
            }

            girlDB.password = '';

            return res.status(201).json({
                ok: true,
                message: 'Te has registrado correctamente',
                girlDB
            })
        })
    })

    
})

app.put('/:girlId', mdSameUser, (req, res) => {
    const girl = req.body;
    const girlId = req.params.girlId;

    if(girl.password) {
        girl.password = bcrypt.hashSync(girl.password, 10);
    } else {
      delete girl.password;
    }

    Girl.findByIdAndUpdate(girlId, girl, (err, girlUpdated) => {
        if(err) {
            return res.status(500).json({
                ok: false,
                error: err
            })
        }

        return res.status(200).json({
            ok: true,
            message: 'Creadora modificada correctemente'
        })
    })

})

app.delete('/:girlId', [mdAuth, mdSameUser], (req, res) => {
    const girlId = req.params.girlId;

    Girl.findOneAndDelete(girlId, (err, girlDeleted) => {
        if(err) {
            return res.status(500).json({
                ok: false,
                error: err
            })
        }

        return res.status(200).json({
            ok: true,
            message: 'Creadora eliminada correctemente'
        })
    })
})


// Login ----------------------

app.post('/login', (req, res) => {
    const body = req.body;

    Girl.findOne({email: body.email}, (err, girlDB) => {
        if(err) {
            return res.status(500).json({
                ok: false,
                error: err
            })
        }

        if(!girlDB) {
            return res.status(400).json({
                ok: false,
                message: 'El email no se encuentra registrado'
            })
        }

        if(!bcrypt.compareSync(body.password, girlDB.password)) {
            return res.status(400).json({
                ok: false,
                message: 'La contraseña es incorrecta'
            })
        }

        girlDB.password = '';

        const payload = {
            check:  true,
            girl: girlDB
        };

        const token = jwt.sign(payload, key, {
            expiresIn: "3d"
        });

        girlDB.password = '';

        return res.status(200).json({
            ok: true,
            girl: girlDB,
            token
        })
    })
})

module.exports = app;