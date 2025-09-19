// controllers/eventController.js
// FULL FIX: No role restrictions, any authenticated user can create events.

const Event = require('../models/event');
const User = require('../models/user');
const createError = require('http-errors');
const mongoose = require('mongoose');
const { eventSchema } = require('../helpers/validationschema');

// 🔹 Helper to get user ID from token/payload
function getUserIdFromReq(req) {
  return (
    req.payload?.aud ||
    req.payload?.sub ||
    req.user?.id ||
    req.user?._id ||
    req.userId ||
    req.auth?.uid ||
    null
  );
}

// 🔹 CREATE EVENT (no role checks anymore)
module.exports.createEvent = async (req, res, next) => {
  try {
    console.info('[createEvent] body:', req.body);

    const userId = getUserIdFromReq(req);
    console.info('[createEvent] inferred userId:', userId);

    if (!userId) {
      return next(createError.Unauthorized('Missing authentication'));
    }

    // Validate request body
    const validated = await eventSchema.validateAsync(req.body);

    // Save event
    const event = new Event({ ...validated, createdBy: userId });
    const savedEvent = await event.save();

    console.info('[createEvent] saved id:', savedEvent._id);

    return res.status(201).json({ success: true, data: savedEvent });
  } catch (err) {
    if (err.isJoi === true) {
      return next(createError.BadRequest(err.message));
    }
    console.error('[createEvent] error:', err);
    next(err);
  }
};

// 🔹 GET ALL EVENTS
module.exports.getEvents = async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '10', 10), 1), 100);
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.search) filter.title = { $regex: req.query.search, $options: 'i' };
    if (req.query.from || req.query.to) {
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

    return res.json({
      success: true,
      data: items,
      meta: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('[getEvents] error:', err);
    next(err);
  }
};

// 🔹 GET SINGLE EVENT
module.exports.getEvent = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return next(createError.BadRequest('Invalid Event ID'));
    }
    const event = await Event.findById(id).populate('createdBy', 'username email role');
    if (!event) return next(createError.NotFound('Event not found'));
    return res.json({ success: true, data: event });
  } catch (err) {
    console.error('[getEvent] error:', err);
    next(err);
  }
};

// 🔹 UPDATE EVENT (only creator can update)
module.exports.updateEvent = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return next(createError.BadRequest('Invalid Event ID'));
    }
    const existing = await Event.findById(id);
    if (!existing) return next(createError.NotFound('Event not found'));

    const userId = getUserIdFromReq(req);
    if (String(existing.createdBy) !== String(userId)) {
      return next(createError.Forbidden('Not allowed to update this event'));
    }

    const validated = await eventSchema.validateAsync(req.body);
    const updatedEvent = await Event.findByIdAndUpdate(id, validated, { new: true });

    return res.json({ success: true, data: updatedEvent });
  } catch (err) {
    if (err.isJoi === true) {
      return next(createError.BadRequest(err.message));
    }
    console.error('[updateEvent] error:', err);
    next(err);
  }
};

// 🔹 DELETE EVENT (only creator can delete)
module.exports.deleteEvent = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return next(createError.BadRequest('Invalid Event ID'));
    }
    const existing = await Event.findById(id);
    if (!existing) return next(createError.NotFound('Event not found'));

    const userId = getUserIdFromReq(req);
    if (String(existing.createdBy) !== String(userId)) {
      return next(createError.Forbidden('Not allowed to delete this event'));
    }

    await Event.findByIdAndDelete(id);
    return res.json({ success: true, message: 'Event deleted successfully', id });
  } catch (err) {
    console.error('[deleteEvent] error:', err);
    next(err);
  }
}; 
       