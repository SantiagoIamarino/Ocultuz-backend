const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const subscriptionSchema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    girlId: { type: Schema.Types.ObjectId, ref: 'Girl', required: true },
    subscribedSince: { type: Date, default: new Date() },
    nextPaymentDueDate: { type: Date, required: true },
    paymentData: { type: Object, required: true },
    paymentId: { type: String, require: true },
    active: { type: Boolean, default: true }
})

subscriptionSchema.virtual('user', {
    ref: 'User',
    localField: 'userId', 
    foreignField: '_id' 
});


module.exports = mongoose.model('Subscription', subscriptionSchema);