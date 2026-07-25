import User from "../models/User.js";
import Address from "../models/Address.js";
import Cart from "../models/Cart.js"; //.js full time 
import Variant from "../models/Variant.js";
import Order from "../models/Order.js";
import crypto from "crypto";


class orderController {
  async getOrders(req, res) {
    try {

        const userId = req.session?.user?.id || req.user?._id;

        const orders = await Order.find({ userId })
        .select("orderNumber createdAt status paymentMethod paymentStatus grandTotal items.thumbnail items.productName")
        .sort({ createdAt: -1 });

        res.render("user/orders", {
            title: "My Orders",
            orders
        });

    } catch (error) {
        console.log(error);
        res.redirect("/");
    }
}

}


export default new orderController();