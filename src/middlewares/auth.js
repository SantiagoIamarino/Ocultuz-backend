var jwt = require('jsonwebtoken');
var key = require('../config/vars').key;


//==========================================
// Validating token
//==========================================

module.exports.verifyToken = function( req, res, next ){

    var token = req.query.token;

    jwt.verify( token, key, ( err, decoded )=>{

        if(err){
            return res.status(401).json({
                ok: false,
                message: 'Token invalido!',
                errors: err
            })
        }
        req.user = decoded.user; 

        next();

    })


}


    
