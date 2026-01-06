import express from 'express';
import { createPost, getPosts, publishNow } from '../controllers/postController.js';
import { authenticateToken } from '../middlewares/auth.js';

const router = express.Router();

router.post('/', authenticateToken, createPost);
router.get('/', authenticateToken, getPosts);
router.post('/:id/publish', authenticateToken, publishNow);

export default router;

