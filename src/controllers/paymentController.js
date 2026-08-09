import Order from "../models/Order.js";
import Variant from "../models/Variant.js";
import { verifySignature } from "../services/paymentService.js";

export async function restoreCartAndStock(order, userId) {
  try {
    // 1. Restore stock
    for (const item of order.items) {
        await Variant.findByIdAndUpdate(item.variantId, { $inc: { stock: item.quantity } });
    }
    
    // 2. Restore cart
    const Cart = (await import("../models/Cart.js")).default;
    let cart = await Cart.findOne({ userId });
    if (!cart) {
        cart = new Cart({ userId, items: [] });
    }
    
    // Re-add items from order to cart
    for (const item of order.items) {
        const hasItem = cart.items.some(ci => ci.variantId.toString() === item.variantId.toString());
        if (!hasItem) {
            const variantObj = await Variant.findById(item.variantId);
            cart.items.push({
                variantId: item.variantId,
                productId: variantObj ? variantObj.productId : null,
                quantity: item.quantity,
                priceSnapshot: item.price
            });
        }
    }
    await cart.save();
  } catch (err) {
    console.error("Error restoring cart and stock:", err);
  }
}

class PaymentController {
  // POST /payment/verify
  async verifyPayment(req, res) {
    try {
      const { orderId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
      const userId = req.session?.user?.id || req.user?._id;

      const order = await Order.findOne({ _id: orderId, userId });
      if (!order) {
        return res.status(404).json({ success: false, message: "Order not found" });
      }

      const isValid = verifySignature({
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature
      });

      if (isValid) {
        order.paymentStatus = "SUCCESS";
        order.status = "CONFIRMED";
        order.paymentGatewayId = razorpay_payment_id;
        await order.save();
        return res.json({ success: true, message: "Payment verified successfully" });
      } else {
        if (order.status !== "PAYMENT_FAILED") {
          order.paymentStatus = "FAILED";
          order.status = "PAYMENT_FAILED";
          await order.save();
          await restoreCartAndStock(order, userId);
        }
        return res.status(400).json({ success: false, message: "Invalid signature verification" });
      }
    } catch (error) {
      console.error("Payment verification error:", error);
      return res.status(500).json({ success: false, message: "Internal Server Error" });
    }
  }

  // POST /payment/cancel/:id
  async cancelPayment(req, res) {
    try {
      const userId = req.session?.user?.id || req.user?._id;
      const order = await Order.findOne({ _id: req.params.id, userId });
      if (order && order.status !== "PAYMENT_FAILED") {
        order.paymentStatus = "FAILED";
        order.status = "PAYMENT_FAILED";
        await order.save();
        await restoreCartAndStock(order, userId);
      }
      return res.json({ success: true });
    } catch (error) {
      console.error("Payment cancel endpoint error:", error);
      return res.status(500).json({ success: false });
    }
  }

  // GET /payment-failure/:id
  async getPaymentFailure(req, res) {
    try {
      const userId = req.session?.user?.id || req.user?._id;
      const order = await Order.findOne({ _id: req.params.id, userId });
      res.render("user/payment-failure", {
        title: "Payment Failed",
        order,
        message: req.query.message || "Payment was rejected or cancelled."
      });
    } catch (error) {
      console.error("Payment failure page error:", error);
      res.redirect("/");
    }
  }

  // POST /payment/retry/:id
  async retryPaymentOrder(req, res) {
    try {
      const userId = req.session?.user?.id || req.user?._id;
      const order = await Order.findOne({ _id: req.params.id, userId });
      if (!order) {
        return res.status(404).json({ success: false, message: "Order not found" });
      }

      // Re-verify and re-decrement stock for retry
      const updatedVariants = [];
      try {
          for (const item of order.items) {
              const variantObj = await Variant.findById(item.variantId);
              if (!variantObj || !variantObj.isActive || variantObj.stock < item.quantity) {
                  const availStock = variantObj ? variantObj.stock : 0;
                  throw new Error(`Insufficient stock for ${item.productName}. Available quantity: ${availStock}.`);
              }
              const updated = await Variant.findOneAndUpdate(
                  { _id: item.variantId, stock: { $gte: item.quantity } },
                  { $inc: { stock: -item.quantity } },
                  { new: true }
              );
              if (!updated) {
                  throw new Error(`Insufficient stock for ${item.productName}. Available quantity: ${variantObj.stock}.`);
              }
              updatedVariants.push({ id: item.variantId, quantity: item.quantity });
          }
      } catch (stockError) {
          // Rollback
          for (const uv of updatedVariants) {
              await Variant.findByIdAndUpdate(uv.id, { $inc: { stock: uv.quantity } });
          }
          return res.status(400).json({ success: false, message: stockError.message });
      }

      // Clear cart again now that stock is secured for retry
      const Cart = (await import("../models/Cart.js")).default;
      const cart = await Cart.findOne({ userId });
      if (cart) {
          cart.items = [];
          await cart.save();
      }

      order.status = "PENDING";
      order.paymentStatus = "PENDING";
      await order.save();

      const { initPayment } = await import("../services/paymentService.js");
      const rzpData = await initPayment(order);

      return res.json({
        success: true,
        paymentRequired: true,
        orderId: order._id,
        ...rzpData
      });
    } catch (error) {
      console.error("Payment retry error:", error);
      return res.status(500).json({ success: false, message: "Failed to regenerate payment transaction." });
    }
  }
}

export default new PaymentController();
