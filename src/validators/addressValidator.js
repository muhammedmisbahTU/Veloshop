import Joi from "joi";

export const addressSchema = Joi.object({
  addressLine1: Joi.string()
    .trim()
    .min(3)
    .max(150)
    .required()
    .messages({
      "string.empty": "Address Line 1 is required.",
      "string.min": "Address Line 1 must be at least 3 characters.",
      "string.max": "Address Line 1 cannot exceed 150 characters."
    }),

  addressLine2: Joi.string()
    .trim()
    .max(150)
    .allow("")
    .optional()
    .messages({
      "string.max": "Address Line 2 cannot exceed 150 characters."
    }),

  phone: Joi.string()
    .trim()
    .pattern(/^[0-9]{10,12}$/)
    .required()
    .messages({
      "string.empty": "Phone number is required.",
      "string.pattern.base": "Phone number must be a valid 10-12 digit number."
    }),

  pinCode: Joi.string()
    .trim()
    .pattern(/^[0-9]{5,8}$/)
    .required()
    .messages({
      "string.empty": "PIN/ZIP Code is required.",
      "string.pattern.base": "PIN/ZIP Code must be 5 to 8 digits."
    }),

  city: Joi.string()
    .trim()
    .min(2)
    .max(50)
    .required()
    .messages({
      "string.empty": "City is required.",
      "string.min": "City name must be at least 2 characters."
    }),

  state: Joi.string()
    .trim()
    .min(2)
    .max(50)
    .required()
    .messages({
      "string.empty": "State is required."
    }),

  country: Joi.string()
    .trim()
    .min(2)
    .max(50)
    .required()
    .messages({
      "string.empty": "Country is required."
    }),

  IsDefault: Joi.alternatives()
    .try(Joi.boolean(), Joi.string().valid("true", "false", "on"))
    .optional()
});
