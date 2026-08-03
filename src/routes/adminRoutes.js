import express from "express";
import {
  blockUser,
  getAdminLogin,
  getUsers,
  postAdminLogin,
  unblockUser
} from "../controllers/adminController.js";
import {
  createCategory,
  getCategories,
  getEditCategory,
  getNewCategory,
  restoreCategory,
  softDeleteCategory,
  toggleCategoryStatus,
  updateCategory
} from "../controllers/adminCategoryController.js";
import {
  createProduct,
  getEditProduct,
  getNewProduct,
  getProducts,
  restoreProduct,
  softDeleteProduct,
  toggleProductStatus,
  updateProduct
} from "../controllers/adminProductController.js";
import {
  createVariant,
  getEditVariant,
  getNewVariant,
  getVariants,
  toggleVariantStatus,
  updateVariant
} from "../controllers/adminVariantController.js";
import { uploadVariantImages } from "../config/cloudinaryConfig.js";
import { isAdmin } from "../middleware/auth.js";
import validate from "../middleware/validate.js";
import { loginSchema } from "../validators/authValidator.js";
import adminOrderController from "../controllers/adminOrderController.js"
import {
  getOffers,
  getNewOffer,
  createOffer,
  getEditOffer,
  updateOffer,
  toggleOfferStatus,
  softDeleteOffer,
  restoreOffer
} from "../controllers/adminOfferController.js";
import {
  getCoupons,
  getNewCoupon,
  createCoupon,
  toggleCouponStatus,
  softDeleteCoupon,
  restoreCoupon,
  getEditCoupon,
  updateCoupon
} from "../controllers/adminCouponController.js";

const router = express.Router();

router.get("/admin/login", getAdminLogin);
router.post("/admin/login", validate(loginSchema), postAdminLogin);
router.get("/admin", isAdmin, (req, res) => res.redirect("/admin/dashboard"));
router.get("/admin/dashboard", isAdmin, async (req, res, next) => {
    const { getDashboard } = await import("../controllers/adminController.js");
    getDashboard(req, res, next);
});
router.get("/admin/users", isAdmin, getUsers);
router.post("/admin/users/:id/block", isAdmin, blockUser);
router.post("/admin/users/:id/unblock", isAdmin, unblockUser);
router.get("/admin/categories", isAdmin, getCategories);
router.get("/admin/categories/new", isAdmin, getNewCategory);
router.post("/admin/categories", isAdmin, createCategory);
router.get("/admin/categories/:id/edit", isAdmin, getEditCategory);
router.post("/admin/categories/:id", isAdmin, updateCategory);
router.post("/admin/categories/:id/delete", isAdmin, softDeleteCategory);
router.post("/admin/categories/:id/restore", isAdmin, restoreCategory);
router.post("/admin/categories/:id/toggle-status", isAdmin, toggleCategoryStatus);
router.get("/admin/products", isAdmin, getProducts);
router.get("/admin/products/new", isAdmin, getNewProduct);
router.post("/admin/products", isAdmin, createProduct);
router.get("/admin/products/:productId/variants", isAdmin, getVariants);
router.get("/admin/products/:productId/variants/new", isAdmin, getNewVariant);
router.post("/admin/products/:productId/variants", isAdmin, uploadVariantImages.array("images", 10), createVariant);
router.get("/admin/products/:id/edit", isAdmin, getEditProduct);
router.post("/admin/products/:id", isAdmin, updateProduct);
router.post("/admin/products/:id/delete", isAdmin, softDeleteProduct);
router.post("/admin/products/:id/restore", isAdmin, restoreProduct);
router.post("/admin/products/:id/toggle-status", isAdmin, toggleProductStatus);
router.get("/admin/variants/:variantId/edit", isAdmin, getEditVariant);
router.post("/admin/variants/:variantId", isAdmin, uploadVariantImages.array("images", 10), updateVariant);
router.post("/admin/variants/:variantId/toggle-status", isAdmin, toggleVariantStatus);

router.get( "/admin/orders", isAdmin, adminOrderController.orderList );
router.get( "/admin/orders/:id", isAdmin, adminOrderController.orderDetails );
router.post( "/admin/orders/:id/status", isAdmin, adminOrderController.updateOrderStatus );
router.post( "/admin/orders/:orderId/item/:itemId/return-status", isAdmin, adminOrderController.updateItemReturnStatus );

router.get("/admin/reports", isAdmin, async (req, res, next) => {
    const { getSalesReports } = await import("../controllers/adminController.js");
    getSalesReports(req, res, next);
});
router.get("/admin/reports/download", isAdmin, async (req, res, next) => {
    const { downloadSalesReport } = await import("../controllers/adminController.js");
    downloadSalesReport(req, res, next);
});
router.get("/admin/ledger", isAdmin, async (req, res, next) => {
    const { getLedgerBook } = await import("../controllers/adminController.js");
    getLedgerBook(req, res, next);
});

//offer
router.get("/admin/offers", isAdmin, getOffers);
router.get("/admin/offers/new", isAdmin, getNewOffer);
router.post("/admin/offers", isAdmin, createOffer);
router.get("/admin/offers/:id/edit", isAdmin, getEditOffer);
router.post("/admin/offers/:id", isAdmin, updateOffer);
router.post( "/admin/offers/:id/toggle", isAdmin, toggleOfferStatus );
router.post( "/admin/offers/:id/delete", isAdmin, softDeleteOffer );
router.post( "/admin/offers/:id/restore", isAdmin, restoreOffer );

//coupons
router.get("/admin/coupons", isAdmin, getCoupons);
router.get("/admin/coupons/new", isAdmin, getNewCoupon);
router.post("/admin/coupons", isAdmin, createCoupon);
router.get("/admin/coupons/:id/edit", isAdmin, getEditCoupon);
router.post("/admin/coupons/:id", isAdmin, updateCoupon);
router.post("/admin/coupons/:id/toggle", isAdmin, toggleCouponStatus);
router.post("/admin/coupons/:id/delete", isAdmin, softDeleteCoupon);
router.post("/admin/coupons/:id/restore", isAdmin, restoreCoupon);

export default router;
