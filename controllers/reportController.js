// controllers/reportController.js
const Payment = require('../models/payment');
const createError = require('http-errors');

module.exports.salesReport = async (req, res, next) => {
  try {
    let { from, to, groupBy = 'month' } = req.query;

    // If missing, default to last 30 days (optional)
    if (!from || !to) {
      const now = new Date();
      const past = new Date(now);
      past.setDate(now.getDate() - 30);
      from = from || past.toISOString().slice(0, 10); // YYYY-MM-DD
      to = to || now.toISOString().slice(0, 10);
    }

    const fromDate = new Date(from);
    const toDate = new Date(to);
    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      throw createError.BadRequest('from or to is not a valid date (use YYYY-MM-DD)');
    }
    toDate.setHours(23, 59, 59, 999);

    // Only successful payments (case-insensitive)
    const match = {
      status: { $in: ['SUCCESS', 'Success', 'success'] },
      createdAt: { $gte: fromDate, $lte: toDate },
    };

    const dateProject =
      groupBy === 'day'
        ? { y: { $year: '$createdAt' }, m: { $month: '$createdAt' }, d: { $dayOfMonth: '$createdAt' } }
        : groupBy === 'week'
          ? { y: { $year: '$createdAt' }, w: { $isoWeek: '$createdAt' } }
          : { y: { $year: '$createdAt' }, m: { $month: '$createdAt' } };

    const groupId =
      groupBy === 'day'
        ? { year: '$y', month: '$m', day: '$d' }
        : groupBy === 'week'
          ? { year: '$y', week: '$w' }
          : { year: '$y', month: '$m' };

    // Simple pipeline: ensure amount is numeric by using $toDouble if available.
    const pipeline = [
      { $match: match },
      {
        $addFields: {
          _amountNum: {
            $cond: [
              { $isNumber: '$amount' },
              '$amount',
              { $toDouble: { $ifNull: ['$amount', 0] } }
            ]
          }
        }
      },
      { $project: { amount: '$_amountNum', createdAt: 1, ...dateProject } },
      { $group: { _id: groupId, totalAmount: { $sum: '$amount' }, payments: { $sum: 1 } } },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.week': 1 } },
    ];

    const agg = await Payment.aggregate(pipeline);
    res.json({ success: true, from, to, groupBy, data: agg });
  } catch (err) {
    next(err);
  }
};
