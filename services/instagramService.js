import axios from "axios";
import pool from "../config/database.js";
import { decrypt } from "../utils/encryption.js";

const GRAPH_BASE = "https://graph.facebook.com/v24.0";

// GET IG ACCOUNT + PAGE TOKEN
const getInstagramAccount = async (instagramAccountId) => {
  const res = await pool.query(
    `
    SELECT instagram_business_account_id, page_access_token_encrypted
    FROM instagram_accounts
    WHERE id = $1
    `,
    [instagramAccountId]
  );

  if (!res.rows.length) {
    throw new Error("Instagram account not found");
  }

  return {
    igId: res.rows[0].instagram_business_account_id,
    pageToken: decrypt(res.rows[0].page_access_token_encrypted),
  };
};

// CREATE MEDIA CONTAINER (IMAGE / VIDEO)
const createMediaContainer = async ({
  igId,
  pageToken,
  mediaUrl,
  caption,
  mediaType = "IMAGE",
  isCarouselItem = false,
  altText,
}) => {
  const payload = {
    is_carousel_item: isCarouselItem || undefined,
  };

  if (caption) payload.caption = caption;

  if (mediaType === "IMAGE") {
    payload.image_url = mediaUrl;
    if (altText) payload.alt_text = altText;
  } else {
    payload.video_url = mediaUrl;
    payload.media_type = mediaType;
  }

  const res = await axios.post(
    `${GRAPH_BASE}/${igId}/media`,
    payload,
    {
      headers: { Authorization: `Bearer ${pageToken}` },
    }
  );

  return res.data.id;
};

// WAIT UNTIL CONTAINER IS READY
const waitForContainerReady = async ({
  containerId,
  pageToken,
  maxRetries = 10,
  delayMs = 5000,
}) => {
  for (let i = 0; i < maxRetries; i++) {
    const res = await axios.get(
      `${GRAPH_BASE}/${containerId}`,
      {
        params: { fields: "status_code" },
        headers: { Authorization: `Bearer ${pageToken}` },
      }
    );

    const status = res.data.status_code;

    if (status === "FINISHED") {
      return;
    }

    if (status === "ERROR" || status === "EXPIRED") {
      throw new Error(`Media container failed: ${status}`);
    }

    // IN_PROGRESS → wait
    await new Promise((r) => setTimeout(r, delayMs));
  }

  throw new Error("Media processing timeout");
};

// PUBLISH CONTAINER
const publishContainer = async ({ igId, pageToken, containerId }) => {
  const res = await axios.post(
    `${GRAPH_BASE}/${igId}/media_publish`,
    { creation_id: containerId },
    {
      headers: { Authorization: `Bearer ${pageToken}` },
    }
  );

  return res.data.id;
};

// PUBLISH POST
export const publishPost = async (
  instagramAccountId,
  mediaUrls,
  caption,
  options = {}
) => {
  const {
    mediaType = 'IMAGE',
    altText = null,
  } = options;

  const { igId, pageToken } =
    await getInstagramAccount(instagramAccountId);

  let containerId;

  // SINGLE IMAGE / VIDEO / REEL / STORY
  if (mediaType !== 'CAROUSEL') {
    const payload = { caption };

    if (mediaType === 'IMAGE') {
      payload.image_url = mediaUrls[0];
      if (altText) payload.alt_text = altText;
    } else {
      payload.video_url = mediaUrls[0];
      payload.media_type = mediaType; // VIDEO | REELS | STORIES
    }

    const res = await axios.post(
      `${GRAPH_BASE}/${igId}/media`,
      payload,
      {
        headers: { Authorization: `Bearer ${pageToken}` },
      }
    );

    containerId = res.data.id;
  }

  // CAROUSEL
  else {
    const children = [];

    for (const url of mediaUrls) {
      const child = await axios.post(
        `${GRAPH_BASE}/${igId}/media`,
        {
          image_url: url,
          is_carousel_item: true,
        },
        {
          headers: { Authorization: `Bearer ${pageToken}` },
        }
      );
      children.push(child.data.id);
    }

    const carousel = await axios.post(
      `${GRAPH_BASE}/${igId}/media`,
      {
        media_type: 'CAROUSEL',
        caption,
        children: children.join(','),
      },
      {
        headers: { Authorization: `Bearer ${pageToken}` },
      }
    );

    containerId = carousel.data.id;
  }

  // WAIT UNTIL CONTAINER IS READY
  await waitForContainerReady({ containerId, pageToken });

  // PUBLISH
  const publish = await axios.post(
    `${GRAPH_BASE}/${igId}/media_publish`,
    { creation_id: containerId },
    {
      headers: { Authorization: `Bearer ${pageToken}` },
    }
  );

  return publish.data.id;
};

