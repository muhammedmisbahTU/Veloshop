import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    couponId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Coupon",
      default: null
    },
    shippingCost: {
      type: Number,
      default: 0
    },
    items: [
      {
        variantId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Variant",
          required: true
        },
        sku: {
          type: String,
          required: true
        },
        productName: {
          type: String,
          required: true
        },
        thumbnail: {
          type: String
        },
        quantity: {
          type: Number,
          required: true,
          min: 1
        },
        price: {
          type: Number,
          required: true
        },

        itemStatus:{
        type:String,
        enum:[
            "ACTIVE",
            "CANCELLED",
            "RETURNED"
          ],
        default:"ACTIVE"
        },

        cancellationReason: {
        type:String,
        default:""
        },

        returnStatus:{
          type:String,
          enum:[
              "NONE",
              "REQUESTED",
              "APPROVED",
              "REJECTED",
              "COMPLETED"
          ],
          default:"NONE"
      },

      returnReason:{
          type:String,
          default:""
      }
      }
    ],
    paymentMethod: {
      type: String,
      enum: ["WALLET", "UPI", "CARD", "COD", "ONLINE"],
      required: true
    },
    paymentStatus: {
      type: String,
      enum: ["PENDING", "SUCCESS", "FAILED", "REFUNDED"],
      default: "PENDING"
    },
    paymentGatewayId: {
      type: String,
      default: null
    },
    status: {
      type: String,
      enum: [
        "PENDING",
        "PAYMENT_FAILED",
        "CONFIRMED",
        "PROCESSING",
        "SHIPPED",
        "DELIVERED",
        "CANCELLED",
        "RETURNED"
      ],
      default: "PENDING"
    },
    subtotal: {
      type: Number,
      required: true
    },
    couponDiscount: {
      type: Number,
      default: 0
    },
    offerDiscount: {
      type: Number,
      default: 0
    },
    deliveryDate: {
      type: Date
    },
    taxAmount: {
      type: Number,
      default: 0
    },
    grandTotal: {
      type: Number,
      required: true
    },
    cancellationReason: {
      type: String
    },
    returnReason: {
      type: String
    },
    refundAmount: {
      type: Number,
      default: 0
    },
    returnStatus: {
      type: String,
      enum: ["NONE", "REQUESTED", "APPROVED", "REJECTED", "COMPLETED"],
      default: "NONE"
    },
    refundStatus: {
      type: String,
      enum: ["NONE", "PENDING", "COMPLETED", "FAILED"],
      default: "NONE"
    },
    returnRejectedReason: {
      type: String
    },
    addressSnapshot: {
      addressLine1: { type: String, required: true },
      addressLine2: { type: String },
      city: { type: String, required: true },
      state: { type: String, required: true },
      pinCode: { type: String, required: true },
      country: { type: String, required: true }
    }
  },
  {
    timestamps: true
  }
);

// Indexes
orderSchema.index({ userId: 1 });
orderSchema.index({ createdAt: 1 });

const Order = mongoose.model("Order", orderSchema);
export default Order;
