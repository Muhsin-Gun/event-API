const Event = require('../models/event');
const createError = require('http-errors');
const mongoose = require('mongoose');
const { eventSchema } = require('../helpers/validationschema');

module.exports = {
  createEvent: async (req, res, next) => {
    try {
      const validated = await eventSchema.validateAsync(req.body);
      const event = new Event({ ...validated, createdBy: req.payload?.aud });
      const savedEvent = await event.save();
      res.status(201).json(savedEvent);
    } catch (err) {
      if (err.isJoi === true) return next(createError.BadRequest(err.message));
      next(err);
    }
  },

  getEvents: async (req, res, next) => {
    try {
      const page = Math.max(parseInt(req.query.page || '1', 10), 1);
      const limit = Math.min(Math.max(parseInt(req.query.limit || '10', 10), 1), 100);
      const filter = {};
      if (req.query.search) filter.title = { $regex: req.query.search, $options: 'i' };
      if (req.query.from || req.query.to) {
        filter.date = {};
        if (req.query.from) filter.date.$gte = new Date(req.query.from);
        if (req.query.to) filter.date.$lte = new Date(req.query.to);
      }

      const [items, total] = await Promise.all([
        Event.find(filter).populate('createdBy', 'username email').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
        Event.countDocuments(filter)
      ]);
      res.json({ data: items, meta: { page, limit, total, pages: Math.ceil(total / limit) } });
    } catch (err) {
      next(err);
    }
  },

  getEvent: async (req, res, next) => {
    try {
      const { id } = req.params;
      if (!mongoose.isValidObjectId(id)) throw createError.BadRequest("Invalid Event ID");
      const event = await Event.findById(id).populate('createdBy', 'username email');
      if (!event) throw createError.NotFound("Event not found");
      res.json(event);
    } catch (err) {
      next(err);
    }
  },

  updateEvent: async (req, res, next) => {
    try {
      const { id } = req.params;
      if (!mongoose.isValidObjectId(id)) throw createError.BadRequest("Invalid Event ID");
      const validated = await eventSchema.validateAsync(req.body);
      const updatedEvent = await Event.findByIdAndUpdate(id, validated, { new: true });
      if (!updatedEvent) throw createError.NotFound("Event not found");
      res.json(updatedEvent);
    } catch (err) {
      if (err.isJoi === true) return next(createError.BadRequest(err.message));
      next(err);
    }
  },

  deleteEvent: async (req, res, next) => {
    try {
      const { id } = req.params;
      if (!mongoose.isValidObjectId(id)) throw createError.BadRequest("Invalid Event ID");
      const deletedEvent = await Event.findByIdAndDelete(id);
      if (!deletedEvent) throw createError.NotFound("Event not found");
      res.json({ message: "Event deleted successfully" });
    } catch (err) {
      next(err);
    }
  }
};
