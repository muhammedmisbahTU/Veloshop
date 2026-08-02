import mongoose from "mongoose";

const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },

    description: {
      type: String,
      trim: true,
    },

    discountType: {
      type: String,
      enum: ["PERCENTAGE", "FIXED"],
      required: true,
    },

    discountValue: {
      type: Number,
      required: true,
      min: 1,
    },

    minimumPurchase: {
      type: Number,
      default: 0,
    },

    maximumDiscount: {
      type: Number,
      default: null, // Only for percentage coupons
    },

    startDate: {
      type: Date,
      required: true,
    },

    expiryDate: {
      type: Date,
      required: true,
    },

    usageLimit: {
      type: Number,
      default: null, // null = unlimited
    },

    usedCount: {
      type: Number,
      default: 0,
    },

    usagePerUser: {
      type: Number,
      default: 1,
    },

    applicableTo: {
      type: String,
      enum: ["ALL", "PRODUCT", "CATEGORY"],
      default: "ALL",
    },

    products: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
    }],

    categories: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
    }],

    isActive: {
      type: Boolean,
      default: true,
    },

    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Coupon", couponSchema);