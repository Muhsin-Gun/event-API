// controllers/mpesaController.js
const axios = require('axios');
const moment = require('moment');
const Payment = require('../models/payment');
const Event = require('../models/event');
const createError = require('http-errors');

const getAccessToken = async () => {
  const auth = Buffer.from(`${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`).toString('base64');
  const url =
    process.env.MPESA_ENV === 'production'
      ? 'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials'
      : 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials';
  const resp = await axios.get(url, { headers: { Authorization: `Basic ${auth}` } });
  return resp.data.access_token;
};

const stkPushUrl = (env) =>
  env === 'production'
    ? 'https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest'
    : 'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest';

function normalizePhone(msisdn) {
  // Expect 2547XXXXXXXX; convert common Kenyan 07XXXXXXXX to 2547XXXXXXXX
  const cleaned = String(msisdn).replace(/\D/g, '');
  if (cleaned.startsWith('07')) return '254' + cleaned.slice(1);
  if (cleaned.startsWith('7')) return '254' + cleaned;
  if (cleaned.startsWith('254')) return cleaned;
  return cleaned;
}

module.exports.initiateStkPush = async (req, res, next) => {
  try {
    const { eventId, phone } = req.body;
    if (!eventId || !phone) throw createError.BadRequest('eventId and phone required');

    const userId = req.payload?.aud;
    if (!userId) return next(createError.Unauthorized());

    const event = await Event.findById(eventId);
    if (!event) return next(createError.NotFound('Event not found'));
    if (typeof event.price !== 'number' || event.price <= 0) {
      return next(createError.BadRequest('Event has no valid price'));
    }

    // Always compute amount server-side
    const amount = Math.round(event.price); // assume price stored as KES integer
    const phoneNorm = normalizePhone(phone);
    if (!/^2547\d{8}$/.test(phoneNorm)) return next(createError.BadRequest('Invalid phone format (use 2547XXXXXXXX)'));

    const timestamp = moment().format('YYYYMMDDHHmmss');
    const password = Buffer.from(`${process.env.MPESA_SHORT_CODE}${process.env.MPESA_PASSKEY}${timestamp}`).toString('base64');
    const token = await getAccessToken();

    const payment = await Payment.create({
      user: userId,
      event: eventId,
      amount,
      phone: phoneNorm,
      status: 'PENDING',
    });

    const payload = {
      BusinessShortCode: process.env.MPESA_SHORT_CODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: amount,
      PartyA: phoneNorm,
      PartyB: process.env.MPESA_SHORT_CODE,
      PhoneNumber: phoneNorm,
      CallBackURL: process.env.MPESA_CALLBACK_URL,
      AccountReference: `EVT-${eventId}`,
      TransactionDesc: `Event Ticket ${event.title}`,
    };

    const { data } = await axios.post(stkPushUrl(process.env.MPESA_ENV), payload, {
      headers: { Authorization: `Bearer ${token}` },
    });

    await Payment.findByIdAndUpdate(payment._id, {
      merchantRequestID: data.MerchantRequestID,
      checkoutRequestID: data.CheckoutRequestID,
    });

    res.json({ message: 'STK push initiated', paymentId: payment._id, mpesa: data });
  } catch (err) {
    next(err);
  }
};

module.exports.mpesaCallback = async (req, res, next) => {
  try {
    const body = req.body;
    const result = body?.Body?.stkCallback;
    if (!result) return res.status(200).json({ ok: true });

    const { CheckoutRequestID, ResultCode, CallbackMetadata } = result;
    const payment = await Payment.findOne({ checkoutRequestID: CheckoutRequestID });
    if (!payment) return res.status(200).json({ ok: true });

    if (ResultCode === 0) {
      const items = (CallbackMetadata && CallbackMetadata.Item) || [];
      const receipt = (items.find((i) => i.Name === 'MpesaReceiptNumber') || {}).Value;
      await Payment.findByIdAndUpdate(payment._id, {
        status: 'SUCCESS',
        mpesaReceiptNumber: receipt,
        rawCallback: body,
      });
    } else {
      await Payment.findByIdAndUpdate(payment._id, { status: 'FAILED', rawCallback: body });
    }

    // Respond as required by Daraja
    res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
  } catch (err) {
    next(err);
  }
};


