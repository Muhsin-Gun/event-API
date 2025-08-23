const axios = require('axios');
const moment = require('moment');
const Payment = require('../models/payment');
const createError = require('http-errors');

const getAccessToken = async () => {
  const auth = Buffer.from(`${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`).toString('base64');
  const url = process.env.MPESA_ENV === 'production'
    ? 'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials'
    : 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials';
  const resp = await axios.get(url, { headers: { Authorization: `Basic ${auth}` } });
  return resp.data.access_token;
};

const stkPushUrl = (env) =>
  env === 'production'
    ? 'https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest'
    : 'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest';

module.exports.initiateStkPush = async (req, res, next) => {
  try {
    const { eventId, phone, amount } = req.body;
    if (!eventId || !phone || !amount) throw createError.BadRequest('eventId, phone, amount required');

    const timestamp = moment().format('YYYYMMDDHHmmss');
    const password = Buffer.from(`${process.env.MPESA_SHORT_CODE}${process.env.MPESA_PASSKEY}${timestamp}`).toString('base64');
    const token = await getAccessToken();

    const payment = await Payment.create({
      user: req.payload?.aud, event: eventId, amount, phone, status: 'PENDING'
    });

    const payload = {
      BusinessShortCode: process.env.MPESA_SHORT_CODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: amount,
      PartyA: phone,
      PartyB: process.env.MPESA_SHORT_CODE,
      PhoneNumber: phone,
      CallBackURL: process.env.MPESA_CALLBACK_URL,
      AccountReference: `EVT-${eventId}`,
      TransactionDesc: 'Event Ticket',
    };

    const { data } = await axios.post(stkPushUrl(process.env.MPESA_ENV), payload, {
      headers: { Authorization: `Bearer ${token}` }
    });

    await Payment.findByIdAndUpdate(payment._id, {
      merchantRequestID: data.MerchantRequestID,
      checkoutRequestID: data.CheckoutRequestID
    });

    res.json({ message: 'STK push initiated', paymentId: payment._id, mpesa: data });
  } catch (err) {
    next(err);
  }
};

module.exports.mpesaCallback = async (req, res, next) => {
  try {
    const body = req.body;
    // Safaricom posts result in this shape:
    const result = body?.Body?.stkCallback;
    if (!result) return res.status(200).json({ ok: true });

    const { MerchantRequestID, CheckoutRequestID, ResultCode, CallbackMetadata } = result;

    const payment = await Payment.findOne({ checkoutRequestID: CheckoutRequestID });
    if (!payment) return res.status(200).json({ ok: true });

    if (ResultCode === 0) {
      const receipt = CallbackMetadata?.Item?.find(i => i.Name === 'MpesaReceiptNumber')?.Value;
      await Payment.findByIdAndUpdate(payment._id, {
        status: 'SUCCESS',
        mpesaReceiptNumber: receipt,
        rawCallback: body
      });
    } else {
      await Payment.findByIdAndUpdate(payment._id, { status: 'FAILED', rawCallback: body });
    }

    res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
  } catch (err) {
    next(err);
  }
};
