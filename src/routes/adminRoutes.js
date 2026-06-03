import express from "express";
import {
  blockUser,
  getAdminLogin,
  getUsers,
  postAdminLogin,
  unblockUser
} from "../controllers/adminController.js";
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

export default router;
