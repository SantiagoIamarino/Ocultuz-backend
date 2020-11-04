
//===================================================
// Validating user (only same user or admin allowed)
//===================================================

module.exports.verifySameUserOrAdmin = function( req, res, next ){
    const userId = req.params.userId;
    const requestUser = req.user;

    if(requestUser.role !== 'ADMIN_ROLE' && userId !== requestUser._id) {
        return res.status(401).json({
            ok: false,
            message: 'No tienes permiso para realizar esta accion'
        })
    }

    next();


}

