import express from 'express';
import { connect, callback } from '../controllers/instagramController.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = express.Router();

router.get('/connect', authenticateToken, connect);
router.get('/callback', callback);

export default router;

