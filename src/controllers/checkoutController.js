import User from "../models/User.js";
import Address from "../models/Address.js";
import Cart from "../models/Cart.js"; //.js full time 
import Variant from "../models/Variant.js";


class CheckoutController {
  async getCheckout(req, res) {
    try {

        const userId = req.session?.user?.id || req.user?._id;
        const user = await User.findById(userId);
        const addresses = await Address.find({ userId: user._id });
        const cartItems = await Cart.findOne({ userId: user._id }).populate('items.variantId').populate('items.productId');

        
        let subtotal = 0;

        cartItems.items.forEach(item => {
            item.subtotal = item.quantity * item.variantId.salePrice;
            subtotal += item.subtotal;
        });

        const discount = 0;      // coupon/offer
        const shipping = 0;       // free delivery
        const tax = subtotal * 0.18; // example GST

        const grandTotal =
            subtotal
            - discount
            + tax
            + shipping;



        res.render("user/checkout", {
        title: "Checkout",
        addresses,
        cartItems,
        subtotal,
        discount,
        tax,
        shipping,
        grandTotal
      });

    } catch (error) {
      console.log("🚀 ~ CheckoutController ~ getCheckout ~ error:", error);
      res.redirect("/");
    }
  }
}


export default new CheckoutController();