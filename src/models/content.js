const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const contentSchema = new Schema({
    type: { type: String, required: true },
    girlId: { type: Schema.Types.ObjectId, ref: 'Girl', required: true },
    amount: { type: String },
    description: { type: String },
    fileUrl: { type: String, required: true },
    preview: { type: String },
    allowed: { type: Boolean, default: true }
})

module.exports = mongoose.model('Content', contentSchema);