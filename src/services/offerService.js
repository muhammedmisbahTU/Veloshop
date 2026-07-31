import Offer from "../models/Offer.js";

export const getBestOffer = async (product, price) => {
  const now = new Date();

  const offers = await Offer.find({
    isActive: true,

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
        category: product.categoryId,
      },
    ],
  });

  let best = null;

  let highest = 0;

  for (const offer of offers) {
    let discount;

    if (offer.discountType === "PERCENTAGE") {
      discount = (price * offer.discountValue) / 100;
    } else {
      discount = offer.discountValue;
    }

    if (discount > highest) {
      highest = discount;

      best = offer;
    }
  }

  return best;
};
