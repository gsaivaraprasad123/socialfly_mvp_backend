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

    // Get user's Instagram account
    const accountResult = await pool.query(
      'SELECT id FROM instagram_accounts WHERE user_id = $1 LIMIT 1',
      [userId]
    );

    if (accountResult.rows.length === 0) {
      return res.status(400).json({ error: 'No Instagram account connected. Please connect your Instagram account first.' });
    }

    const instagramAccountId = accountResult.rows[0].id;

    // Determine status based on publishAt
    const status = publishAt ? POST_STATUS.SCHEDULED : POST_STATUS.DRAFT;

    // Insert post
    const result = await pool.query(
      `INSERT INTO posts (user_id, instagram_account_id, caption, media_url, status, publish_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [userId, instagramAccountId, caption || null, mediaUrl, status, publishAt || null]
    );

    const post = result.rows[0];

    res.status(201).json({
      message: 'Post created successfully',
      post: {
        id: post.id,
        caption: post.caption,
        mediaUrl: post.media_url,
        status: post.status,
        publishAt: post.publish_at,
        createdAt: post.created_at,
      },
    });
  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({ error: 'Failed to create post' });
  }
};

export const getPosts = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT id, caption, media_url, status, publish_at, published_at, 
              instagram_post_id, error_message, created_at, updated_at
       FROM posts
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );

    res.json({
      posts: result.rows.map(post => ({
        id: post.id,
        caption: post.caption,
        mediaUrl: post.media_url,
        status: post.status,
        publishAt: post.publish_at,
        publishedAt: post.published_at,
        instagramPostId: post.instagram_post_id,
        errorMessage: post.error_message,
        createdAt: post.created_at,
        updatedAt: post.updated_at,
      })),
    });
  } catch (error) {
    console.error('Get posts error:', error);
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
};

export const publishNow = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Get post and verify ownership
    const postResult = await pool.query(
      `SELECT p.*, ia.id as instagram_account_id
       FROM posts p
       JOIN instagram_accounts ia ON p.instagram_account_id = ia.id
       WHERE p.id = $1 AND p.user_id = $2`,
      [id, userId]
    );

    if (postResult.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const post = postResult.rows[0];

    if (post.status === POST_STATUS.PUBLISHED) {
      return res.status(400).json({ error: 'Post is already published' });
    }

    try {
      // Publish to Instagram
      const instagramPostId = await publishPost(
        post.instagram_account_id,
        post.media_url,
        post.caption || ''
      );

      // Update post status
      await pool.query(
        `UPDATE posts 
         SET status = $1, published_at = CURRENT_TIMESTAMP, instagram_post_id = $2, error_message = NULL
         WHERE id = $3`,
        [POST_STATUS.PUBLISHED, instagramPostId, id]
      );

      res.json({
        message: 'Post published successfully',
        instagramPostId,
      });
    } catch (error) {
      // Update post status to FAILED
      const errorMessage = error.response?.data?.error?.message || error.message || 'Unknown error';
      
      await pool.query(
        `UPDATE posts 
         SET status = $1, error_message = $2
         WHERE id = $3`,
        [POST_STATUS.FAILED, errorMessage, id]
      );

      res.status(500).json({
        error: 'Failed to publish post',
        details: errorMessage,
      });
    }
  } catch (error) {
    console.error('Publish now error:', error);
    res.status(500).json({ error: 'Failed to publish post' });
  }
};

