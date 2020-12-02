const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const purchaseSchema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    girlId: { type: Schema.Types.ObjectId, ref: 'Girl', required: true },
    contentId: { type: Schema.Types.ObjectId, ref: 'Content' },
    type: { type: String, required: true },
    date: { type: Date, default: new Date() }
})


module.exports = mongoose.model('Purchase', purchaseSchema);