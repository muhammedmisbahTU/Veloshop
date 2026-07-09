import Cart from "../models/Cart.js";
import Product from "../models/Product.js";
import Variant from "../models/Variant.js";

export const addToCart = async (req, res) => {
  try {
    const userId = req.session.user.id;

    const { productId, variantId, quantity } = req.body;

    const product = await Product.findOne({
      _id: productId,
      isDeleted: false,
    }).populate({
      path: "categoryId",
      match: {
        isDeleted: false,
      },
    });

    if (!product || !product.categoryId) {
      return res.json({
        success: false,

        message: "Product unavailable.",
      });
    }

    const variant = await Variant.findById(variantId);

    if (!variant) {
      return res.json({
        success: false,

        message: "Variant not found.",
      });
    }

    if (variant.stock < quantity) {
      return res.json({
        success: false,

        message: "Not enough stock.",
      });
    }

    let cart = await Cart.findOne({
      userId,
    });

    if (!cart) {
      cart = new Cart({
        userId,

        items: [],
      });
    }

    const existingItem = cart.items.find(
      (item) => item.variantId.toString() === variantId,
    );

    if (existingItem) {
      existingItem.quantity += quantity;
    } else {
      cart.items.push({
        productId,

        variantId,

        quantity,

        priceSnapshot: variant.salePrice || variant.regularPrice,
      });
    }

    await cart.save();

    return res.json({
      success: true,

      message: "Added to cart.",
    });

  } catch (error) {
    console.log(error);

    return res.status(500).json({
        success: false,
        message: "Server error",
    });
  }
};