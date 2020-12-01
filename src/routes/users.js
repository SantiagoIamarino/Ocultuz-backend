const express = require('express');
const bcrypt = require('bcrypt');
const User = require('../models/user');
const UserDeleted = require('../models/user-deleted');
const EmailRecover = require('../models/email-recover');

const jwt = require('jsonwebtoken');
const key = require('../config/vars').key;

const mdAuth = require('../middlewares/auth').verifyToken;
const mdSameUser = require('../middlewares/same-user').verifySameUserOrAdmin;
const mdAdmin = require('../middlewares/admin').verifyRole;

const app = express();

app.get('/', [mdAuth, mdAdmin], (req, res) => {

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

app.get('/admins', [mdAuth, mdAdmin], (req, res) => {
    if(req.user.adminRole !== 'PRINCIPAL'){
        return res.status(400).json({
            ok: false,
            message: 'No tienes permiso para realizar esta acción'
        })
    }

    User.find({role: 'ADMIN_ROLE'}, (err, admins) => {

        if(err) {
            return res.status(500).json({
                ok: false,
                error: err
            })
        }

        return res.status(200).json({
            ok: true,
            admins
        })

    })

})

app.get('/:userId', [mdAuth, mdSameUser], (req, res) => {

    const userId = req.params.userId;

    User.findById(userId, 'name email birthDay role adminRole subscriptions status', (err, user) => {

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

function createUser(body, res) {
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
}

app.post('/', (req, res) => {
    const body = req.body;

    body.role = 'USER_ROLE';

    createUser(body, res);
})

app.post('/admin', [mdAuth, mdAdmin], (req, res) => {

    if(req.user.adminRole !== 'PRINCIPAL'){
        return res.status(400).json({
            ok: false,
            message: 'No tienes permiso para realizar esta acción'
        })
    }

    const body = req.body;

    body.role = 'ADMIN_ROLE';

    createUser(body, res);
})

app.post('/panel', [mdAuth, mdAdmin], (req, res) => { //Get users by filters

    const filters = req.body.filters;
    const regex = new RegExp( filters.text, 'i' );

    const mongooseFilters = {
        $or:[ {'name':regex}, {'email':regex} ],
        status: filters.status
    }

    const page = parseInt(req.body.pagination.page);
    const perPage = parseInt(req.body.pagination.perPage);  
  
    User.find(mongooseFilters)
    .skip((page - 1) * perPage)
    .limit(perPage)
    .exec((err, users) => {
  
        if(err) {
            return res.status(500).json({
                ok: false,
                error: err
            })
        }
  
        User.count(mongooseFilters, (errCount, total) => {
            return res.status(200).json({
              ok: true,
              users,
              pagination: {
                total,
                currentPage: page,
                lastPage: Math.ceil(total / perPage)
              }
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

app.put('/status/:userId', [mdAuth, mdAdmin], (req, res) => {
    const status = req.body.newStatus;
    const userId = req.params.userId;

    User.findById(userId, (err, userDB) => {
        if(err) {
            return res.status(500).json({
                ok: false,
                error: err
            })
        }

        if(!userDB) {
            return res.status(400).json({
                ok: false,
                message: 'El usuario no existe'
            })
        }

        userDB.status = status;

        userDB.update(userDB, (errUpdt, userUpdated) => {
            if(errUpdt) {
                return res.status(500).json({
                    ok: false,
                    error: errUpdt
                })
            }

            return res.status(200).json({
                ok: true,
                message: 'Usuario modificado correctemente'
            })
        })
    })

})

app.delete('/:userId', [mdAuth, mdSameUser], (req, res) => {
    const userId = req.params.userId;

    User.findOneAndDelete({_id: userId}, (err, userDeleted) => {
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

        if(!userDB.emailVerified) {
            console.log(userDB.emailVerified);
            return res.status(400).json({
                ok: false,
                message: 'Tu email no se ha verificado aún, revisa tu correo'
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

        return res.status(200).json({
            ok: true,
            user: userDB,
            token
        })
    })
})

// Validate account

app.get('/validate-account/:code', (req, res) => {
  const code = req.params.code;

  EmailRecover.findOne({code: code}, (err, emailRecoverDB) => {
    if(err) {
      return res.status(500).json({
        ok: false,
        error: err
      })
    }

    if(!emailRecoverDB) {
      return res.status(400).json({
        ok: false,
        message: 'No existe este link o expiró'
      })
    }

    User.findById(emailRecoverDB.userId, (errUsr, userDB) => {
      if(errUsr) {
        return res.status(500).json({
          ok: false,
          error: errUsr
        })
      }

      if(!userDB) {
        return res.status(400).json({
          ok: false,
          message: 'El usuario no existe'
        })
      }

      userDB.emailVerified = true;

      userDB.update(userDB, (errUpdt, userUpdated) => {
        if(errUpdt) {
          return res.status(500).json({
            ok: false,
            error: errUpdt
          })
        }

        EmailRecover.findOneAndDelete({code: code}, (errDlt, regDeleted) => {
          return res.status(200).json({
              ok: true,
              message: 'Has verificado tu cuenta correctamente, ya puedes iniciar sesión'
          })
      })

      })
    })

  })

})

// Recover Password

app.post('/recover-password', (req, res) => {
    const body = req.body;

    EmailRecover.find({email: body.userData.email}, (err, emailsRecoverDB) => {
        if(err) {
            return res.status(500).json({
                ok: false,
                error: err
            })
        }

        if(emailsRecoverDB.length <= 0) {
            return res.status(400).json({
                ok: false,
                message: 'No se ha solicitado un cambio de contraseña para este email'
            })
        }

        const emailRecoverDB = emailsRecoverDB[emailsRecoverDB.length - 1];

        if(emailRecoverDB.code !== body.code) {
            return res.status(400).json({
                ok: false,
                message: 'El link no es válido'
            })
        }

        User.findById(emailRecoverDB.userId, (errUser, userDB) => {
            if(errUser) {
                return res.status(500).json({
                    ok: false,
                    error: errUser
                })
            }

            const newPassword = bcrypt.hashSync(body.userData.password, 10);

            userDB.password = newPassword;

            userDB.update(userDB, (errUpdt, userUpdated) => {
                if(errUpdt) {
                    return res.status(500).json({
                        ok: false,
                        error: errUpdt
                    })
                }

                EmailRecover.findOneAndDelete({email: body.userData.email}, (errDlt, regDeleted) => {
                    return res.status(200).json({
                        ok: true,
                        message: 'La contraseña se ha modificado correctamente'
                    })
                })
            })
        })
    })
})


module.exports = app;