import express from 'express';
import { getHome } from '../controllers/homeController.js';
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

const router = express.Router();

router.get("/", getHome);

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
router.post("/addresses", isAuthenticated, postAddAddress);
router.post("/addresses/edit/:id", isAuthenticated, postEditAddress);
router.post("/addresses/delete/:id", isAuthenticated, postDeleteAddress);

export default router;
