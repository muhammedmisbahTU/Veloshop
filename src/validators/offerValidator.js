import Joi from "joi";

const objectIdPattern = /^[0-9a-fA-F]{24}$/;

export const offerSchema = Joi.object({

  title: Joi.string()
    .trim()
    .min(3)
    .max(100)
    .required()
    .messages({
      "string.empty": "Offer title is required.",
      "string.min": "Offer title must be at least 3 characters.",
      "string.max": "Offer title cannot exceed 100 characters."
    }),


  type: Joi.string()
    .valid(
      "PRODUCT",
      "CATEGORY",
      "REFERRAL"
    )
    .required()
    .messages({
      "any.only": "Offer type must be PRODUCT, CATEGORY, or REFERRAL.",
      "any.required": "Offer type is required."
    }),


  discountType: Joi.string()
    .valid(
      "PERCENTAGE",
      "FIXED"
    )
    .required()
    .messages({
      "any.only": "Discount type must be PERCENTAGE or FIXED."
    }),


  discountValue: Joi.number()
    .positive()
    .required()
    .custom((value, helpers) => {

      const discountType = helpers.state.ancestors[0].discountType;

      if (
        discountType === "PERCENTAGE" &&
        value > 100
      ) {
        return helpers.message(
          "Percentage discount cannot exceed 100."
        );
      }

      return value;

    })
    .messages({
      "number.base": "Discount value must be a number.",
      "number.positive": "Discount value must be greater than zero."
    }),


  product: Joi.when("type", {
    is: "PRODUCT",
    then: Joi.string()
      .pattern(objectIdPattern)
      .required()
      .messages({
        "any.required": "Product is required for product offers.",
        "string.pattern.base": "Invalid product ID."
      }),

    otherwise: Joi.string()
      .pattern(objectIdPattern)
      .allow(null, "")
  }),


  category: Joi.when("type", {
    is: "CATEGORY",
    then: Joi.string()
      .pattern(objectIdPattern)
      .required()
      .messages({
        "any.required": "Category is required for category offers.",
        "string.pattern.base": "Invalid category ID."
      }),

    otherwise: Joi.string()
      .pattern(objectIdPattern)
      .allow(null, "")
  }),


  referralCode: Joi.when("type", {
    is: "REFERRAL",
    then: Joi.string()
      .trim()
      .uppercase()
      .required()
      .messages({
        "any.required": "Referral code is required."
      }),

    otherwise: Joi.string()
      .trim()
      .uppercase()
      .allow(null, "")
  }),


  referralToken: Joi.string()
    .allow(null, ""),


  usageLimit: Joi.number()
    .integer()
    .min(1)
    .allow(null)
    .messages({
      "number.min": "Usage limit must be at least 1."
    }),


  usedCount: Joi.number()
    .integer()
    .min(0)
    .default(0),


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
      "date.greater": "Expiry date must be after start date.",
      "any.required": "Expiry date is required."
    }),


  priority: Joi.number()
    .integer()
    .default(0),


  isActive: Joi.alternatives()
    .try(
      Joi.boolean(),
      Joi.string().valid(
        "true",
        "false",
        "on"
      )
    )
    .default(true),


  isDeleted: Joi.boolean()
    .default(false),


  deletedAt: Joi.date()
    .allow(null)
    .default(null)

});