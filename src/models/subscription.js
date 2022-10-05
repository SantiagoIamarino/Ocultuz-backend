const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const subscriptionSchema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    girlId: { type: Schema.Types.ObjectId, ref: 'Girl', required: true },
    subscribedSince: { type: Date, default: new Date() },
    subscriptionEnds: { type: Date, required: true },
    nextPaymentDueDate: { type: Date, required: true },
    status: { type: String, default: 'completed' },
    paymentData: { type: Object, required: true },
    paymentId: { type: String, require: true },
    active: { type: Boolean, default: false }
})

subscriptionSchema.virtual('user', {
    ref: 'User',
    localField: 'userId', 
    foreignField: '_id' 
});


module.exports = mongoose.model('Subscription', subscriptionSchema);