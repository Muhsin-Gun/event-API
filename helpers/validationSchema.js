// helpers/validationschema.js
const Joi = require('joi');

const eventSchema = Joi.object({
  title: Joi.string().min(3).max(100).required(),
  description: Joi.string().max(500).optional(),
  date: Joi.date().iso().required(),
  location: Joi.string().required(),
  price: Joi.number().min(0).optional(),
  createdBy: Joi.string().optional() // will come from JWT, not client
});

module.exports = {
  eventSchema
};
