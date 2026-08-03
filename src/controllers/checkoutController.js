import User from "../models/User.js";
import Address from "../models/Address.js";
import Cart from "../models/Cart.js"; //.js full time 
import Variant from "../models/Variant.js";
import Order from "../models/Order.js";
import crypto from "crypto";
import { applyCoupon } from "../services/couponService.js";
import Coupon from "../models/Coupon.js";
import { calculateCheckout } from "../services/checkoutService.js";

class CheckoutController {
  async getCheckout(req, res) {
    try {

        const userId = req.session?.user?.id || req.user?._id;
        const user = await User.findById(userId);
        const addresses = await Address.find({ userId: user._id });
        const cartItems = await Cart.findOne({ userId: user._id }).populate('items.variantId').populate('items.productId');

        if (!cartItems || cartItems.items.length === 0) {
            return res.redirect("/cart");
        }

        const couponDiscount = req.session.checkout?.coupon?.discount || 0;

        const totals = calculateCheckout(cartItems, couponDiscount);

        req.session.checkout = {
            ...totals,
            coupon: req.session.checkout?.coupon || null
        };


        const Wallet = (await import("../models/Wallet.js")).default;
        let wallet = await Wallet.findOne({ userId: user._id });
        if (!wallet) {
            wallet = await Wallet.create({ userId: user._id, balance: 0 });
        }

        res.render("user/checkout", {
        title: "Checkout",
        addresses,
        cartItems,
        coupon: req.session.checkout?.coupon || null,
        wallet,
        ...totals,
      });

    } catch (error) {
      console.log("🚀 ~ CheckoutController ~ getCheckout ~ error:", error);
      res.redirect("/");
    }
  }

  async placeOrder(req,res){
    try {
        const userId = req.session?.user?.id || req.user?._id;
        const { addressId, paymentMethod, useWallet } = req.body;

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

    const couponDiscount = req.session.checkout?.coupon?.discount || 0;
    const totals = calculateCheckout(cart, couponDiscount);

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

    const couponData = req.session.checkout?.coupon || null;
    const orderNumber = `ORD-${Date.now()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;

    // Handle Wallet logic
    let walletDeducted = 0;
    let finalPayable = totals.grandTotal;

    if (useWallet) {
        const Wallet = (await import("../models/Wallet.js")).default;
        const Transaction = (await import("../models/Transaction.js")).default;

        let wallet = await Wallet.findOne({ userId });
        if (!wallet) {
            wallet = await Wallet.create({ userId, balance: 0 });
        }

        if (wallet.balance > 0) {
            walletDeducted = Math.min(wallet.balance, totals.grandTotal);
            finalPayable = totals.grandTotal - walletDeducted;

            wallet.balance -= walletDeducted;
            await wallet.save();
        }
    }

    const order = await Order.create({
        orderNumber,
        userId,
        items,
        shippingAddress: addressSnapshot,
        subtotal: totals.subtotal,
        offerDiscount: totals.offerDiscount,
        taxAmount: totals.tax,
        shippingCost: totals.shipping,
        grandTotal: totals.grandTotal,
        paymentMethod: walletDeducted > 0 && finalPayable === 0 ? "WALLET" : paymentMethod,
        paymentStatus: walletDeducted > 0 && finalPayable === 0 ? "SUCCESS" : "PENDING",
        status: walletDeducted > 0 && finalPayable === 0 ? "CONFIRMED" : "PENDING",
        addressSnapshot,
        couponId: couponData ? couponData.id : null,
        couponDiscount: totals.couponDiscount,
    });

    // Record wallet transaction if deducted
    if (walletDeducted > 0) {
        const Wallet = (await import("../models/Wallet.js")).default;
        const Transaction = (await import("../models/Transaction.js")).default;
        const wallet = await Wallet.findOne({ userId });

        await Transaction.create({
            userId,
            walletId: wallet._id,
            referenceType: "ORDER",
            referenceId: order._id,
            amount: walletDeducted,
            balanceAfter: wallet.balance,
            transactionType: "DEBIT",
            status: "SUCCESS",
            description: `Wallet deduction for order ${order.orderNumber}`
        });
    }

    for (const item of cart.items) {
        item.variantId.stock -= item.quantity;
        await item.variantId.save();
    }

    cart.items = [];
    await cart.save();

    if (req.session.checkout?.coupon) {

        const coupon = await Coupon.findById(
            req.session.checkout.coupon.id
        );

        if (coupon) {
            coupon.usedCount += 1;
            coupon.usedBy.push(userId);
            await coupon.save();
        }
    }

    delete req.session.checkout;

    // Razorpay online payment integration
    if (paymentMethod === "ONLINE" && finalPayable > 0) {
        try {
            const { initPayment } = await import("../services/paymentService.js");
            // Set order grandTotal temporarily to finalPayable for Razorpay order generation
            const originalGrandTotal = order.grandTotal;
            order.grandTotal = finalPayable;
            const rzpData = await initPayment(order);
            // Restore order grandTotal to original database state
            order.grandTotal = originalGrandTotal;
            await order.save();

            return res.json({
                success: true,
                paymentRequired: true,
                orderId: order._id,
                ...rzpData
            });
        } catch (paymentError) {
            console.error("Razorpay order creation failed, marking order as PAYMENT_FAILED:", paymentError);
            order.status = "PAYMENT_FAILED";
            order.paymentStatus = "FAILED";
            await order.save();
            return res.json({
                success: false,
                message: "Online payment initiation failed. You can retry from your orders page."
            });
        }
    }

    if (finalPayable === 0) {
        order.status = "CONFIRMED";
        order.paymentStatus = "SUCCESS";
        await order.save();
    }

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

  async applyCouponController(req,res) {

    const {code}=req.body;

    if (!req.session.checkout) {
        return res.status(400).json({
            success: false,
            message: "Please refresh the checkout page."
        });
    }

    const cart = await Cart.findOne({ userId: req.session.user.id })
        .populate("items.variantId");

    if (!cart || cart.items.length === 0) {
        return res.json({
            success: false,
            message: "Cart is empty."
        });
    }

    const totals = calculateCheckout(cart);

    const result = await applyCoupon(
        code,
        totals.subtotal,
        req.session.user.id
    );

    if(!result.success){
        return res.json(result);
    }

    req.session.checkout.coupon={
        id:result.coupon._id,
        code:result.coupon.code,
        discount:result.discount
    };

    res.json(result);
}

  async removeCoupon(req,res) {

    if (req.session.checkout) {
        delete req.session.checkout.coupon;
    }

    res.json({
        success:true
    });

}
}


export default new CheckoutController();