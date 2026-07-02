import Joi from "joi";

export const variantSchema = Joi.object({
  sku: Joi.string()
    .trim()
    .allow("")
    .min(2)
    .max(80)
    .optional()
    .messages({
      "string.empty": "SKU is required.",
      "string.min": "SKU must be at least 2 characters.",
      "string.max": "SKU cannot exceed 80 characters."
    }),

  stock: Joi.number()
    .integer()
    .min(0)
    .required()
    .messages({
      "number.base": "Stock must be a number.",
      "number.integer": "Stock must be a whole number.",
      "number.min": "Stock cannot be negative."
    }),

  regularPrice: Joi.number()
    .min(0)
    .required()
    .messages({
      "number.base": "Regular price must be a number.",
      "number.min": "Regular price cannot be negative."
    }),

  salePrice: Joi.number()
    .min(0)
    .allow("", null)
    .optional()
    .messages({
      "number.base": "Sale price must be a number.",
      "number.min": "Sale price cannot be negative."
    }),

  isActive: Joi.alternatives()
    .try(Joi.boolean(), Joi.string().valid("true", "false", "on"))
    .optional(),

  attributeName: Joi.alternatives()
    .try(
      Joi.string().trim().allow(""),
      Joi.array().items(Joi.string().trim().allow(""))
    )
    .optional(),

  attributeValue: Joi.alternatives()
    .try(
      Joi.string().trim().allow(""),
      Joi.array().items(Joi.string().trim().allow(""))
    )
    .optional(),

  attributes: Joi.string()
    .trim()
    .allow("")
    .max(500),

  replaceImages: Joi.alternatives()
    .try(Joi.boolean(), Joi.string().valid("true", "false", "on"))
    .optional()
});
