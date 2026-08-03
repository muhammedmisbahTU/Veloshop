import Order from "../models/Order.js";
import crypto from "crypto";
import Razorpay from "razorpay";

// Initialize Razorpay instance if credentials are provided in process.env
const getRazorpayInstance = () => {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    return null;
  }
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
  });
};

/**
 * Initialize a Razorpay payment order
 * @param {Object} order - Order document
 * @returns {Promise<Object>} Razorpay order details plus keyId
 */
export const initPayment = async (order) => {
  const razorpay = getRazorpayInstance();
  if (!razorpay) {
    throw new Error("Razorpay credentials are not configured in environment variables.");
  }

  const options = {
    amount: Math.round(order.grandTotal * 100), // convert to paise
    currency: "INR",
    receipt: order.orderNumber,
    notes: {
      orderId: order._id.toString()
    }
  };

  const razorpayOrder = await razorpay.orders.create(options);
  
  // Store Razorpay order ID in order document
  order.paymentGatewayId = razorpayOrder.id;
  await order.save();

  return {
    razorpayOrderId: razorpayOrder.id,
    amount: razorpayOrder.amount,
    currency: razorpayOrder.currency,
    keyId: process.env.RAZORPAY_KEY_ID
  };
};

/**
 * Verify Razorpay signature
 * @param {Object} params - payment parameters
 * @returns {boolean} true if verification succeeds
 */
export const verifySignature = (params) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = params;
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return false;
  }
  const shasum = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET);
  shasum.update(`${razorpay_order_id}|${razorpay_payment_id}`);
  const digest = shasum.digest("hex");
  return digest === razorpay_signature;
};
