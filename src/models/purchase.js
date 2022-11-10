const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const purchaseSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  girlId: { type: Schema.Types.ObjectId, ref: "Girl", required: true },
  description: { type: String },
  contentType: { type: String },
  type: { type: String, required: true },
  date: { type: Date, default: new Date() },
  pending: { type: Boolean, default: false },
  hasBeenSent: { type: Boolean, default: false },
  paymentId: { type: String },
  contentUrl: { type: String, default: null },
  amount: { type: String, default: 0 },
});

module.exports = mongoose.model("Purchase", purchaseSchema);
