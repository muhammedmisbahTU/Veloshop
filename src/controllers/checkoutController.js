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

        
        let total = 0;

        if (cartItems && cartItems.items.length) {
        cartItems.items.forEach((item)=>{
            item.subtotal = item.quantity * item.variantId.salePrice
            total = item.subtotal+total
        })
        }


        res.render("user/checkout", {
        title: "Checkout",
        addresses,
        cartItems,
        total,
      });

    } catch (error) {
      console.log("🚀 ~ CheckoutController ~ getCheckout ~ error:", error);
      res.redirect("/");
    }
  }
}


export default new CheckoutController();