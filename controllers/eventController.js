const Event = require('../models/event');
const createError = require('http-errors');
const mongoose = require('mongoose');
const { eventSchema } = require('../helpers/validationschema');

// Create new event
exports.createEvent = async (req, res, next) => {
  try {
    const result = await eventSchema.validateAsync(req.body);

    const event = new Event({
      ...result,
      createdBy: req.payload.aud // user id from JWT
    });

    const savedEvent = await event.save();
    res.status(201).json(savedEvent);
  } catch (err) {
    if (err.isJoi === true) return next(createError.BadRequest(err.message));
    next(err);
  }
};

// Get all events
exports.getEvents = async (req, res, next) => {
  try {
    const events = await Event.find().populate('createdBy', 'username email');
    res.json(events);
  } catch (err) {
    next(err);
  }
};

// Get event by ID
exports.getEvent = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) throw createError.BadRequest("Invalid Event ID");

    const event = await Event.findById(id).populate('createdBy', 'username email');
    if (!event) throw createError.NotFound("Event not found");

    res.json(event);
  } catch (err) {
    next(err);
  }
};

// Update event
exports.updateEvent = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) throw createError.BadRequest("Invalid Event ID");

    const result = await eventSchema.validateAsync(req.body);

    const updatedEvent = await Event.findByIdAndUpdate(id, result, { new: true });
    if (!updatedEvent) throw createError.NotFound("Event not found");

    res.json(updatedEvent);
  } catch (err) {
    if (err.isJoi === true) return next(createError.BadRequest(err.message));
    next(err);
  }
};

// Delete event
exports.deleteEvent = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) throw createError.BadRequest("Invalid Event ID");

    const deletedEvent = await Event.findByIdAndDelete(id);
    if (!deletedEvent) throw createError.NotFound("Event not found");

    res.json({ message: "Event deleted successfully" });
  } catch (err) {
    next(err);
  }
};
