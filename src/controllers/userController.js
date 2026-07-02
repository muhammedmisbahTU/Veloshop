import bcrypt from "bcrypt";
import User from "../models/User.js";
import Address from "../models/Address.js";
import Otp from "../models/Otp.js";
import sendOtpEmail from "../services/sendOtpEmail.js";

// Helper to generate a 6-digit OTP
const generateOtp = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

export const getProfile = async (req, res) => {
  try {
    const currentUser = req.user || req.session.user;
    const user = await User.findById(currentUser.id || currentUser._id);
    const addresses = await Address.find({ userId: user._id });

    res.render("user/profile", {
      layout: "layouts/user-layout",
      title: "My Profile - Veloshop",
      profileUser: user,
      addresses
    });
  } catch (error) {
    console.error("Profile view error:", error);
    req.session.errorMessage = "Failed to load profile details.";
    res.redirect("/");
  }
};

export const getEditProfile = async (req, res) => {
  try {
    const currentUser = req.user || req.session.user;
    const user = await User.findById(currentUser.id || currentUser._id);
    const addresses = await Address.find({ userId: user._id });

    res.render("user/edit-profile", {
      layout: "layouts/user-layout",
      title: "Edit Profile - Veloshop",
      profileUser: user,
      addresses
    });
  } catch (error) {
    console.error("Edit profile view error:", error);
    req.session.errorMessage = "Failed to load edit profile page.";
    res.redirect("/profile");
  }
};

export const postEditProfile = async (req, res) => {
  try {
    const currentUser = req.user || req.session.user;
    const { fullName } = req.body;

    const user = await User.findById(currentUser.id || currentUser._id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    if (fullName) {
      user.fullName = fullName;
    }

    if (req.file) {
      user.avatar = req.file.secure_url;
    }

    await user.save();

    // Update session user details
    const updatedSessionUser = {
      id: user._id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      isEmailVerified: user.isEmailVerified,
      isActive: user.isActive
    };
    if (req.session.user) {
      req.session.user = updatedSessionUser;
    }
    if (req.user) {
      Object.assign(req.user, updatedSessionUser);
    }

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully.",
      avatar: user.avatar,
      fullName: user.fullName
    });
  } catch (error) {
    console.error("Profile edit error:", error);
    return res.status(500).json({ success: false, message: "Failed to update profile." });
  }
};

export const postChangePassword = async (req, res) => {
  try {
    const currentUser = req.user || req.session.user;
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, message: "New passwords do not match." });
    }

    const user = await User.findById(currentUser.id || currentUser._id);
    if (!user || user.authProvider !== "LOCAL") {
      return res.status(400).json({ success: false, message: "Social logins cannot change password." });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: "Incorrect current password." });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    return res.status(200).json({ success: true, message: "Password updated successfully!" });
  } catch (error) {
    console.error("Change password error:", error);
    return res.status(500).json({ success: false, message: "Failed to update password." });
  }
};

export const postChangeEmailRequest = async (req, res) => {
  try {
    const currentUser = req.user || req.session.user;
    const { newEmail } = req.body;

    if (!newEmail) {
      return res.status(400).json({ success: false, message: "New email is required." });
    }

    const lowerEmail = newEmail.toLowerCase();

    // Check if new email already exists
    const emailExists = await User.findOne({ email: lowerEmail });
    if (emailExists) {
      return res.status(400).json({ success: false, message: "This email is already in use." });
    }

    const otpCode = generateOtp();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes validity

    await Otp.deleteMany({ email: lowerEmail, purpose: "VERIFY_EMAIL" });
    await Otp.create({
      email: lowerEmail,
      otp: otpCode,
      purpose: "VERIFY_EMAIL",
      expiresAt,
      attempts: 0,
      isUsed: false
    });

    try {
      await sendOtpEmail(lowerEmail, otpCode);
    } catch (mailErr) {
      console.error("Failed to send OTP to new email:", mailErr);
    }

    return res.status(200).json({
      success: true,
      message: "Verification code sent to your new email."
    });
  } catch (error) {
    console.error("Change email request error:", error);
    return res.status(500).json({ success: false, message: "Something went wrong." });
  }
};

export const postVerifyEmailUpdate = async (req, res) => {
  try {
    const currentUser = req.user || req.session.user;
    const { newEmail, otp } = req.body;

    if (!newEmail || !otp) {
      return res.status(400).json({ success: false, message: "Email and OTP are required." });
    }

    const lowerEmail = newEmail.toLowerCase();

    const otpRecord = await Otp.findOne({
      email: lowerEmail,
      purpose: "VERIFY_EMAIL",
      isUsed: false
    });

    if (!otpRecord || otpRecord.expiresAt < new Date()) {
      return res.status(400).json({ success: false, message: "OTP expired or invalid." });
    }

    if (otpRecord.otp !== otp) {
      otpRecord.attempts += 1;
      await otpRecord.save();
      return res.status(400).json({ success: false, message: "Invalid OTP code." });
    }

    // Success: update email in User
    const user = await User.findById(currentUser.id || currentUser._id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    user.email = lowerEmail;
    await user.save();

    otpRecord.isUsed = true;
    await otpRecord.save();
    await Otp.deleteMany({ email: lowerEmail, purpose: "VERIFY_EMAIL" });

    // Update sessions
    if (req.session.user) {
      req.session.user.email = lowerEmail;
    }
    if (req.user) {
      req.user.email = lowerEmail;
    }

    return res.status(200).json({ success: true, message: "Email updated successfully!" });
  } catch (error) {
    console.error("Verify email update error:", error);
    return res.status(500).json({ success: false, message: "Failed to update email." });
  }
};

// Address Management
export const postAddAddress = async (req, res) => {
  try {
    const currentUser = req.user || req.session.user;
    const { addressLine1, addressLine2, pinCode, city, state, country, IsDefault } = req.body;

    const isDefaultBool = IsDefault === "true" || IsDefault === true;

    if (isDefaultBool) {
      // Unset previous defaults
      await Address.updateMany({ userId: currentUser.id || currentUser._id }, { IsDefault: false });
    } else {
      // If this is the user's first address, make it default regardless
      const count = await Address.countDocuments({ userId: currentUser.id || currentUser._id });
      if (count === 0) {
        req.body.IsDefault = true;
      }
    }

    const newAddress = await Address.create({
      userId: currentUser.id || currentUser._id,
      addressLine1,
      addressLine2,
      pinCode,
      city,
      state,
      country,
      IsDefault: isDefaultBool || (await Address.countDocuments({ userId: currentUser.id || currentUser._id })) === 0
    });

    return res.status(200).json({
      success: true,
      message: "Address added successfully.",
      address: newAddress
    });
  } catch (error) {
    console.error("Add address error:", error);
    return res.status(500).json({ success: false, message: "Failed to add address." });
  }
};

export const postEditAddress = async (req, res) => {
  try {
    const currentUser = req.user || req.session.user;
    const { id } = req.params;
    const { addressLine1, addressLine2, pinCode, city, state, country, IsDefault } = req.body;

    const isDefaultBool = IsDefault === "true" || IsDefault === true;
    const userId = currentUser.id || currentUser._id;

    const existingAddress = await Address.findOne({ _id: id, userId });
    if (!existingAddress) {
      return res.status(404).json({ success: false, message: "Address not found." });
    }

    if (isDefaultBool) {
      // Unset previous defaults
      await Address.updateMany({ userId }, { IsDefault: false });
    }

    const shouldRemainDefault = existingAddress.IsDefault && !isDefaultBool;

    const address = await Address.findOneAndUpdate(
      { _id: id, userId },
      {
        addressLine1,
        addressLine2,
        pinCode,
        city,
        state,
        country,
        IsDefault: isDefaultBool || shouldRemainDefault
      },
      { new: true }
    );

    return res.status(200).json({
      success: true,
      message: "Address updated successfully.",
      address
    });
  } catch (error) {
    console.error("Edit address error:", error);
    return res.status(500).json({ success: false, message: "Failed to update address." });
  }
};

export const postDeleteAddress = async (req, res) => {
  try {
    const currentUser = req.user || req.session.user;
    const { id } = req.params;

    const address = await Address.findOne({ _id: id, userId: currentUser.id || currentUser._id });
    if (!address) {
      return res.status(404).json({ success: false, message: "Address not found." });
    }

    const wasDefault = address.IsDefault;
    await Address.deleteOne({ _id: id });

    // If deleted address was default, set another one as default if exists
    if (wasDefault) {
      const anotherAddress = await Address.findOne({ userId: currentUser.id || currentUser._id });
      if (anotherAddress) {
        anotherAddress.IsDefault = true;
        await anotherAddress.save();
      }
    }

    return res.status(200).json({ success: true, message: "Address deleted successfully." });
  } catch (error) {
    console.error("Delete address error:", error);
    return res.status(500).json({ success: false, message: "Failed to delete address." });
  }
};
