import express from "express";
import {
  getRegister,
  getLogin,
  getVerifyOtp,
  verifyOtp,
} from "../controllers/authController.js";
import sendOtpEmail from "../services/sendOtpEmail.js";
import validate from "../middleware/validate.js";
import { verifyOtpSchema } from "../validators/authValidator.js";

const router = express.Router();

router.get("/register", getRegister);
router.get("/login", getLogin);

router.get("/verify-otp", getVerifyOtp);
router.post("/verify-otp", validate(verifyOtpSchema), verifyOtp);



export default router;