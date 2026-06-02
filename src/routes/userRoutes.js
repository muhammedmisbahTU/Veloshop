import express from 'express';
import { createUser } from '../controllers/testController.js';

const router = express.Router();

router.get("/test-user",createUser);

export default router;

