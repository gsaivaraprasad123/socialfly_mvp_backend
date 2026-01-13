import axios from "axios";
import pool from "../config/database.js";
import { decrypt } from "../utils/encryption.js";

const GRAPH_BASE = "https://graph.facebook.com/v24.0";

/**
 * Get IG account + page token
 */
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

/**
 * Create media container (IMAGE / VIDEO)
 */
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

/**
 * ⏳ WAIT until container is ready
 */
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

/**
 * Publish container
 */
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

/**
 * 🚀 PUBLIC: Publish Post
 */
export const publishPost = async (
  instagramAccountId,
  mediaUrl,
  caption,
  options = {}
) => {
  const { igId, pageToken } =
    await getInstagramAccount(instagramAccountId);

  let containerId;

  /**
   * SINGLE IMAGE / VIDEO
   */
  if (!Array.isArray(mediaUrl)) {
    containerId = await createMediaContainer({
      igId,
      pageToken,
      mediaUrl,
      caption,
      mediaType: options.mediaType || "IMAGE",
      altText: options.altText,
    });
  }
  /**
   * CAROUSEL
   */
  else {
    if (mediaUrl.length < 2) {
      throw new Error("Carousel requires at least 2 media URLs");
    }

    const childContainers = [];
    for (const url of mediaUrl) {
      const childId = await createMediaContainer({
        igId,
        pageToken,
        mediaUrl: url,
        isCarouselItem: true,
      });
      childContainers.push(childId);
    }

    const carouselRes = await axios.post(
      `${GRAPH_BASE}/${igId}/media`,
      {
        media_type: "CAROUSEL",
        caption,
        children: childContainers.join(","),
      },
      {
        headers: { Authorization: `Bearer ${pageToken}` },
      }
    );

    containerId = carouselRes.data.id;
  }

  /**
   * ⏳ WAIT until media is READY
   */
  await waitForContainerReady({
    containerId,
    pageToken,
  });

  /**
   * 🚀 PUBLISH
   */
  return await publishContainer({
    igId,
    pageToken,
    containerId,
  });
};
