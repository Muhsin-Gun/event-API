// controllers/eventController.js
const Event = require('../models/event');
const User = require('../models/user');
const createError = require('http-errors');
const mongoose = require('mongoose');
const { eventSchema } = require('../helpers/validationschema');

/**
 * Helper: check if current user (from JWT) is admin or owner of the event
 */
async function isAdminOrOwner(userId, event) {
  if (!userId || !event) return false;
  if (String(event.createdBy) === String(userId)) return true;
  const user = await User.findById(userId).select('role');
  return !!user && user.role === 'admin';
}

// Create new event (employee or admin)
module.exports.createEvent = async (req, res, next) => {
  try {
    const userId = req.payload?.aud;
    if (!userId) return next(createError.Unauthorized());

    // only employee/admin can create events
    const requester = await User.findById(userId).select('role');
    if (!requester || !['employee', 'admin'].includes(requester.role)) {
      return next(createError.Forbidden('Not allowed'));
    }

    const validated = await eventSchema.validateAsync(req.body);
    const event = new Event({ ...validated, createdBy: userId });
    const savedEvent = await event.save();
    res.status(201).json(savedEvent);
  } catch (err) {
    if (err.isJoi === true) return next(createError.BadRequest(err.message));
    next(err);
  }
};

// GET /api/events?page=1&limit=10&search=&from=&to=&minPrice=&maxPrice=
module.exports.getEvents = async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '10', 10), 1), 100);
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.search) filter.title = { $regex: req.query.search, $options: 'i' };
    if (req.query.from || req.query.to) {
      // inclusive day range
      filter.date = {};
      if (req.query.from) filter.date.$gte = new Date(req.query.from);
      if (req.query.to) {
        const to = new Date(req.query.to);
        to.setHours(23, 59, 59, 999);
        filter.date.$lte = to;
      }
    }
    if (req.query.minPrice) filter.price = { $gte: parseFloat(req.query.minPrice) };
    if (req.query.maxPrice) filter.price = { ...(filter.price || {}), $lte: parseFloat(req.query.maxPrice) };

    const [items, total] = await Promise.all([
      Event.find(filter)
        .populate('createdBy', 'username email role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Event.countDocuments(filter),
    ]);

    res.json({
      data: items,
      meta: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/events/:id
module.exports.getEvent = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return next(createError.BadRequest('Invalid Event ID'));

    const event = await Event.findById(id).populate('createdBy', 'username email role');
    if (!event) return next(createError.NotFound('Event not found'));

    res.json(event);
  } catch (err) {
    next(err);
  }
};

// PATCH /api/events/:id  (owner or admin)
module.exports.updateEvent = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return next(createError.BadRequest('Invalid Event ID'));

    const existing = await Event.findById(id);
    if (!existing) return next(createError.NotFound('Event not found'));

    const userId = req.payload?.aud;
    const allowed = await isAdminOrOwner(userId, existing);
    if (!allowed) return next(createError.Forbidden('Not allowed to update this event'));

    const validated = await eventSchema.validateAsync(req.body);
    const updatedEvent = await Event.findByIdAndUpdate(id, validated, { new: true });
    res.json(updatedEvent);
  } catch (err) {
    if (err.isJoi === true) return next(createError.BadRequest(err.message));
    next(err);
  }
};

// DELETE /api/events/:id (owner or admin)
module.exports.deleteEvent = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return next(createError.BadRequest('Invalid Event ID'));

    const existing = await Event.findById(id);
    if (!existing) return next(createError.NotFound('Event not found'));

    const userId = req.payload?.aud;
    const allowed = await isAdminOrOwner(userId, existing);
    if (!allowed) return next(createError.Forbidden('Not allowed to delete this event'));

    await Event.findByIdAndDelete(id);
    res.json({ message: 'Event deleted successfully', id });
  } catch (err) {
    next(err);
  }
};
