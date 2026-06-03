import mongoose from "mongoose";

const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true
    },
    couponType: {
      type: String,
      enum: ["PERCENTAGE", "FIXED"],
      required: true
    },
    minAmount: {
      type: Number,
      default: 0
    },
    maxAmount: {
      type: Number
    },
    discountValue: {
      type: Number,
      required: true
    },
    usedCount: {
      type: Number,
      default: 0
    },
    expiryDate: {
      type: Date,
      required: true
    },
    isActive: {
      type: Boolean,
      default: true
    },
    usageLimit: {
      type: Number
    }
  },
  {
    timestamps: true
  }
);

const Coupon = mongoose.model("Coupon", couponSchema);
export default Coupon;
