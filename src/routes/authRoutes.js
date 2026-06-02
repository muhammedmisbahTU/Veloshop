import express from 'express';
import { getRegister, getLogin } from '../controllers/authController.js';

const router = express.Router();

router.get('/register', getRegister);
router.get('/login', getLogin);

export default router;