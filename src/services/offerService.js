import Offer from "../models/Offer.js";

export const getProductOffers = async (product, price) => {
  const now = new Date();
  const categoryId = product.categoryId?._id || product.categoryId;

  const offers = await Offer.find({
    isActive: true,
    isDeleted: false,
    startDate: {
      $lte: now,
    },
    expiryDate: {
      $gte: now,
    },
    $or: [
      {
        product: product._id,
      },
      {
        category: categoryId,
      },
    ],
  });

  let productOffer = null;
  let categoryOffer = null;
  let productDiscount = 0;
  let categoryDiscount = 0;

  for (const offer of offers) {
    let discount = 0;
    if (offer.discountType === "PERCENTAGE") {
      discount = (price * offer.discountValue) / 100;
    } else {
      discount = offer.discountValue;
    }

    if (offer.type === "PRODUCT" || (offer.product && offer.product.toString() === product._id.toString())) {
      if (!productOffer || discount > productDiscount) {
        productOffer = offer;
        productDiscount = discount;
      }
    } else if (offer.type === "CATEGORY" || (offer.category && offer.category.toString() === categoryId.toString())) {
      if (!categoryOffer || discount > categoryDiscount) {
        categoryOffer = offer;
        categoryDiscount = discount;
      }
    }
  }

  const bestOffer = productDiscount >= categoryDiscount ? productOffer : categoryOffer;

  return {
    productOffer,
    categoryOffer,
    bestOffer,
    appliedOffer: bestOffer,
  };
};

export const getBestOffer = async (product, price) => {
  const res = await getProductOffers(product, price);
  return res.bestOffer;
};

