import express from "express";
import passport from "passport";
import {
  getRegister,
  postRegister,
  getLogin,
  postLogin,
  getVerifyOtp,
  verifyOtp,
  resendOtp,
  logout,
  getForgotPassword,
  postForgotPassword,
  getResetPassword,
  postResetPassword
} from "../controllers/authController.js";
import validate from "../middleware/validate.js";
import { isGuest, isAuthenticated } from "../middleware/auth.js";
import {
  registerSchema,
  loginSchema,
  verifyOtpSchema,
  resendOtpSchema,
  forgotPasswordSchema,
  resetPasswordSchema
} from "../validators/authValidator.js";

const router = express.Router();

// Guest-only routes
router.get("/register", isGuest, getRegister);
router.post("/register", isGuest, validate(registerSchema), postRegister);

router.get("/login", isGuest, getLogin);
router.post("/login", isGuest, validate(loginSchema), postLogin);

router.get("/verify-otp", getVerifyOtp);
router.post("/verify-otp", validate(verifyOtpSchema), verifyOtp);
router.post("/resend-otp", validate(resendOtpSchema), resendOtp);

router.get("/forgot-password", isGuest, getForgotPassword);
router.post("/forgot-password", isGuest, validate(forgotPasswordSchema), postForgotPassword);

router.get("/reset-password", isGuest, getResetPassword);
router.post("/reset-password", isGuest, validate(resetPasswordSchema), postResetPassword);

// Auth-protected routes
router.get("/logout", logout);

// Google OAuth routes
router.get(
  "/auth/google",
  isGuest,
  passport.authenticate("google", { scope: ["profile", "email"] })
);

router.get(
  "/auth/google/callback",
  (req, res, next) => {
    passport.authenticate("google", (err, user, info) => {
      if (err) return next(err);
      if (!user) {
        req.session.errorMessage = info?.message || "Google Authentication failed.";
        return res.redirect("/login");
      }
      req.logIn(user, (loginErr) => {
        if (loginErr) return next(loginErr);
        if (user.role === "ADMIN") {
          return res.redirect("/admin/users");
        }
        return res.redirect("/");
      });
    })(req, res, next);
  }
);

export default router;