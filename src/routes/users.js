const express = require('express');
const bcrypt = require('bcrypt');
const User = require('../models/user');
const UserDeleted = require('../models/user-deleted');

const jwt = require('jsonwebtoken');
const key = require('../config/vars').key;

const mdAuth = require('../middlewares/auth').verifyToken;
const mdSameUser = require('../middlewares/same-user').verifySameUserOrAdmin;
const mdAdmin = require('../middlewares/admin').verifyRole;

const app = express();

app.get('/', mdAdmin, (req, res) => {

    User.find({}, (err, users) => {

        if(err) {
            return res.status(500).json({
                ok: false,
                error: err
            })
        }

        return res.status(200).json({
            ok: true,
            users
        })

    })

})

app.get('/:userId', [mdAuth, mdSameUser], (req, res) => {

    const userId = req.params.userId;

    User.findById(userId, 'name email birthDay', (err, user) => {

        if(err) {
            return res.status(500).json({
                ok: false,
                error: err
            })
        }

        if(!user) {
            return res.status(400).json({
                ok: false,
                message: 'No se ha encontrado ningun usuario con ese ID'
            })
        }

        return res.status(200).json({
            ok: true,
            user
        })

    })

})

app.post('/', (req, res) => {
    const body = req.body;

    User.findOne({email: body.email}, (err, userDB) => {
        if(err) {
            return res.status(500).json({
                ok: false,
                error: err
            })
        }

        if(userDB) {
            return res.status(400).json({
                ok: false,
                message: 'El email ya se encuentra registrado'
            })
        }

        body.password = bcrypt.hashSync(body.password, 10);

        const user = new User(body);

        user.save((err, userDB) => {
            if(err) {
                return res.status(500).json({
                    ok: false,
                    error: err
                })
            }

            userDB.password = '';

            return res.status(201).json({
                ok: true,
                message: 'Te has registrado correctamente',
                userDB
            })
        })
    })
})

app.put('/:userId', [mdAuth, mdSameUser], (req, res) => {
    const user = req.body;
    const userId = req.params.userId;

    if(user.password) {
        user.password = bcrypt.hashSync(user.password, 10);
    } else {
      delete user.password;
    }

    User.findByIdAndUpdate(userId, user, (err, userUpdated) => {
        if(err) {
            return res.status(500).json({
                ok: false,
                error: err
            })
        }

        return res.status(200).json({
            ok: true,
            message: 'Usuario modificado correctemente'
        })
    })

})

app.delete('/:userId', [mdAuth, mdSameUser], (req, res) => {
    const userId = req.params.userId;

    User.findOneAndDelete(userId, (err, userDeleted) => {
        if(err) {
            return res.status(500).json({
                ok: false,
                error: err
            })
        }

        const userDeletedRegister = new UserDeleted({
          userDeleted,
          deletedDate: new Date()
        })

        userDeletedRegister.save((errInReg, userRegisteredAsDeleted) => {
          if(errInReg) {
              return res.status(500).json({
                  ok: false,
                  error: errInReg
              })
          }

          return res.status(200).json({
              ok: true,
              message: 'Usuario eliminado correctemente'
          })
        })

        
    })
})


// Login ----------------------

app.post('/login', (req, res) => {
    const body = req.body;

    User.findOne({email: body.email}, (err, userDB) => {
        if(err) {
            return res.status(500).json({
                ok: false,
                error: err
            })
        }

        if(!userDB) {
            return res.status(400).json({
                ok: false,
                message: 'El email no se encuentra registrado'
            })
        }

        if(!bcrypt.compareSync(body.password, userDB.password)) {
            return res.status(400).json({
                ok: false,
                message: 'La contraseña es incorrecta'
            })
        }

        userDB.password = '';

        const payload = {
            check:  true,
            user: userDB
        };

        const token = jwt.sign(payload, key, {
            expiresIn: "3d"
        });

        userDB.password = '';

        return res.status(200).json({
            ok: true,
            user: userDB,
            token
        })
    })
})

module.exports = app;