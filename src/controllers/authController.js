import User from "../models/User.js";
import Otp from "../models/Otp.js";

export const getRegister = (req, res) => {
  res.render("auth/register", {
    layout: "layouts/auth-layout",
    title: "Join Veloshop",
  });
};

export const getLogin = (req, res) => {
  res.render("auth/login", {
    layout: "layouts/auth-layout",
    title: "Join Veloshop",
  });
};

export const getVerifyOtp = (req, res) => {
    console.log("verfy")
  res.render("auth/verify-otp", {
   email: "user.email",
   attemptsLeft: 5,
   layout: "layouts/auth-layout",
   title: "Join Veloshop",
});
};

export const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    const user = await User.findOne({
      email,
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const otpRecord = await Otp.findOne({
      email,
      purpose: "VERIFY_EMAIL",
      isUsed: false,
    });

    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        message: "OTP not found",
      });
    }

    if (otpRecord.expiresAt < new Date()) {
      return res.status(400).json({
        success: false,
        message: "OTP expired",
      });
    }

    if (otpRecord.otp !== otp) {
      otpRecord.attempts += 1;

      await otpRecord.save();

      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
      });
    }

    user.isEmailVerified = true;

    await user.save();

    otpRecord.isUsed = true;

    
    await Otp.deleteMany({
      email
    });

    return res.status(200).json({
      success: true,
      message: "Email verified successfully",
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};

//router.post("/resend-otp", authController.resendOtp);