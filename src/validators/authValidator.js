import Joi from "joi";

export const registerSchema = Joi.object({

  fullName: Joi.string()
    .trim()
    .min(3)
    .max(50)
    .required(),

  email: Joi.string()
    .email()
    .lowercase()
    .required(),

  password: Joi.string()
    .min(6)
    .max(20)
    .required()

});

export const loginSchema = Joi.object({

  email: Joi.string()
    .email()
    .required(),

  password: Joi.string()
    .required()

});

export const verifyOtpSchema = Joi.object({

  email: Joi.string()
    .email()
    .required(),

  otp: Joi.string()
    .length(6)
    .required()

});

export const resendOtpSchema = Joi.object({

  email: Joi.string()
    .email()
    .required()

});

export const forgotPasswordSchema = Joi.object({

  email: Joi.string()
    .email()
    .required()

});

export const resetPasswordSchema = Joi.object({

  email: Joi.string()
    .email()
    .required(),

  otp: Joi.string()
    .length(6)
    .required(),

  password: Joi.string()
    .min(6)
    .max(20)
    .required(),

  confirmPassword: Joi.any()
    .valid(Joi.ref("password"))
    .required()
    .messages({
      "any.only":
      "Passwords do not match"
    })

});

