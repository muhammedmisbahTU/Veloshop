import Joi from "joi";

export const categorySchema = Joi.object({
  name: Joi.string()
    .trim()
    .min(2)
    .max(60)
    .required()
    .messages({
      "string.empty": "Category name is required.",
      "string.min": "Category name must be at least 2 characters.",
      "string.max": "Category name cannot exceed 60 characters."
    }),

  isActive: Joi.alternatives()
    .try(Joi.boolean(), Joi.string().valid("true", "false", "on"))
    .optional()
});
