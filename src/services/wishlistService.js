import Wishlist from "../models/Wishlist.js";

class WishlistService {
  async addToWishlist(userId, variantId) {
    let wishlist = await Wishlist.findOne({ userId });

    if (!wishlist) {
      wishlist = await Wishlist.create({
        userId,
        items: [],
      });
    }

    const alreadyExists = wishlist.items.some(
      (item) => item.variantId.toString() === variantId,
    );

    if (alreadyExists) {
      return {
        success: false,
        message: "Already in wishlist",
      };
    }

    wishlist.items.push({ variantId });

    await wishlist.save();

    return {
      success: true,
      message: "Added to wishlist",
    };
  }

  async removeFromWishlist(userId, variantId) {
    const wishlist = await Wishlist.findOne({ userId });

    if (!wishlist) {
      return {
        success: false,
        message: "Wishlist not found",
      };
    }

    wishlist.items = wishlist.items.filter(
      (item) => item.variantId.toString() !== variantId,
    );

    await wishlist.save();

    return {
      success: true,
      message: "Removed from wishlist",
    };
  }

  async getWishlist(userId) {
    const wishlist = await Wishlist.findOne({ userId }).populate({
      path: "items.variantId",
      populate: {
        path: "productId",
      },
    });

    return wishlist;
  }

  async isWishlisted(userId, variantId) {
    if (!userId) return false;

    const wishlist = await Wishlist.findOne({ userId });

    if (!wishlist) return false;

    return wishlist.items.some(
      (item) => item.variantId.toString() === variantId.toString(),
    );
  }
}

export default new WishlistService();
