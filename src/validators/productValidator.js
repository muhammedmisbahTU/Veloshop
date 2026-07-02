import Joi from "joi";

const objectIdPattern = /^[0-9a-fA-F]{24}$/;

export const productSchema = Joi.object({
  name: Joi.string()
    .trim()
    .min(2)
    .max(120)
    .required()
    .messages({
      "string.empty": "Product name is required.",
      "string.min": "Product name must be at least 2 characters.",
      "string.max": "Product name cannot exceed 120 characters."
    }),

  description: Joi.string()
    .trim()
    .min(10)
    .max(3000)
    .required()
    .messages({
      "string.empty": "Product description is required.",
      "string.min": "Product description must be at least 10 characters.",
      "string.max": "Product description cannot exceed 3000 characters."
    }),

  brand: Joi.string()
    .trim()
    .min(2)
    .max(80)
    .required()
    .messages({
      "string.empty": "Brand is required.",
      "string.min": "Brand must be at least 2 characters.",
      "string.max": "Brand cannot exceed 80 characters."
    }),

  categoryId: Joi.string()
    .pattern(objectIdPattern)
    .required()
    .messages({
      "string.empty": "Category is required.",
      "string.pattern.base": "Please select a valid category."
    }),

  thumbnail: Joi.string()
    .trim()
    .allow("")
    .max(500),

  tags: Joi.string()
    .trim()
    .allow("")
    .max(500),

  isFeatured: Joi.alternatives()
    .try(Joi.boolean(), Joi.string().valid("true", "false", "on"))
    .optional(),

  status: Joi.string()
    .valid("ACTIVE", "INACTIVE")
    .required()
});
