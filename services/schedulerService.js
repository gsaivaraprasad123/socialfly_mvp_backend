import cron from 'node-cron';
import pool from '../config/database.js';
import { POST_STATUS } from '../config/constants.js';
import { publishPost } from './instagramService.js';

// Run every 1 minute
const CRON_SCHEDULE = '*/1 * * * *';

export const startScheduler = () => {
  console.log('🕐 Starting scheduled post publisher (runs every 1 minute)...');

  cron.schedule(CRON_SCHEDULE, async () => {
    try {
      console.log('⏰ Checking for scheduled posts...');

      // Query posts that are due for publishing
      const now = new Date();
      const result = await pool.query(
        `SELECT p.*, ia.id as instagram_account_id
         FROM posts p
         JOIN instagram_accounts ia ON p.instagram_account_id = ia.id
         WHERE p.status = $1 
           AND p.publish_at IS NOT NULL 
           AND p.publish_at <= $2
         ORDER BY p.publish_at ASC
         LIMIT 10`,
        [POST_STATUS.SCHEDULED, now]
      );

      if (result.rows.length === 0) {
        return; // No posts to publish
      }

      console.log(`📬 Found ${result.rows.length} post(s) ready to publish`);

      // Publish posts one by one
      for (const post of result.rows) {
        try {
          console.log(`📤 Publishing post ${post.id}...`);

          // Publish to Instagram
          const instagramPostId = await publishPost(
            post.instagram_account_id,
            post.media_url,
            post.caption || ''
          );

          // Update post status to PUBLISHED
          await pool.query(
            `UPDATE posts 
             SET status = $1, published_at = CURRENT_TIMESTAMP, instagram_post_id = $2, error_message = NULL
             WHERE id = $3`,
            [POST_STATUS.PUBLISHED, instagramPostId, post.id]
          );

          console.log(`✅ Post ${post.id} published successfully (Instagram ID: ${instagramPostId})`);
        } catch (error) {
          // Update post status to FAILED
          const errorMessage = error.response?.data?.error?.message || error.message || 'Unknown error';
          
          await pool.query(
            `UPDATE posts 
             SET status = $1, error_message = $2
             WHERE id = $3`,
            [POST_STATUS.FAILED, errorMessage, post.id]
          );

          console.error(`❌ Failed to publish post ${post.id}:`, errorMessage);
        }
      }
    } catch (error) {
      console.error('❌ Scheduler error:', error);
    }
  });

  console.log('✅ Scheduler started successfully');
};

