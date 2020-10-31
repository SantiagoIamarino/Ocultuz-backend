
//==========================================
// Validating role
//==========================================

module.exports.verifyRole = function( req, res, next ){

    var user = req.user;

    var userid = req.params.id;

    if(user.role === 'ADMIN_ROLE' || userid === user._id){
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

    
