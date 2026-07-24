import wishlistService from "../services/wishlistService.js";

class WishlistController {
  async addToWishlist(req, res) {
    try {
      const userId = req.session?.user?.id || req.user?._id;
      const { variantId } = req.body;

      const result = await wishlistService.addToWishlist(userId, variantId);

      return res.json(result);
    } catch (error) {
      console.error("From whishlist controller (add)",error);

      return res.status(500).json({
        success: false,
        message: "Something went wrong",
      });
    }
  }

  async removeFromWishlist(req, res) {
    try {
      const userId = req.session?.user?.id || req.user?._id;
      const { variantId } = req.params;

      const result = await wishlistService.removeFromWishlist(
        userId,
        variantId,
      );

      return res.json(result);
    } catch (error) {
      console.error("from whishlist controller (remove)", error);

      return res.status(500).json({
        success: false,
        message: "Something went wrong",
      });
    }
  }

  async getWishlist(req, res) {
    try {
      const userId = req.session?.user?.id || req.user?._id;

      const wishlist = await wishlistService.getWishlist(userId);
      
      res.render("user/wishlist", {
        title: "Wishlist",
        wishlist,
      });
    } catch (error) {
      console.error("from whishlist controller (get)",error);

      res.redirect("/");
    }
  }
}

export default new WishlistController();
