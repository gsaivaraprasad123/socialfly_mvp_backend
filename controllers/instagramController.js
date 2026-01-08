import pool from '../config/database.js';
import { POST_STATUS } from '../config/constants.js';
import { publishPost } from '../services/instagramService.js';

export const createPost = async (req, res) => {
  try {
    const { caption, mediaUrl, publishAt } = req.body;
    const userId = req.user.id;

    if (!mediaUrl) {
      return res.status(400).json({ error: 'Media URL is required' });
    }

    const account = await pool.query(
      'SELECT id FROM instagram_accounts WHERE user_id = $1 LIMIT 1',
      [userId]
    );

    if (!account.rows.length) {
      return res.status(400).json({
        error: 'No Instagram account connected',
      });
    }

    const status = publishAt
      ? POST_STATUS.SCHEDULED
      : POST_STATUS.DRAFT;

    const result = await pool.query(
      `
      INSERT INTO posts
        (user_id, instagram_account_id, caption, media_url, status, publish_at)
      VALUES ($1,$2,$3,$4,$5,$6)
      RETURNING *
      `,
      [
        userId,
        account.rows[0].id,
        caption || null,
        JSON.stringify(mediaUrl),
        status,
        publishAt || null,
      ]
    );

    res.status(201).json({ post: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Create post failed' });
  }
};

export const publishNow = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const result = await pool.query(
      `
      SELECT p.*, ia.id AS instagram_account_id
      FROM posts p
      JOIN instagram_accounts ia ON ia.id = p.instagram_account_id
      WHERE p.id = $1 AND p.user_id = $2
      `,
      [id, userId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const post = result.rows[0];

    const instagramPostId = await publishPost(
      post.instagram_account_id,
      JSON.parse(post.media_url),
      post.caption
    );

    await pool.query(
      `
      UPDATE posts
      SET status = $1,
          published_at = NOW(),
          instagram_post_id = $2
      WHERE id = $3
      `,
      [POST_STATUS.PUBLISHED, instagramPostId, id]
    );

    res.json({ instagramPostId });
  } catch (err) {
    const msg =
      err.response?.data?.error?.message || err.message;

    await pool.query(
      `
      UPDATE posts
      SET status = $1, error_message = $2
      WHERE id = $3
      `,
      [POST_STATUS.FAILED, msg, req.params.id]
    );

    res.status(500).json({ error: msg });
  }
};
