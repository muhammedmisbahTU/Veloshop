import express from 'express';
import { getRegister, getLogin } from '../controllers/authController.js';
import sendOtpEmail from "../services/sendOtpEmail.js";

const router = express.Router();

router.get('/register', getRegister);
router.get('/login', getLogin);

router.get(
  "/test-mail",
  async (req,res)=>{

    await sendOtpEmail(
      "amallswalih2007@gmail.com",
      "123456"
    );

    res.send(
      "Mail Sent"
    );

});

export default router;