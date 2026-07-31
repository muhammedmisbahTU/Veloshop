import crypto from "crypto";

export const generateReferralCode = () => {
  return "VELO-" + crypto.randomBytes(4).toString("hex").toUpperCase();
};

export const generateToken = () => {
  return crypto.randomBytes(32).toString("hex");
};
