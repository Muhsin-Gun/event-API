// controllers/reportController.js
const Payment = require('../models/payment');
const createError = require('http-errors');

module.exports.salesReport = async (req, res, next) => {
  try {
    const { from, to, groupBy = 'month' } = req.query;
    if (!from || !to) throw createError.BadRequest('from and to are required (YYYY-MM-DD)');

    const fromDate = new Date(from);
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999); // inclusive end-of-day

    const match = { status: 'SUCCESS', createdAt: { $gte: fromDate, $lte: toDate } };

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

    const agg = await Payment.aggregate([
      { $match: match },
      { $project: { amount: 1, createdAt: 1, ...dateProject } },
      { $group: { _id: groupId, totalAmount: { $sum: '$amount' }, payments: { $sum: 1 } } },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.week': 1 } },
    ]);

    res.json({ from, to, groupBy, data: agg });
  } catch (err) {
    next(err);
  }
};
