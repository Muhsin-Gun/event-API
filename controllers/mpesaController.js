// controllers/mpesaController.js
const axios = require('axios');
const moment = require('moment');
const mongoose = require('mongoose');
const Payment = require('../models/payment');
const Event = require('../models/event');
const createError = require('http-errors');

/**
 * Get Daraja OAuth token - Fixed version
 * - Uses MPESA_CONSUMER_KEY and MPESA_CONSUMER_SECRET from .env (we updated them).
 * - Proper base64 encoding and robust error reporting.
 */
const getAccessToken = async () => {
  const consumerKey = process.env.MPESA_CONSUMER_KEY;
  const consumerSecret = process.env.MPESA_CONSUMER_SECRET;

  if (!consumerKey || !consumerSecret) {
    throw new Error('MPESA credentials not configured in environment variables');
  }

  const credentials = `${consumerKey}:${consumerSecret}`;
  const auth = Buffer.from(credentials).toString('base64');

  const url =
    process.env.MPESA_ENV === 'production'
      ? 'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials'
      : 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials';

  try {
    console.log('Requesting OAuth token from:', url);
    console.log('Using Consumer Key:', consumerKey.substring(0, 10) + '...');

    const response = await axios.get(url, {
      headers: {
        Authorization: `Basic ${auth}`, // Basic <base64(key:secret)>
        // DO NOT need Content-Type for GET, but harmless in many cases
        'Cache-Control': 'no-cache'
      },
      timeout: 30000
    });

    if (response.data && response.data.access_token) {
      console.log('OAuth token obtained successfully');
      return response.data.access_token;
    }

    console.error('Invalid OAuth response format:', response.data);
    throw new Error('Invalid OAuth response format');
  } catch (error) {
    // Detailed logging for debugging
    console.error('OAuth Error Details:');
    console.error('Status:', error.response?.status ?? 'NO_RESPONSE_STATUS');
    console.error('Headers:', error.response?.headers ?? 'NO_HEADERS');
    console.error('Data:', error.response?.data ?? 'NO_DATA');
    console.error('Message:', error.message);

    if (error.response?.data) {
      // Provide the daraja response if available
      throw new Error(`M-Pesa OAuth failed: ${JSON.stringify(error.response.data)}`);
    }
    throw new Error(`Failed to authenticate with M-Pesa: ${error.message}`);
  }
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
 * Generate timestamp for M-Pesa (Fixed format)
 */
function generateTimestamp() {
  return moment().format('YYYYMMDDHHmmss'); // e.g. 20250924230756
}

/**
 * Generate password for M-Pesa STK Push (Fixed implementation)
 */
function generatePassword(shortCode, passkey, timestamp) {
  const data = `${shortCode}${passkey}${timestamp}`;
  return Buffer.from(data).toString('base64');
}

/**
 * Initiate Real STK Push - Completely Fixed (keeps your original logic)
 */
module.exports.initiateStkPush = async (req, res, next) => {
  try {
    const { eventId, phone, payment: clientPayment, phoneNumber } = req.body;

    // Handle different phone field names from frontend
    const phoneToUse = phone || phoneNumber;

    if (!phoneToUse) {
      throw createError.BadRequest('Phone number required');
    }

    // Validate JWT payload user id if middleware attaches it as req.payload.aud
    const userId = req.payload?.aud;
    if (!userId) {
      return next(createError.Unauthorized());
    }

    // Find event if eventId provided
    let event = null;
    let eventTitle = 'Event Ticket';

    if (eventId && eventId !== 'car-auction-live' && eventId !== 'car-auction-employee') {
      try {
        // Avoid Cast to ObjectId failed errors for non-ObjectId ids (like 'vip')
        if (mongoose.Types.ObjectId.isValid(eventId)) {
          event = await Event.findById(eventId);
          if (event) {
            eventTitle = event.title;
          }
        } else {
          // Not a DB ObjectId — probably a frontend plan id (e.g. 'vip'). Ignore lookup.
          event = null;
        }
      } catch (err) {
        // Keep behavior: if lookup fails, continue gracefully
        console.log('Event lookup failed:', err.message);
        event = null;
      }
    } else if (eventId === 'car-auction-live' || eventId === 'car-auction-employee') {
      eventTitle = 'CarAuction Live Event';
    }

    // Determine amount
    let amount;
    if (event && event.price > 0) {
      amount = Math.round(event.price);
    } else if (clientPayment) {
      const cleaned = String(clientPayment).replace(/\D/g, '');
      amount = Number(cleaned);
    } else {
      // Default amount for testing
      amount = 1;
    }

    // Validate amount
    if (amount < 1) {
      return next(createError.BadRequest('Amount must be at least 1 KES'));
    }

    const phoneNorm = normalizePhone(phoneToUse);
    if (!/^2547\d{8}$/.test(phoneNorm)) {
      return next(createError.BadRequest(`Invalid phone format. Received: ${phoneNorm}. Expected format: 254712345678`));
    }

    console.log('Processing STK Push:');
    console.log('Event:', eventTitle);
    console.log('Amount:', amount);
    console.log('Phone:', phoneNorm);

    // Create payment record first (PENDING)
    const payment = await Payment.create({
      user: userId,
      event: event ? event._id : undefined,
      amount,
      phone: phoneNorm,
      status: 'PENDING'
    });

    console.log('Payment record created:', payment._id);

    // Get access token
    const accessToken = await getAccessToken();
    console.log('Access token obtained');

    // Prepare STK Push request with correct values
    const timestamp = generateTimestamp();
    const shortCode = process.env.MPESA_SHORTCODE;
    const passkey = process.env.MPESA_PASSKEY;

    if (!shortCode || !passkey) {
      // Defensive check
      console.error('MPESA_SHORTCODE or MPESA_PASSKEY missing from .env');
      return res.status(500).json({ success: false, message: 'M-Pesa configuration missing' });
    }

    const password = generatePassword(shortCode, passkey, timestamp);
    const callbackURL = process.env.MPESA_CALLBACK_URL || 'https://mydomain.com/callback';

    console.log('STK Push Parameters:');
    console.log('ShortCode:', shortCode);
    console.log('Timestamp:', timestamp);
    console.log('CallbackURL:', callbackURL);

    const stkPushPayload = {
      BusinessShortCode: shortCode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: amount,
      PartyA: phoneNorm,
      PartyB: shortCode,
      PhoneNumber: phoneNorm,
      CallBackURL: callbackURL,
      AccountReference: `REF${payment._id}`,
      TransactionDesc: `Payment for ${eventTitle}`
    };

    console.log('Sending STK Push request...');

    // Send STK Push request
    const stkResponse = await axios.post(
      stkPushUrl(process.env.MPESA_ENV),
      stkPushPayload,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    console.log('STK Push Response:', stkResponse.data);

    // ResponseCode may be '0' string or 0 number — tolerate both
    const respCode = stkResponse.data?.ResponseCode ?? stkResponse.data?.responseCode;
    if (respCode == 0 || respCode === '0') {
      // Update payment with M-Pesa details
      await Payment.findByIdAndUpdate(payment._id, {
        merchantRequestID: stkResponse.data.MerchantRequestID,
        checkoutRequestID: stkResponse.data.CheckoutRequestID
      });

      return res.json({
        success: true,
        message: `Hi! Please check your phone ${phoneNorm} and enter your M-Pesa PIN to complete payment for ${eventTitle} (KES ${amount}). Thank you for choosing our events!`,
        paymentId: payment._id,
        checkoutRequestID: stkResponse.data.CheckoutRequestID,
        merchantRequestID: stkResponse.data.MerchantRequestID
      });
    } else {
      // Update payment as failed
      await Payment.findByIdAndUpdate(payment._id, {
        status: 'FAILED'
      });

      return res.status(400).json({
        success: false,
        message: stkResponse.data?.ResponseDescription || 'STK Push failed',
        errorCode: stkResponse.data?.ResponseCode
      });
    }
  } catch (err) {
    console.error('STK Push Error:', err);

    if (err.response?.data) {
      console.error('API Error Response:', err.response.data);
      return res.status(400).json({
        success: false,
        message: `M-Pesa API Error: ${JSON.stringify(err.response.data)}`
      });
    }

    return res.status(500).json({
      success: false,
      message: err.message || 'Internal server error'
    });
  }
};

/**
 * MPESA callback endpoint - Handle payment confirmation
 */
module.exports.mpesaCallback = async (req, res, next) => {
  try {
    console.log('M-Pesa Callback received:', JSON.stringify(req.body, null, 2));

    const body = req.body;
    const result = body?.Body?.stkCallback;

    if (!result) {
      console.log('No STK callback data received');
      return res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
    }

    const { CheckoutRequestID, ResultCode, CallbackMetadata } = result;

    // Find payment by checkoutRequestID
    const payment = await Payment.findOne({
      checkoutRequestID: CheckoutRequestID
    });

    if (!payment) {
      console.warn('Payment not found for CheckoutRequestID:', CheckoutRequestID);
      // Still return 200 to Daraja so it doesn't retry endlessly
      return res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
    }

    if (ResultCode === 0) {
      // Payment successful
      const items = CallbackMetadata?.Item || [];
      const receipt = items.find(item => item.Name === 'MpesaReceiptNumber')?.Value;
      const transactionDate = items.find(item => item.Name === 'TransactionDate')?.Value;
      const phoneNumber = items.find(item => item.Name === 'PhoneNumber')?.Value;
      const amount = items.find(item => item.Name === 'Amount')?.Value;

      await Payment.findByIdAndUpdate(payment._id, {
        status: 'SUCCESS',
        mpesaReceiptNumber: receipt,
        rawCallback: body,
        updatedAt: new Date()
      });

      console.log(`✅ Payment successful: ${receipt} for ${phoneNumber} amount KES ${amount}`);
    } else {
      // Payment failed or cancelled
      await Payment.findByIdAndUpdate(payment._id, {
        status: 'FAILED',
        rawCallback: body,
        updatedAt: new Date()
      });

      console.log(`❌ Payment failed for CheckoutRequestID: ${CheckoutRequestID}, ResultCode: ${ResultCode}`);
    }

    res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
  } catch (err) {
    console.error('Callback processing error:', err);
    // Return 200 so Daraja treats callback accepted (important)
    res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
  }
};

/**
 * Query STK Push status
 * - params: req.params.checkoutRequestID (your route used the params earlier)
 */
module.exports.querySTKPush = async (req, res, next) => {
  try {
    const { checkoutRequestID } = req.params;

    const payment = await Payment.findOne({ checkoutRequestID }).populate('event');

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    return res.json({
      success: true,
      payment: {
        id: payment._id,
        status: payment.status,
        amount: payment.amount,
        phone: payment.phone,
        mpesaReceiptNumber: payment.mpesaReceiptNumber,
        event: payment.event,
        createdAt: payment.createdAt,
        updatedAt: payment.updatedAt
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get payment statistics for admin dashboard
 */
module.exports.getPaymentStats = async (req, res, next) => {
  try {
    const stats = await Payment.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      }
    ]);

    const totalPayments = await Payment.countDocuments();
    const totalRevenue = await Payment.aggregate([
      { $match: { status: 'SUCCESS' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    return res.json({
      success: true,
      stats: {
        totalPayments,
        totalRevenue: totalRevenue[0]?.total || 0,
        breakdown: stats
      }
    });
  } catch (err) {
    next(err);
  }
};
