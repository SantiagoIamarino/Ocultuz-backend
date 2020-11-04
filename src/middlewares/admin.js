
//==========================================
// Validating role
//==========================================

module.exports.verifyRole = function( req, res, next ){

    var user = req.user;

    if(user.role === 'ADMIN_ROLE'){
        next(); //Si se verifico continua con el codigo
        return;
    }else{
        return res.status(401).json({
            ok: false,
            message: 'No tienes acceso a esa ruta',
            errors: { message: 'No tienes acceso a esa ruta' }
        })
    }

}

    
