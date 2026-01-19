import express from 'express';
import { postNow } from '../controllers/threadsPostController.js';

const router = express.Router();

router.post('/post', postNow);


export default router;

