import bcrypt from "bcrypt";
import User from "../models/User.js";
import Otp from "../models/Otp.js";
import sendOtpEmail from "../services/sendOtpEmail.js";

const VERIFY_OTP_TTL_MS = 5 * 60 * 1000;
const RESET_OTP_TTL_MS = 5 * 60 * 1000;

// Helper to generate a 6-digit OTP
const generateOtp = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

export const getRegister = (req, res) => {
  res.render("auth/register", {
    layout: "layouts/auth-layout",
    title: "Join Veloshop"
  });
};

export const postRegister = async (req, res) => {
  try {
    const { fullName, email, password, confirmPassword } = req.body;

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Passwords do not match."
      });
    }

    // Check if email already registered
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      if (existingUser.isEmailVerified) {
        return res.status(400).json({
          success: false,
          message: "Email is already registered. Please login."
        });
      } else {
        // Unverified user: we can update details and send a new OTP
        const hashedPassword = await bcrypt.hash(password, 10);
        existingUser.fullName = fullName;
        existingUser.password = hashedPassword;
        await existingUser.save();
      }
    } else {
      // Create new user (unverified)
      const hashedPassword = await bcrypt.hash(password, 10);
      const referralId =
        fullName.replace(/\s+/g, "").substring(0, 5).toUpperCase() +
        Math.floor(1000 + Math.random() * 9000);

      await User.create({
        fullName,
        email: email.toLowerCase(),
        password: hashedPassword,
        authProvider: "LOCAL",
        isEmailVerified: false,
        isActive: true,
        referralId
      });
    }

    // Generate and save OTP
    const otpCode = generateOtp();
    const expiresAt = new Date(Date.now() + VERIFY_OTP_TTL_MS);

    // Delete existing verify OTPs for this email
    await Otp.deleteMany({ email: email.toLowerCase(), purpose: "VERIFY_EMAIL" });

    await Otp.create({
      email: email.toLowerCase(),
      otp: otpCode,
      purpose: "VERIFY_EMAIL",
      expiresAt,
      attempts: 0,
      isUsed: false
    });

    // Send email (async)
    try {
      await sendOtpEmail(email.toLowerCase(), otpCode);
    } catch (mailError) {
      console.error("Mail sending failed:", mailError);
    }

    return res.status(200).json({
      success: true,
      message: "Registration successful. OTP sent to email.",
      email: email.toLowerCase()
    });
  } catch (error) {
    console.error("Registration error:", error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong during registration."
    });
  }
};

export const getLogin = (req, res) => {
  res.render("auth/login", {
    layout: "layouts/auth-layout",
    title: "Login - Veloshop"
  });
};

export const postLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || user.authProvider !== "LOCAL") {
      return res.status(400).json({
        success: false,
        message: "Invalid email or password."
      });
    }

    // Check if password matches
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Invalid email or password."
      });
    }

    // Check block status
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Your account has been blocked by the Administrator."
      });
    }

    // Check verification status
    if (!user.isEmailVerified) {
      // Re-trigger OTP
      const otpCode = generateOtp();
      const expiresAt = new Date(Date.now() + VERIFY_OTP_TTL_MS);

      await Otp.deleteMany({ email: user.email, purpose: "VERIFY_EMAIL" });
      await Otp.create({
        email: user.email,
        otp: otpCode,
        purpose: "VERIFY_EMAIL",
        expiresAt,
        attempts: 0,
        isUsed: false
      });

      try {
        await sendOtpEmail(user.email, otpCode);
      } catch (mailError) {
        console.error("Mail sending failed:", mailError);
      }

      return res.status(202).json({
        success: false,
        requiresVerification: true,
        email: user.email,
        message: "Account not verified. OTP sent to your email."
      });
    }

    // Set user session
    req.session.user = {
      id: user._id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      isEmailVerified: user.isEmailVerified,
      isActive: user.isActive
    };

    return res.status(200).json({
      success: true,
      message: "Logged in successfully.",
      role: user.role
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong during login."
    });
  }
};

export const getVerifyOtp = async (req, res) => {
  const email = req.query.email || "";
  let attemptsLeft = 5;

  if (email) {
    const otpRecord = await Otp.findOne({
      email: email.toLowerCase(),
      purpose: "VERIFY_EMAIL"
    });
    if (otpRecord) {
      attemptsLeft = Math.max(0, 5 - otpRecord.attempts);
    }
  }

  res.render("auth/verify-otp", {
    email,
    attemptsLeft,
    layout: "layouts/auth-layout",
    title: "Verify OTP - Veloshop"
  });
};

export const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found."
      });
    }

    const otpRecord = await Otp.findOne({
      email: email.toLowerCase(),
      purpose: "VERIFY_EMAIL",
      isUsed: false
    });

    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        message: "OTP expired or not found. Please request a new code."
      });
    }

    if (otpRecord.expiresAt < new Date()) {
      return res.status(400).json({
        success: false,
        message: "OTP expired. Please click Resend."
      });
    }

    if (otpRecord.attempts >= 5) {
      return res.status(400).json({
        success: false,
        message: "Maximum OTP attempts exceeded. Please resend a new OTP."
      });
    }

    if (otpRecord.otp !== otp) {
      otpRecord.attempts += 1;
      await otpRecord.save();
      const left = Math.max(0, 5 - otpRecord.attempts);
      return res.status(400).json({
        success: false,
        message: `Invalid OTP. ${left} attempts remaining.`,
        attemptsLeft: left
      });
    }

    // Success! Verify user
    user.isEmailVerified = true;
    await user.save();

    // Mark OTP as used
    otpRecord.isUsed = true;
    await otpRecord.save();
    await Otp.deleteMany({ email: email.toLowerCase(), purpose: "VERIFY_EMAIL" });

    // Establish session
    req.session.user = {
      id: user._id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      isEmailVerified: user.isEmailVerified,
      isActive: user.isActive
    };

    return res.status(200).json({
      success: true,
      message: "Email verified successfully.",
      role: user.role
    });
  } catch (error) {
    console.error("OTP verification error:", error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong during verification."
    });
  }
};

export const resendOtp = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found."
      });
    }

    const otpCode = generateOtp();
    const expiresAt = new Date(Date.now() + VERIFY_OTP_TTL_MS);

    // Recreate OTP
    await Otp.deleteMany({ email: email.toLowerCase(), purpose: "VERIFY_EMAIL" });
    await Otp.create({
      email: email.toLowerCase(),
      otp: otpCode,
      purpose: "VERIFY_EMAIL",
      expiresAt,
      attempts: 0,
      isUsed: false
    });

    try {
      await sendOtpEmail(email.toLowerCase(), otpCode);
    } catch (mailError) {
      console.error("Mail sending failed:", mailError);
    }

    return res.status(200).json({
      success: true,
      message: "A new OTP code has been sent to your email."
    });
  } catch (error) {
    console.error("Resend OTP error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to resend OTP. Please try again."
    });
  }
};

export const logout = (req, res) => {
  req.logout((err) => {
    req.session.destroy((destroyErr) => {
      res.redirect("/login");
    });
  });
};

export const getForgotPassword = (req, res) => {
  res.render("auth/forgot-password", {
    layout: "layouts/auth-layout",
    title: "Forgot Password - Veloshop"
  });
};

export const postForgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email: email.toLowerCase(), authProvider: "LOCAL" });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "No local user found with this email."
      });
    }

    // Generate and save OTP for password reset
    const otpCode = generateOtp();
    const expiresAt = new Date(Date.now() + RESET_OTP_TTL_MS);

    await Otp.deleteMany({ email: email.toLowerCase(), purpose: "RESET_PASSWORD" });
    await Otp.create({
      email: email.toLowerCase(),
      otp: otpCode,
      purpose: "RESET_PASSWORD",
      expiresAt,
      attempts: 0,
      isUsed: false
    });

    // Send email
    try {
      await sendOtpEmail(email.toLowerCase(), otpCode);
    } catch (mailError) {
      console.error("Mail sending failed:", mailError);
    }

    return res.status(200).json({
      success: true,
      message: "Password reset OTP sent to email.",
      email: email.toLowerCase()
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong."
    });
  }
};

export const getResetPassword = (req, res) => {
  const email = req.query.email || "";
  res.render("auth/reset-password", {
    email,
    layout: "layouts/auth-layout",
    title: "Reset Password - Veloshop"
  });
};

export const postResetPassword = async (req, res) => {
  try {
    const { email, otp, password, confirmPassword } = req.body;

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Passwords do not match."
      });
    }

    const user = await User.findOne({ email: email.toLowerCase(), authProvider: "LOCAL" });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found."
      });
    }

    const otpRecord = await Otp.findOne({
      email: email.toLowerCase(),
      purpose: "RESET_PASSWORD",
      isUsed: false
    });

    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        message: "OTP expired or invalid."
      });
    }

    if (otpRecord.expiresAt < new Date()) {
      return res.status(400).json({
        success: false,
        message: "OTP code expired. Please request another reset."
      });
    }

    if (otpRecord.otp !== otp) {
      otpRecord.attempts += 1;
      await otpRecord.save();
      return res.status(400).json({
        success: false,
        message: "Invalid OTP code."
      });
    }

    // Correct! Reset password
    const hashedPassword = await bcrypt.hash(password, 10);
    user.password = hashedPassword;
    await user.save();

    // Clean up OTPs
    await Otp.deleteMany({ email: email.toLowerCase(), purpose: "RESET_PASSWORD" });

    return res.status(200).json({
      success: true,
      message: "Password reset successful! Please log in."
    });
  } catch (error) {
    console.error("Reset password error:", error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong."
    });
  }
};
