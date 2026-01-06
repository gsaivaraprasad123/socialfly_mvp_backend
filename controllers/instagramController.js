import axios from "axios";
import pool from "../config/database.js";
import { encrypt } from "../utils/encryption.js";

const GRAPH_BASE = "https://graph.facebook.com/v24.0";
const FB_DIALOG_BASE = "https://www.facebook.com/v24.0/dialog/oauth";

/**
 * STEP 1: Generate Facebook OAuth URL (Postman-friendly)
 * GET /instagram/connect
 */
export const connect = async (req, res) => {
  try {
    const userId = req.user.id;

    const redirectUri = `${process.env.BACKEND_URL}/instagram/callback`;

    const authUrl =
      `${FB_DIALOG_BASE}?` +
      `client_id=${process.env.FACEBOOK_APP_ID}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&scope=instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement` +
      `&response_type=code` +
      `&state=${userId}`;

    return res.json({ authUrl });
  } catch (error) {
    console.error("Instagram connect error:", error);
    return res.status(500).json({
      error: "Failed to generate Instagram auth URL",
    });
  }
};

/**
 * STEP 2: OAuth Callback
 * GET /instagram/callback?code=...&state=userId
 */
export const callback = async (req, res) => {
  try {
    const { code, state } = req.query;
    const userId = Number(state);

    if (!code || !userId) {
      return res.status(400).json({
        error: "Authorization code or state missing",
      });
    }

    const redirectUri = `${process.env.BACKEND_URL}/instagram/callback`;

    /**
     * 2.1 Exchange code → SHORT-LIVED USER ACCESS TOKEN
     */
    const shortTokenRes = await axios.get(`${GRAPH_BASE}/oauth/access_token`, {
      params: {
        client_id: process.env.FACEBOOK_APP_ID,
        client_secret: process.env.FACEBOOK_APP_SECRET,
        redirect_uri: redirectUri,
        code,
      },
    });

    const shortLivedToken = shortTokenRes.data.access_token;

    /**
     * 2.2 Exchange SHORT → LONG-LIVED USER TOKEN
     */
    const longTokenRes = await axios.get(`${GRAPH_BASE}/oauth/access_token`, {
      params: {
        grant_type: "fb_exchange_token",
        client_id: process.env.FACEBOOK_APP_ID,
        client_secret: process.env.FACEBOOK_APP_SECRET,
        fb_exchange_token: shortLivedToken,
      },
    });

    const longLivedUserToken = longTokenRes.data.access_token;
    const expiresIn = longTokenRes.data.expires_in ?? 5184000; // 60 days
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    /**
     * 2.3 Get Facebook Pages (IMPORTANT)
     * Must use USER token
     */
    const pagesRes = await axios.get(`${GRAPH_BASE}/me/accounts`, {
      params: {
        access_token: longLivedUserToken,
      },
    });

    if (!pagesRes.data.data || pagesRes.data.data.length === 0) {
      return res.status(400).json({
        error: "No Facebook Pages found for this account",
      });
    }

    // Prototype: pick first page
    const page = pagesRes.data.data[0];
    const pageId = page.id;
    const pageAccessToken = page.access_token;

    /**
     * 2.4 Get Instagram Business Account ID
     * Must use PAGE access token
     */
    const igRes = await axios.get(`${GRAPH_BASE}/${pageId}`, {
      params: {
        fields: "instagram_business_account",
        access_token: pageAccessToken,
      },
    });

    const igBusinessId = igRes.data.id;

    if (!igBusinessId) {
      return res.status(400).json({
        error: "No Instagram Business Account linked to this Page",
      });
    }

    /**
     * 2.5 Store / Update DB
     */
    // Encrypt tokens
    const encryptedUserToken = encrypt(longLivedUserToken);
    const encryptedPageToken = encrypt(pageAccessToken);

    /**
     * Check if Instagram account already exists for user
     */
    const existing = await pool.query(
      `
  SELECT id
  FROM instagram_accounts
  WHERE user_id = $1
    AND instagram_business_account_id = $2
  `,
      [userId, igBusinessId]
    );

    if (existing.rows.length > 0) {
      /**
       * UPDATE existing record
       */
      await pool.query(
        `
    UPDATE instagram_accounts
    SET
      user_access_token_encrypted = $1,
      page_access_token_encrypted = $2,
      token_expires_at = $3,
      updated_at = NOW()
    WHERE id = $4
    `,
        [encryptedUserToken, encryptedPageToken, expiresAt, existing.rows[0].id]
      );
    } else {
      /**
       * INSERT new record
       */
      await pool.query(
        `
    INSERT INTO instagram_accounts (
      user_id,
      instagram_business_account_id,
      user_access_token_encrypted,
      page_access_token_encrypted,
      token_expires_at
    )
    VALUES ($1, $2, $3, $4, $5)
    `,
        [
          userId,
          igBusinessId,
          encryptedUserToken,
          encryptedPageToken,
          expiresAt,
        ]
      );
    }

    return res.json({
      message: "Instagram account connected successfully",
      instagramBusinessAccountId: igBusinessId,
      pageId,
      tokenExpiresAt: expiresAt,
    });
  } catch (error) {
    console.error(
      "Instagram callback error:",
      error.response?.data || error.message
    );

    return res.status(500).json({
      error: "Failed to connect Instagram account",
      details: error.response?.data || error.message,
    });
  }
};
