import Cart from "../models/Cart.js";
import Product from "../models/Product.js";
import Variant from "../models/Variant.js";

export const getCart = async (req, res) => {
  try {
    const userId = req.session.user.id;

    const cart = await Cart.findOne({
      userId,
    }).populate({
      path: "items.variantId",
      populate: {
        path: "productId",
      },
    });

    if (!cart || cart.items.length === 0) {
      return res.render("user/cart", {
        cartItems: [],
        total: 0,
      });
    }

    let total = 0;

    const cartItems = cart.items.map((item) => {
      const variant = item.variantId;

      const product = variant.productId;

      const price = item.priceSnapshot;

      const subtotal = price * item.quantity;

      total += subtotal;

      return {
        product,

        variant,

        quantity: item.quantity,

        price,

        subtotal,
      };
    });

    res.render("user/cart", {
      cartItems,
      total,
    });
  } catch (error) {
    console.log(error);

    res.redirect("/");
  }
};

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

export const updateCartQuantity = async (req, res) => {
  try {
    const userId = req.session.user.id;

    const { variantId, change } = req.body;

    const cart = await Cart.findOne({
      userId,
    });

    const item = cart.items.find(
      (item) => item.variantId.toString() === variantId,
    );

    if (!item) {
      return res.json({
        success: false,

        message: "Item not found",
      });
    }

    const variant = await Variant.findById(variantId);

    const newQuantity = item.quantity + change;

    if (newQuantity < 1) {
      return res.json({
        success: false,

        message: "Minimum quantity is 1",
      });
    }

    if (newQuantity > variant.stock) {
      return res.json({
        success: false,

        message: "Maximum stock reached",
      });
    }

    item.quantity = newQuantity;

    await cart.save();

    return res.json({
      success: true,
    });
  } catch (error) {
    console.log(error);
  }
};

export const removeCartItem = async (req, res) => {
  try {
    const userId = req.session.user.id;

    const variantId = req.params.variantId;

    const cart = await Cart.findOne({
      userId,
    });

    if (!cart) {
      return res.json({
        success: false,
        message: "Cart not found",
      });
    }

    cart.items = cart.items.filter(
      (item) => item.variantId.toString() !== variantId,
    );

    await cart.save();

    return res.json({
      success: true,
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      message: "Server Error"
    });
  }
};

    