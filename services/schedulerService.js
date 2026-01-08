// services/SchedulerService.js
import cron from 'node-cron';
import pool from '../config/database.js';
import { POST_STATUS } from '../config/constants.js';
import { publishPost } from './instagramService.js';

export const startScheduler = () => {
  cron.schedule('*/1 * * * *', async () => {
    const now = new Date();

    const posts = await pool.query(
      `
      SELECT p.*, ia.id AS instagram_account_id
      FROM posts p
      JOIN instagram_accounts ia ON ia.id = p.instagram_account_id
      WHERE p.status = $1
        AND p.publish_at <= $2
      ORDER BY p.publish_at
      LIMIT 10
      `,
      [POST_STATUS.SCHEDULED, now]
    );

    for (const post of posts.rows) {
      try {
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
          [POST_STATUS.PUBLISHED, instagramPostId, post.id]
        );
      } catch (err) {
        const msg =
          err.response?.data?.error?.message || err.message;

        await pool.query(
          `
          UPDATE posts
          SET status = $1, error_message = $2
          WHERE id = $3
          `,
          [POST_STATUS.FAILED, msg, post.id]
        );
      }
    }
  });

  console.log('✅ Scheduler started');
};
