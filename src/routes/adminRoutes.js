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
import { isAdmin } from "../middleware/auth.js";
import validate from "../middleware/validate.js";
import { loginSchema } from "../validators/authValidator.js";

const router = express.Router();

router.get("/admin/login", getAdminLogin);
router.post("/admin/login", validate(loginSchema), postAdminLogin);
router.get("/admin", isAdmin, (req, res) => res.redirect("/admin/users"));
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
router.get("/admin/products/:id/edit", isAdmin, getEditProduct);
router.post("/admin/products/:id", isAdmin, updateProduct);
router.post("/admin/products/:id/delete", isAdmin, softDeleteProduct);
router.post("/admin/products/:id/restore", isAdmin, restoreProduct);
router.post("/admin/products/:id/toggle-status", isAdmin, toggleProductStatus);

export default router;
