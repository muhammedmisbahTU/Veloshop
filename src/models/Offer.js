import mongoose from "mongoose";

const offerSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true
    },
    discountType: {
      type: String,
      enum: ["PERCENTAGE", "FIXED"],
      required: true
    },
    discountValue: {
      type: Number,
      required: true
    },
    targetType: {
      type: String,
      enum: ["PRODUCT", "CATEGORY"],
      required: true
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: "targetType" // Mongoose will dynamically resolve reference to Product or Category
    },
    startDate: {
      type: Date,
      required: true
    },
    priority: {
      type: Number,
      default: 0
    },
    isStackable: {
      type: Boolean,
      default: false
    },
    expiryDate: {
      type: Date,
      required: true
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

const Offer = mongoose.model("Offer", offerSchema);
export default Offer;
