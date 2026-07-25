import User from "../models/User.js";
import Address from "../models/Address.js";
import Cart from "../models/Cart.js"; //.js full time 
import Variant from "../models/Variant.js";
import Order from "../models/Order.js";
import crypto from "crypto";


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

  async placeOrder(req,res){
    try {
        const userId = req.session?.user?.id || req.user?._id;
        const { addressId, paymentMethod } = req.body;

        if (!addressId) {
        return res.status(400).json({
            success: false,
            message: "Address is required.",
        });
        }

        // Validate payment method
        if (!paymentMethod) {
        return res.status(400).json({
            success: false,
            message: "Payment method is required.",
        });
        }

        // Check if address exists
        const address = await Address.findOne({
        _id: addressId,
        userId,
        });

        if (!address) {
        return res.status(404).json({
            success: false,
            message: "Address not found.",
        });
        }

        // Check if cart exists
        const cart = await Cart.findOne({ userId })
        .populate("items.variantId")
        .populate("items.productId");

        if (!cart) {
        return res.status(404).json({
            success: false,
            message: "Cart not found.",
        });
        }

        // Check if cart is empty
        if (!cart.items || cart.items.length === 0) {
        return res.status(400).json({
            success: false,
            message: "Your cart is empty.",
        });
        }
        
        const allowedPaymentMethods = ["COD", "ONLINE", "WALLET"];

        if (!allowedPaymentMethods.includes(paymentMethod)) {
        return res.status(400).json({
            success: false,
            message: "Invalid payment method.",
        });
        }

        for (const item of cart.items) {

        if (item.variantId.stock < item.quantity) {

            return res.json({
                success:false,
                message:`${item.productId.name} is out of stock`
            });

        }

    }

    let subtotal = 0;

    cart.items.forEach(item => {

        item.subtotal =
            item.quantity * item.variantId.salePrice;

        subtotal += item.subtotal;

    });

    const discount = 0;
    const shipping = 0;
    const tax = subtotal * 0.18;

    const grandTotal =
    subtotal
    -discount
    +tax
    +shipping;

    const shippingAddress = {
    addressLine1: address.addressLine1,
    addressLine2: address.addressLine2,
    city: address.city,
    state: address.state,
    pinCode: address.pinCode,
    phone: address.phone,
    country: address.country
};

const addressSnapshot = {
    addressLine1: address.addressLine1,
    addressLine2: address.addressLine2,
    city: address.city,
    state: address.state,
    pinCode: address.pinCode,
    country: address.country
};

    const items = cart.items.map(item => ({
    variantId: item.variantId._id,
    sku: item.variantId.sku,
    productName: item.productId.name,
    thumbnail: item.variantId.images[0],
    quantity: item.quantity,
    price: item.variantId.salePrice
}));

    

    const orderNumber = `ORD-${Date.now()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;

    await Order.create({
    
    orderNumber,

    userId,

    items,

    shippingAddress,

    subtotal,

    couponDiscount: 0,

    offerDiscount: 0,

    taxAmount: tax,

    shippingCost: shipping,

    grandTotal,

    paymentMethod,

    paymentStatus: "PENDING",

    status: "CONFIRMED",

    addressSnapshot,

});

    for (const item of cart.items) {
        item.variantId.stock -= item.quantity;
        await item.variantId.save();
    }
    

    cart.items = [];

    await cart.save();

    return res.json({
    success: true,
    orderId: order._id
});



    } catch (error) {
        console.log("🚀 ~ CheckoutController ~ placeOrder ~ error:", error)
        return res.status(500).json({
        success: false,
        message: "Something went wrong.",
        });
    }
  }

  async orderSuccess(req,res){
    try {
        
        const userId = req.session?.user?.id || req.user?._id;
        const order = await Order.findOne({
        _id: req.params.id,
        userId:userId
    });

     if (!order) {
        return res.redirect("/");
    }

    res.render("user/order-success", {
        title: "Order Success",
        order
    });
        
    } catch (error) {
    console.log("🚀 ~ CheckoutController ~ orderSuccess ~ error:", error)
    return res.redirect("/");
    }
  }

  async orderDetails(req, res) {
    try {

        const userId = req.session?.user?.id || req.user?._id;

        const order = await Order.findOne({
            _id: req.params.id,
            userId
        });

        if (!order) {
            return res.redirect("/");
        }

        res.render("user/order-details", {
            title: "Order Details",
            order
        });

    } catch (error) {
        console.log("🚀 ~ orderDetails ~", error);
        res.redirect("/");
    }
}
}


export default new CheckoutController();