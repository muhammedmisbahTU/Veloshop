import Order from "../models/Order.js";
import { verifySignature } from "../services/paymentService.js";

class PaymentController {
  // POST /payment/verify
  async verifyPayment(req, res) {
    try {
      const { orderId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

      const order = await Order.findById(orderId);
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
        order.paymentStatus = "FAILED";
        order.status = "PAYMENT_FAILED";
        await order.save();
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
      const order = await Order.findById(req.params.id);
      if (order) {
        order.paymentStatus = "FAILED";
        order.status = "PAYMENT_FAILED";
        await order.save();
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
      const order = await Order.findById(req.params.id);
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
}

export default new PaymentController();
