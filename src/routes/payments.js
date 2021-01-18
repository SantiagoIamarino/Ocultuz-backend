const express = require('express');
const app = express();
const nodemailer = require('nodemailer');

const User = require('../models/user');
const Purchase = require('../models/purchase');

const config = require('../config/vars');

const Openpay = require('openpay');
const openpay = new Openpay(config.openpayId, config.openpayPrivateKey, false);

const mdAuth = require('../middlewares/auth').verifyToken;
const mdSameUser = require('../middlewares/same-user').verifySameUserOrAdmin;

app.post('/create-user', mdAuth, (req, res) => {
    const customerRequest = {
        name: req.body.name,
        email: req.body.email
    }

    openpay.customers.create(customerRequest, (err, customer) => {
        if(err) {
            return res.status(500).json({
                ok: false,
                error: err
            })
        }

        return res.status(200).json({
            ok: true,
            customer
        })
    })
})

app.post('/add-card/:userId', [mdAuth, mdSameUser], (req, res) => {
    const customerId = req.body.customerId;
    const cardRequest = {
        token_id : req.body.cardData.id,
        'device_session_id' : 'sadasdasda13131da'
    }
      
    openpay.customers.cards.create(customerId, cardRequest, (error, card) =>  {
        if(error) {
            return res.status(500).json({
                ok: false,
                error
            })
        }

        User.findById(req.user._id, (err, userDB) => {
            if(err) {
                return res.status(500).json({
                    ok: false,
                    error: err
                })
            }

            const cardData = {
                ...card,
                default: (userDB.cards.length > 0) ? false : true
            }

            userDB.cards.push(cardData);

            userDB.update(userDB, (errUpdt, userUpdated) => {
                if(errUpdt) {
                    return res.status(500).json({
                        ok: false,
                        error: errUpdt
                    })
                }

                return res.status(200).json({
                    ok: true,
                    message: 'Tarjeta añadida correctamente'
                })
            })
        })
    });
})

app.post('/remove-card', [mdAuth, mdSameUser], (req, res) => {
    const body = req.body;

    openpay.customers.cards.delete(body.customerId, body.cardId, (err, cardDeleted) => {
        if(err) {
            return res.status(500).json({
                ok: false,
                error: err
            })
        }

        User.findById(req.user._id, (errUsr, userDB) => {
            if(errUsr) {
                return res.status(500).json({
                    ok: false,
                    error: errUsr
                })
            }

            const cardIndex = userDB.cards.findIndex((card => card.id == body.cardId));
            userDB.cards.splice(cardIndex, 1);

            userDB.update(userDB, (errUpdt, userUpdated) => {
                if(errUpdt) {
                    return res.status(500).json({
                        ok: false,
                        error: errUpdt
                    })
                }

                return res.status(200).json({
                    ok: true,
                    message: 'Tarjeta removida correctamente'
                })
            })
        })
    })
})

app.post('/store', [mdAuth, mdSameUser], (req, res) => {
    const body = req.body;

    if(!body.isSubscription) {
        const storeChargeRequest = {
            'method' : 'store',
            'amount' : body.amount,
            'description' : 'Contenido Ocultuz: ' + body.description
         };
         
        openpay.customers.charges.create(
            req.user.openPayCustomerId,
            storeChargeRequest, 
        (error, charge) => {
           if(error) {
               return res.status(400).json({
                   ok: false,
                   error
               })
           }

           const purchase = new Purchase({
                userId: req.user._id,
                girlId: body.girlId,
                type: body.type,
                pending: true,
                paymentId: charge.id
           })

           if(body._id) {
               purchase.contentId = body._id;
           }

           purchase.save((err, purchaseSaved) => {
               if(err) {
                   return res.status(500).json({
                       ok: false,
                       error: err
                   })
               }

               //Sending payment info email

                let transport = nodemailer.createTransport({
                    host: "smtpout.secureserver.net",
                    port: 465,
                    auth: {
                    user: "soporte@ocultuz.com",
                    pass: "soporteOcultuz"
                    }
                });

                const email = req.user.email;
                const panelUrl = 'https://sandbox-dashboard.openpay.mx/paynet-pdf/'

                const url = `${panelUrl}/${config.merchantId}/${charge.payment_method.reference}`;
            
                let html =  `<!DOCTYPE html><html><head> <meta charset="utf-8"> <meta http-equiv="x-ua-compatible" content="ie=edge"> <title>Instrucciones de pago</title> <meta name="viewport" content="width=device-width, initial-scale=1"> <style type="text/css"> /** * Google webfonts. Recommended to include the .woff version for cross-client compatibility. */ @media screen { @font-face { font-family: 'Source Sans Pro'; font-style: normal; font-weight: 400; src: local('Source Sans Pro Regular'), local('SourceSansPro-Regular'), url(https://fonts.gstatic.com/s/sourcesanspro/v10/ODelI1aHBYDBqgeIAH2zlBM0YzuT7MdOe03otPbuUS0.woff) format('woff'); } @font-face { font-family: 'Source Sans Pro'; font-style: normal; font-weight: 700; src: local('Source Sans Pro Bold'), local('SourceSansPro-Bold'), url(https://fonts.gstatic.com/s/sourcesanspro/v10/toadOcfmlt9b38dHJxOBGFkQc6VGVFSmCnC_l7QZG60.woff) format('woff'); } } /** * Avoid browser level font resizing. * 1. Windows Mobile * 2. iOS / OSX */ body, table, td, a { -ms-text-size-adjust: 100%; /* 1 */ -webkit-text-size-adjust: 100%; /* 2 */ } /** * Remove extra space added to tables and cells in Outlook. */ table, td { mso-table-rspace: 0pt; mso-table-lspace: 0pt; } /** * Better fluid images in Internet Explorer. */ img { -ms-interpolation-mode: bicubic; } .showy{height:100% !important;  width: 300px !important;} .no-showy{display: none} /** * Remove blue links for iOS devices. */ a[x-apple-data-detectors] { font-family: inherit !important; font-size: inherit !important; font-weight: inherit !important; line-height: inherit !important; color: inherit !important; text-decoration: none !important; } /** * Fix centering issues in Android 4.4. */ div[style*="margin: 16px 0;"] { margin: 0 !important; } body { width: 100% !important; height: 100% !important; padding: 0 !important; margin: 0 !important; } /** * Collapse table borders to avoid space between cells. */ table { border-collapse: collapse !important; } a { color: #1a82e2; } img { height: auto; line-height: 100%; text-decoration: none; border: 0; outline: none; } </style></head><body style="background-color: #e9ecef;"> <!-- start preheader --> <div class="preheader" style="display: none; max-width: 0; max-height: 0; overflow: hidden; font-size: 1px; line-height: 1px; color: #fff; opacity: 0;"> A preheader is the short summary text that follows the subject line when an email is viewed in the inbox. </div> <!-- end preheader --> <!-- start body --> <table border="0" cellpadding="0" cellspacing="0" width="100%"> <!-- start logo --> <tr> <td align="center" bgcolor="#e9ecef"> <!--[if (gte mso 9)|(IE)]> <table align="center" border="0" cellpadding="0" cellspacing="0" width="600"> <tr> <td align="center" valign="top" width="600"> <![endif]--> <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px;"> <tr> <td align="center" valign="top" style="padding: 36px 24px;"> <a href="${url}" target="_blank" style="display: inline-block;"> `;
            
                if(email.indexOf('@gmail.') > 0) {
                    html += `<img src="cid:logoocultuz">`;
                } else {
                    html += `<img class="showy" width="0" height="0" src="https://ocultuz.com/assets/graphics/Logo.svg"><img class="no-showy" src="https://ocultuz.com/assets/graphics/Logo.jpg">`;
                }
            
                html +=  ` </a> </td> </tr> </table> <!--[if (gte mso 9)|(IE)]> </td> </tr> </table> <![endif]--> </td> </tr> <!-- end logo --> <!-- start hero --> <tr> <td align="center" bgcolor="#e9ecef"> <!--[if (gte mso 9)|(IE)]> <table align="center" border="0" cellpadding="0" cellspacing="0" width="600"> <tr> <td align="center" valign="top" width="600"> <![endif]--> <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px;"> <tr> <td align="left" bgcolor="#ffffff" style="padding: 36px 24px 0; font-family: 'Source Sans Pro', Helvetica, Arial, sans-serif; border-top: 3px solid #d4dadf;"> <h1 style="margin: 0; font-size: 32px; font-weight: 700; letter-spacing: -1px; line-height: 48px;">Reestablece tu contraseña</h1> </td> </tr> </table> <!--[if (gte mso 9)|(IE)]> </td> </tr> </table> <![endif]--> </td> </tr> <!-- end hero --> <!-- start copy block --> <tr> <td align="center" bgcolor="#e9ecef"> <!--[if (gte mso 9)|(IE)]> <table align="center" border="0" cellpadding="0" cellspacing="0" width="600"> <tr> <td align="center" valign="top" width="600"> <![endif]--> <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px;"> <!-- start copy --> <tr> <td align="left" bgcolor="#ffffff" style="padding: 24px; font-family: 'Source Sans Pro', Helvetica, Arial, sans-serif; font-size: 16px; line-height: 24px;"> <p style="margin: 0;">Haz click en el botón a continuación para ver tu recibo de pago, con el podrás acercarte a tu tienda de conveniencia mas cercana y realizar el pago.</p> </td> </tr> <!-- end copy --> <!-- start button --> <tr> <td align="left" bgcolor="#ffffff"> <table border="0" cellpadding="0" cellspacing="0" width="100%"> <tr> <td align="center" bgcolor="#ffffff" style="padding: 12px;"> <table border="0" cellpadding="0" cellspacing="0"> <tr> <td align="center" bgcolor="#1a82e2" style="border-radius: 6px;"> <a href="${url}" target="_blank" style="display: inline-block; padding: 16px 36px; font-family: 'Source Sans Pro', Helvetica, Arial, sans-serif; font-size: 16px; color: #ffffff; text-decoration: none; border-radius: 6px;">Instrucciones de pago</a> </td> </tr> </table> </td> </tr> </table> </td> </tr> <!-- end button --> <!-- start copy --> <tr> <td align="left" bgcolor="#ffffff" style="padding: 24px; font-family: 'Source Sans Pro', Helvetica, Arial, sans-serif; font-size: 16px; line-height: 24px;"> <p style="margin: 0;">Si el botón anterior no llegara a funcionar simplemente copia y pega el siguiente link en tu navegador</p> <p style="margin: 0;"><a href="${url}" target="_blank">${url}</a></p> </td> </tr> <!-- end copy --> <!-- start copy --> <tr> <td align="left" bgcolor="#ffffff" style="padding: 24px; font-family: 'Source Sans Pro', Helvetica, Arial, sans-serif; font-size: 16px; line-height: 24px; border-bottom: 3px solid #d4dadf"> <p style="margin: 0;">Un saludo,<br> Equipo de Ocultuz</p> </td> </tr> <!-- end copy --> </table> <!--[if (gte mso 9)|(IE)]> </td> </tr> </table> <![endif]--> </td> </tr> <!-- end copy block --> <!-- start footer --> <tr> <td align="center" bgcolor="#e9ecef" style="padding: 24px;"> <!--[if (gte mso 9)|(IE)]> <table align="center" border="0" cellpadding="0" cellspacing="0" width="600"> <tr> <td align="center" valign="top" width="600"> <![endif]--> <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px;"> <!-- start permission --> <tr> <td align="center" bgcolor="#e9ecef" style="padding: 12px 24px; font-family: 'Source Sans Pro', Helvetica, Arial, sans-serif; font-size: 14px; line-height: 20px; color: #666;"> <p style="margin: 0;">Haz recibido este correo ya que se ha realizado una petición de compra mediante tienda de conveniencia - Ocultuz</p> </td> </tr> <!-- end permission --> <!-- start unsubscribe --> <tr> <td align="center" bgcolor="#e9ecef" style="padding: 12px 24px; font-family: 'Source Sans Pro', Helvetica, Arial, sans-serif; font-size: 14px; line-height: 20px; color: #666;"> <p style="margin: 0;">Si no fuiste tú quien realizo dicha petición simplemente ignora este mensaje.</p> <p style="margin: 0;">&copy; Ocultuz 2021</p> </td> </tr> <!-- end unsubscribe --> </table> <!--[if (gte mso 9)|(IE)]> </td> </tr> </table> <![endif]--> </td> </tr> <!-- end footer --> </table> <!-- end body --></body></html>`;
            
                const message = {
                    from: 'ocultuz@ocultuz.com',
                    to: email,
                    subject: 'Instrucciones de pago | Ocultuz',
                    html:html
                };
            
                if(email.indexOf('@gmail.') > 0) {
                    message.attachments = [{
                    filename: 'Logo.png',
                    path: 'src/assets/Logo.png',
                    cid: 'logoocultuz'
                    }]
                }
            
                transport.sendMail(message, function(err, info) {
                    console.log(err, info);
                    if (err) {
                        return res.status(500).json({
                            ok: false,
                            error: err
                        })
                    } else {
                        return res.status(200).json({
                            ok: true,
                            message: 'Te hemos enviado un correo a ' + req.user.email + ' sigue los pasos para continuar la compra!'
                        })
                    }
                });

                
            })
        });
    }
})


module.exports = app;