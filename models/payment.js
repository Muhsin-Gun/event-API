const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: false }, // made optional
  amount: { type: Number, required: true, min: 0 },
  method: { type: String, enum: ['mpesa'], default: 'mpesa' },
  status: { type: String, enum: ['PENDING', 'SUCCESS', 'FAILED'], default: 'PENDING' },
  phone: { type: String, required: true },
  merchantRequestID: String,
  checkoutRequestID: String,
  mpesaReceiptNumber: String,
  rawCallback: { type: Object },
}, { timestamps: true });

module.exports = mongoose.model('Payment', paymentSchema);
