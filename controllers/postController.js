import pool from "../config/database.js";
import { POST_STATUS } from "../config/constants.js";
import { publishPost } from "../services/instagramService.js";

/**
 * CREATE POST (DRAFT / SCHEDULED)
 */
export const createPost = async (req, res) => {
  try {
    const { caption, mediaUrl, publishAt } = req.body;
    const userId = req.user.id;

    if (!mediaUrl) {
      return res.status(400).json({ error: "Media URL is required" });
    }

    // Fetch connected Instagram account
    const account = await pool.query(
      "SELECT id FROM instagram_accounts WHERE user_id = $1 LIMIT 1",
      [userId]
    );

    if (!account.rows.length) {
      return res.status(400).json({ error: "No Instagram account connected" });
    }

    const status = publishAt ? POST_STATUS.SCHEDULED : POST_STATUS.DRAFT;

    /**
     * IMPORTANT:
     * - Single image → store STRING
     * - Carousel → store ARRAY
     */
    const normalizedMedia =
      Array.isArray(mediaUrl) && mediaUrl.length > 1
        ? mediaUrl
        : Array.isArray(mediaUrl)
        ? mediaUrl[0]
        : mediaUrl;

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
        JSON.stringify(normalizedMedia),
        status,
        publishAt || null,
      ]
    );

    res.status(201).json({ post: result.rows[0] });
  } catch (err) {
    console.error("Create post error:", err);
    res.status(500).json({ error: "Create post failed" });
  }
};

/**
 * GET POSTS
 */
export const getPosts = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `
      SELECT *
      FROM posts
      WHERE user_id = $1
      ORDER BY created_at DESC
      `,
      [userId]
    );

    res.json({
      posts: result.rows.map((p) => ({
        ...p,
        mediaUrl: JSON.parse(p.media_url),
      })),
    });
  } catch (err) {
    console.error("Get posts error:", err);
    res.status(500).json({ error: "Failed to fetch posts" });
  }
};

/**
 * PUBLISH NOW
 */
export const publishNow = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  try {
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
      return res.status(404).json({ error: "Post not found" });
    }

    const post = result.rows[0];
    const parsedMedia = JSON.parse(post.media_url);

    /**
     * AUTO-UNWRAP:
     * ["img.jpg"] → "img.jpg"
     */
    const mediaToPublish =
      Array.isArray(parsedMedia) && parsedMedia.length === 1
        ? parsedMedia[0]
        : parsedMedia;

    const instagramPostId = await publishPost(
      post.instagram_account_id,
      mediaToPublish,
      post.caption
    );

    await pool.query(
      `
      UPDATE posts
      SET status = $1,
          published_at = NOW(),
          instagram_post_id = $2,
          error_message = NULL
      WHERE id = $3
      `,
      [POST_STATUS.PUBLISHED, instagramPostId, id]
    );

    res.json({ instagramPostId });
  } catch (err) {
    const msg = err.response?.data?.error?.message || err.message;

    await pool.query(
      `
      UPDATE posts
      SET status = $1,
          error_message = $2
      WHERE id = $3
      `,
      [POST_STATUS.FAILED, msg, id]
    );

    res.status(500).json({ error: msg });
  }
};
