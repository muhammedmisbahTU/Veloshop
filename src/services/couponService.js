import Coupon from "../models/Coupon.js";

export const applyCoupon = async (code, subtotal, userId) => {
  const coupon = await Coupon.findOne({
    code: code.toUpperCase().trim(),
    isActive: true,
  });

  if (!coupon) {
    return {
      success: false,
      message: "Invalid coupon",
    };
  }

  const now = new Date();

  if (coupon.startDate > now) {
    return {
      success: false,
      message: "Coupon not started",
    };
  }

  if (coupon.expiryDate < now) {
    return {
      success: false,
      message: "Coupon expired",
    };
  }

  if (subtotal < coupon.minimumPurchase) {
    return {
      success: false,
      message: `Minimum purchase ₹${coupon.minimumPurchase}`,
    };
  }

  const alreadyUsedCount = coupon.usedBy.filter(id => id.toString() === userId.toString()).length;
  const usagePerUser = coupon.usagePerUser || 1;
  if (alreadyUsedCount >= usagePerUser) {
    return {
      success: false,
      message: "Coupon already used",
    };
  }

  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
    return {
      success: false,
      message: "Coupon limit reached",
    };
  }

  let discount = 0;

  if (coupon.discountType === "PERCENTAGE") {
    discount = subtotal * coupon.discountValue / 100;

    if (coupon.maximumDiscount) {
      discount = Math.min(discount, coupon.maximumDiscount);
    }
  } else {
    discount = coupon.discountValue;
  }

  if (discount > subtotal) {
    discount = subtotal;
  }

  return {
    success: true,
    coupon,
    discount,
    finalTotal: subtotal - discount,
  };
};