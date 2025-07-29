// controllers/eventController.js
const Event = require('../models/event');
const createError = require('http-errors');
const mongoose = require('mongoose');

module.exports = {
  getAllEvents: async (req, res, next) => {
    try {
      const events = await Event.find().populate('createdBy', 'username email');
      res.send(events);
    } catch (error) {
      console.log(error.message);
      next(error);
    }
  },

  getEvent: async (req, res, next) => {
    const id = req.params.id;
    try {
      const event = await Event.findById(id).populate('createdBy', 'username email');
      if (!event) throw createError(404, 'Event not found');
      res.send(event);
    } catch (error) {
      console.log(error.message);
      if (error instanceof mongoose.CastError) {
        next(createError(400, 'Invalid event id'));
        return;
      }
      next(error);
    }
  },

  createEvent: async (req, res, next) => {
    try {
      const eventData = req.body;
      eventData.createdBy = req.payload.aud; // from access token
      const event = new Event(eventData);
      const result = await event.save();
      res.status(201).send(result);
    } catch (error) {
      console.log(error.message);
      next(error);
    }
  },

  updateEvent: async (req, res, next) => {
    const id = req.params.id;
    try {
      const updates = req.body;
      const options = { new: true };
      const result = await Event.findByIdAndUpdate(id, updates, options);
      if (!result) throw createError(404, 'Event not found');
      res.send(result);
    } catch (error) {
      console.log(error.message);
      next(error);
    }
  },

  deleteEvent: async (req, res, next) => {
    const id = req.params.id;
    try {
      const result = await Event.findByIdAndDelete(id);
      if (!result) throw createError(404, 'Event not found');
      res.send(result);
    } catch (error) {
      console.log(error.message);
      next(error);
    }
  }
};
