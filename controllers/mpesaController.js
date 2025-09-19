const axios = require('axios');
const moment = require('moment');
const Payment = require('../models/payment');
const Event = require('../models/event');
const createError = require('http-errors');

/**
 * Get Daraja OAuth token
 * Fake mode: returns null token to force simulation
 */
const getAccessToken = async () => {
  const consumerKey = process.env.MPESA_CONSUMER_KEY;
  const consumerSecret = process.env.MPESA_CONSUMER_SECRET;

  if (!consumerKey || !consumerSecret) return null;

  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
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
  const cleaned = String(msisdn).replace(/\D/g, '');
  if (cleaned.startsWith('07')) return '254' + cleaned.slice(1);
  if (cleaned.startsWith('7')) return '254' + cleaned;
  if (cleaned.startsWith('254')) return cleaned;
  return cleaned;
}

/**
 * Initiate STK Push (Fake/Simulated)
 */
module.exports.initiateStkPush = async (req, res, next) => {
  try {
    const { eventId, phone, payment: clientPayment } = req.body;

    if (!phone) throw createError.BadRequest('phone required');

    const userId = req.payload?.aud;
    if (!userId) return next(createError.Unauthorized());

    // find event if eventId provided
    let event = null;
    if (eventId) {
      try {
        event = await Event.findById(eventId);
        if (!event) throw createError.NotFound('Event not found');
      } catch {
        event = null;
      }
    }

    // determine amount
    let amount;
    if (event && event.price > 0) {
      amount = Math.round(event.price);
    } else if (clientPayment) {
      // remove any non-digit, e.g., "200ksh" => 200
      const cleaned = String(clientPayment).replace(/\D/g, '');
      amount = Number(cleaned);
    } else {
      return next(createError.BadRequest('Event has no valid price and no amount provided'));
    }

    const phoneNorm = normalizePhone(phone);
    if (!/^2547\d{8}$/.test(phoneNorm)) return next(createError.BadRequest('Invalid phone format (use 2547XXXXXXXX)'));

    // Create payment record
    const payment = await Payment.create({
      user: userId,
      event: event ? event._id : undefined,
      amount,
      phone: phoneNorm,
      status: 'PENDING',
    });

    // FAKE/SIMULATED MODE
    await Payment.findByIdAndUpdate(payment._id, {
      merchantRequestID: `DEV-MERCHANT-${payment._id}`,
      checkoutRequestID: `DEV-CHECKOUT-${payment._id}`,
      status: 'PENDING',
    });

    return res.json({
      success: true,
      message: 'Dev: Simulated STK push created.',
      paymentId: payment._id,
      simulated: true,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * MPESA callback endpoint (unchanged)
 */
module.exports.mpesaCallback = async (req, res, next) => {
  try {
    const body = req.body;
    const result = body?.Body?.stkCallback;
    if (!result) return res.status(200).json({ ok: true });

    const { CheckoutRequestID, ResultCode, CallbackMetadata } = result;

    const payment = await Payment.findOne({
      $or: [
        { checkoutRequestID: CheckoutRequestID },
        { checkoutRequestID: { $exists: true, $eq: CheckoutRequestID } },
      ],
    });

    if (!payment) {
      console.warn('MPESA callback: payment not found for CheckoutRequestID:', CheckoutRequestID);
      return res.status(200).json({ ok: true });
    }

    if (ResultCode === 0) {
      const items = CallbackMetadata?.Item || [];
      const receipt = (items.find((i) => i.Name === 'MpesaReceiptNumber') || {}).Value;
      await Payment.findByIdAndUpdate(payment._id, {
        status: 'SUCCESS',
        mpesaReceiptNumber: receipt,
        rawCallback: body,
      });
    } else {
      await Payment.findByIdAndUpdate(payment._id, { status: 'FAILED', rawCallback: body });
    }

    res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
  } catch (err) {
    next(err);
  }
};
