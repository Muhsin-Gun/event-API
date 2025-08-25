const Joi = require('joi');

const eventSchema = Joi.object({
  title: Joi.string().min(3).max(100).required(),
  description: Joi.string().max(1000).allow('', null),
  date: Joi.date().iso().required(),
  location: Joi.string().min(2).max(200).required(),
  price: Joi.number().min(0).optional(),
  createdBy: Joi.string().optional()
});

module.exports = {
  eventSchema
};

