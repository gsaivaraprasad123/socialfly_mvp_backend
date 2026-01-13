import express from 'express';
import { connect, callback, getInstagramStatus } from '../controllers/instagramController.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = express.Router();

router.get('/connect', authenticateToken, connect);
router.post('/callback', callback);
router.get("/status", authenticateToken, getInstagramStatus);


export default router;

