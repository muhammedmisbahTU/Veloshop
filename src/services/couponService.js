import Coupon from "../models/Coupon.js";

export const applyCoupon = async (code, cart, userId) => {
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

  let overallSubtotal = 0;
  let eligibleSubtotal = 0;

  for (const item of cart.items) {
    const price = item.variantId.salePrice != null ? item.variantId.salePrice : item.variantId.regularPrice;
    const itemSubtotal = price * item.quantity;
    overallSubtotal += itemSubtotal;

    let isEligible = false;
    if (coupon.applicableTo === "ALL" || !coupon.applicableTo) {
      isEligible = true;
    } else if (coupon.applicableTo === "PRODUCT") {
      isEligible = coupon.products.some(p => p.toString() === item.productId._id.toString() || p.toString() === item.productId.toString());
    } else if (coupon.applicableTo === "CATEGORY") {
      const catId = item.productId.categoryId ? (item.productId.categoryId._id || item.productId.categoryId) : null;
      isEligible = catId && coupon.categories.some(c => c.toString() === catId.toString());
    }

    if (isEligible) {
      eligibleSubtotal += itemSubtotal;
    }
  }

  if (eligibleSubtotal === 0) {
    return {
      success: false,
      message: "No eligible items in cart for this coupon",
    };
  }

  if (eligibleSubtotal < coupon.minimumPurchase) {
    return {
      success: false,
      message: `Minimum purchase of eligible products is ₹${coupon.minimumPurchase}`,
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
    discount = eligibleSubtotal * coupon.discountValue / 100;

    if (coupon.maximumDiscount) {
      discount = Math.min(discount, coupon.maximumDiscount);
    }
  } else {
    discount = coupon.discountValue;
  }

  if (discount > eligibleSubtotal) {
    discount = eligibleSubtotal;
  }

  return {
    success: true,
    coupon,
    discount,
    finalTotal: overallSubtotal - discount,
  };
};