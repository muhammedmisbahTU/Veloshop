import express from 'express';
import {
  getHome,
  getShop,
  getProductDetails,
} from "../controllers/homeController.js";
import {
  addToCart,
  getCart,
  updateCartQuantity,
  removeCartItem,
} from "../controllers/cartController.js";
import {
  getProfile,
  getEditProfile,
  postEditProfile,
  postChangePassword,
  postChangeEmailRequest,
  postVerifyEmailUpdate,
  postAddAddress,
  postEditAddress,
  postDeleteAddress
} from '../controllers/userController.js';
import { isAuthenticated } from '../middleware/auth.js';
import { uploadAvatar } from '../config/cloudinaryConfig.js';
import validate from "../middleware/validate.js";
import { addressSchema } from "../validators/addressValidator.js";
import wishlistController from "../controllers/wishlistController.js";
import checkoutController from "../controllers/checkoutController.js";
import orderController from "../controllers/orderController.js";
import Coupon from '../models/Coupon.js';

const router = express.Router();

router.get("/", getHome);
router.get("/shop", getShop);
router.get("/products/:id", getProductDetails);

router.get("/profile", isAuthenticated, getProfile);
router.get("/profile/edit", isAuthenticated, getEditProfile);
router.post("/profile/edit", isAuthenticated, (req, res, next) => {
  uploadAvatar.single("avatar")(req, res, (err) => {
    if (err) {
      return res.status(400).json({
        success: false,
        message: err.message
      });
    }
    next();
  });
}, postEditProfile);
router.post("/profile/change-password", isAuthenticated, postChangePassword);
router.post("/profile/change-email", isAuthenticated, postChangeEmailRequest);
router.post("/profile/verify-email", isAuthenticated, postVerifyEmailUpdate);

// Address CRUD
router.post("/addresses", isAuthenticated, validate(addressSchema), postAddAddress);
router.post("/addresses/edit/:id", isAuthenticated, validate(addressSchema), postEditAddress);
router.post("/addresses/delete/:id", isAuthenticated, postDeleteAddress);

// Cart
router.get("/cart", isAuthenticated, getCart);
router.post("/cart", isAuthenticated, addToCart);
router.patch("/cart", isAuthenticated, updateCartQuantity);
router.delete("/cart/:variantId", isAuthenticated, removeCartItem);

// Whishlist
router.post("/wishlist",isAuthenticated, wishlistController.addToWishlist);
router.delete("/wishlist/:variantId",isAuthenticated, wishlistController.removeFromWishlist);
router.get("/wishlist",isAuthenticated, wishlistController.getWishlist);

// Checkout
 router.get("/checkout",isAuthenticated,checkoutController.getCheckout);
 router.post("/checkout/place-order", isAuthenticated, checkoutController.placeOrder);
 router.get("/order-success/:id", isAuthenticated, checkoutController.orderSuccess);

 // Razorpay Payment Verification & Outcomes
 router.post("/payment/verify", isAuthenticated, async (req, res, next) => {
   const { default: paymentController } = await import("../controllers/paymentController.js");
   paymentController.verifyPayment(req, res, next);
 });
 router.post("/payment/cancel/:id", isAuthenticated, async (req, res, next) => {
   const { default: paymentController } = await import("../controllers/paymentController.js");
   paymentController.cancelPayment(req, res, next);
 });
 router.get("/payment-failure/:id", isAuthenticated, async (req, res, next) => {
   const { default: paymentController } = await import("../controllers/paymentController.js");
   paymentController.getPaymentFailure(req, res, next);
 });
 router.post("/payment/retry/:id", isAuthenticated, async (req, res, next) => {
   const { default: paymentController } = await import("../controllers/paymentController.js");
   paymentController.retryPaymentOrder(req, res, next);
 });

 router.get( "/orders/search", isAuthenticated, orderController.searchOrders );

 router.get("/orders/:id", isAuthenticated, checkoutController.orderDetails);
 
 // Order Management
 router.get( "/orders", isAuthenticated, orderController.getOrders );
 router.post( "/orders/:id/cancel", isAuthenticated, orderController.cancelOrder );
 router.post( "/orders/:orderId/item/:itemId/cancel", isAuthenticated, orderController.cancelOrderItem );
 router.post( "/orders/:orderId/item/:itemId/return", isAuthenticated, orderController.returnOrderItem );
 router.post( "/orders/:orderId/return", isAuthenticated, orderController.returnOrder );
 router.get( "/orders/:id/invoice", isAuthenticated, orderController.downloadInvoice );

 // Coupon
 router.post("/checkout/apply-coupon", isAuthenticated, checkoutController.applyCouponController );
 router.post( "/checkout/remove-coupon", isAuthenticated, checkoutController.removeCoupon );

 // Wallet
  router.get("/wallet/history", isAuthenticated, async (req, res) => {
      try {
          const Wallet = (await import("../models/Wallet.js")).default;
          const Transaction = (await import("../models/Transaction.js")).default;
          const userId = req.session?.user?.id || req.user?._id;

          let wallet = await Wallet.findOne({ userId });
          if (!wallet) {
              wallet = await Wallet.create({ userId, balance: 0 });
          }

          const transactions = await Transaction.find({ userId }).sort({ createdAt: -1 });

          res.render("user/wallet-history", {
              layout: "layouts/user-layout",
              title: "Wallet Transaction History",
              wallet,
              transactions
          });
      } catch (err) {
          console.error("Wallet history error:", err);
          res.redirect("/profile");
      }
  });

export default router;
