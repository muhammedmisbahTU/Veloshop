import Joi from "joi";

export const couponSchema = Joi.object({
  code: Joi.string()
    .trim()
    .uppercase()
    .min(3)
    .max(15)
    .required()
    .messages({
      "string.empty": "Coupon code is required.",
      "string.min": "Coupon code must be at least 3 characters.",
      "string.max": "Coupon code cannot exceed 15 characters."
    }),

  description: Joi.string()
    .trim()
    .allow("", null),

  discountType: Joi.string()
    .valid("PERCENTAGE", "FIXED")
    .required()
    .messages({
      "any.only": "Discount type must be PERCENTAGE or FIXED.",
      "any.required": "Discount type is required."
    }),

  discountValue: Joi.number()
    .positive()
    .required()
    .custom((value, helpers) => {
      const discountType = helpers.state.ancestors[0].discountType;
      if (discountType === "PERCENTAGE" && value > 100) {
        return helpers.message("Percentage discount cannot exceed 100.");
      }
      return value;
    })
    .messages({
      "number.base": "Discount value must be a number.",
      "number.positive": "Discount value must be greater than zero.",
      "any.required": "Discount value is required."
    }),

  minimumPurchase: Joi.number()
    .min(0)
    .default(0)
    .messages({
      "number.base": "Minimum purchase must be a number.",
      "number.min": "Minimum purchase cannot be negative."
    }),

  maximumDiscount: Joi.number()
    .min(0)
    .allow(null, "")
    .custom((value, helpers) => {
      const discountType = helpers.state.ancestors[0].discountType;
      if (discountType === "FIXED" && value !== undefined && value !== null && value !== "") {
        return helpers.message("Maximum discount is only applicable for percentage discount.");
      }
      return value;
    })
    .messages({
      "number.base": "Maximum discount must be a number.",
      "number.min": "Maximum discount cannot be negative."
    }),

  startDate: Joi.date()
    .required()
    .messages({
      "date.base": "Invalid start date.",
      "any.required": "Start date is required."
    }),

  expiryDate: Joi.date()
    .greater(Joi.ref("startDate"))
    .required()
    .messages({
      "date.base": "Invalid expiry date.",
      "date.greater": "Expiry date must be after start date.",
      "any.required": "Expiry date is required."
    }),

  usageLimit: Joi.number()
    .integer()
    .min(1)
    .allow(null, "")
    .messages({
      "number.base": "Usage limit must be a number.",
      "number.min": "Usage limit must be at least 1."
    }),

  usagePerUser: Joi.number()
    .integer()
    .min(1)
    .default(1)
    .messages({
      "number.base": "Usage per user must be a number.",
      "number.min": "Usage per user must be at least 1."
    })
});
