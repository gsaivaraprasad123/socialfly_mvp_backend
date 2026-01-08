import axios from 'axios';
import pool from '../config/database.js';
import { decrypt } from '../utils/encryption.js';

const GRAPH_BASE = 'https://graph.facebook.com/v24.0';

/**
 * Fetch IG business account + PAGE token
 */
const getInstagramAccount = async (instagramAccountId) => {
  const res = await pool.query(
    `
    SELECT
      instagram_business_account_id,
      page_access_token_encrypted
    FROM instagram_accounts
    WHERE id = $1
    `,
    [instagramAccountId]
  );

  if (res.rows.length === 0) {
    throw new Error('Instagram account not found');
  }

  return {
    igId: res.rows[0].instagram_business_account_id,
    pageToken: decrypt(res.rows[0].page_access_token_encrypted),
  };
};

/**
 * Create media container (image or video)
 */
const createMediaContainer = async ({
  igId,
  pageToken,
  mediaUrl,
  caption,
  mediaType = 'IMAGE',
  isCarouselItem = false,
  altText,
}) => {
  const payload = {
    access_token: pageToken,
    caption,
    is_carousel_item: isCarouselItem || undefined,
  };

  if (mediaType === 'IMAGE') {
    payload.image_url = mediaUrl;
    if (altText) payload.alt_text = altText;
  } else {
    payload.video_url = mediaUrl;
    payload.media_type = mediaType; // VIDEO | REELS | STORIES
  }

  const res = await axios.post(
    `${GRAPH_BASE}/${igId}/media`,
    payload
  );

  return res.data.id;
};

/**
 * Create carousel container
 */
const createCarouselContainer = async ({
  igId,
  pageToken,
  caption,
  childrenIds,
}) => {
  const res = await axios.post(
    `${GRAPH_BASE}/${igId}/media`,
    {
      media_type: 'CAROUSEL',
      caption,
      children: childrenIds.join(','),
      access_token: pageToken,
    }
  );

  return res.data.id;
};

/**
 * Publish container
 */
const publishContainer = async ({ igId, pageToken, containerId }) => {
  const res = await axios.post(
    `${GRAPH_BASE}/${igId}/media_publish`,
    {
      creation_id: containerId,
      access_token: pageToken,
    }
  );

  return res.data.id;
};

/**
 * PUBLIC: Publish Post (used by controller + cron)
 */
export const publishPost = async (
  instagramAccountId,
  mediaUrl,
  caption,
  options = {}
) => {
  const { igId, pageToken } =
    await getInstagramAccount(instagramAccountId);

  // Rate-limit check (optional but recommended)
  const limitRes = await axios.get(
    `${GRAPH_BASE}/${igId}/content_publishing_limit`,
    { params: { access_token: pageToken } }
  );

  if (limitRes.data.data?.[0]?.quota_usage >= 100) {
    throw new Error('Instagram publishing rate limit exceeded');
  }

  let containerId;

  // SINGLE IMAGE / VIDEO
  if (!Array.isArray(mediaUrl)) {
    containerId = await createMediaContainer({
      igId,
      pageToken,
      mediaUrl,
      caption,
      mediaType: options.mediaType || 'IMAGE',
      altText: options.altText,
    });
  }
  // CAROUSEL
  else {
    if (mediaUrl.length > 10) {
      throw new Error('Carousel supports max 10 items');
    }

    const childContainers = [];
    for (const url of mediaUrl) {
      const childId = await createMediaContainer({
        igId,
        pageToken,
        mediaUrl: url,
        caption: null,
        isCarouselItem: true,
      });
      childContainers.push(childId);
    }

    containerId = await createCarouselContainer({
      igId,
      pageToken,
      caption,
      childrenIds: childContainers,
    });
  }

  // Publish
  return await publishContainer({
    igId,
    pageToken,
    containerId,
  });
};
