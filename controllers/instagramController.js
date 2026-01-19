import axios from "axios";
import pool from "../config/database.js";
import { encrypt } from "../utils/encryption.js";

const GRAPH_BASE = "https://graph.facebook.com/v24.0";

/**
 * GET /instagram/connect
 * Facebook Login for Business (IG API Onboarding)
 */
export const connect = async (req, res) => {
  try {
    const userId = req.user.id;

    const params = new URLSearchParams({
      client_id: process.env.FACEBOOK_APP_ID,
      display: "page",
      redirect_uri: process.env.INSTAGRAM_REDIRECT_URI,
      response_type: "token",
      scope: [
        "instagram_basic",
        "instagram_content_publish",
        "instagram_manage_comments",
        "instagram_manage_insights",
        "pages_show_list",
        "pages_read_engagement",
        "business_management",
      ].join(","),

      extras: JSON.stringify({
        setup: { channel: "IG_API_ONBOARDING" },
      }),

      state: String(userId),
    });

    const authUrl = `https://www.facebook.com/v24.0/dialog/oauth?${params.toString()}`;

    return res.json({ authUrl });
  } catch (err) {
    console.error("Instagram connect error:", err);
    return res.status(500).json({ error: "Failed to generate login URL" });
  }
};

/**
 * POST /instagram/callback
 * Body:
 * {
 *   access_token: string,
 *   expires_in: number,
 *   state: string
 * }
 */
export const callback = async (req, res) => {
  try {
    const { access_token, state } = req.body;
    const userId = Number(state);

    if (!access_token || !userId) {
      return res.status(400).json({ error: 'Missing token or state' });
    }

    /**
     * STEP 1 — Exchange SHORT → LONG-LIVED USER TOKEN
     */
    const longTokenRes = await axios.get(
      `${GRAPH_BASE}/oauth/access_token`,
      {
        params: {
          grant_type: 'fb_exchange_token',
          client_id: process.env.FACEBOOK_APP_ID,
          client_secret: process.env.FACEBOOK_APP_SECRET,
          fb_exchange_token: access_token,
        },
      }
    );

    const longLivedUserToken = longTokenRes.data.access_token;
    const expiresIn = longTokenRes.data.expires_in ?? 5184000;
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    /**
     * STEP 2 — Fetch Facebook Pages the user manages
     */
    const pagesRes = await axios.get(
      `${GRAPH_BASE}/me/accounts`,
      {
        params: {
          fields: 'id,name,access_token,instagram_business_account',
          access_token: longLivedUserToken,
        },
      }
    );

    const pages = pagesRes.data?.data || [];

    if (!pages.length) {
      return res.status(400).json({
        error: 'No Facebook Pages found for this user',
      });
    }

    /**
     * STEP 3 — Find Page linked to Instagram Business Account
     */
    const pageWithInstagram = pages.find(
      (p) => p.instagram_business_account?.id
    );

    if (!pageWithInstagram) {
      return res.status(400).json({
        error: 'No Instagram Business Account linked to any Page',
      });
    }

    const igBusinessId =
      pageWithInstagram.instagram_business_account.id;
    const pageAccessToken = pageWithInstagram.access_token;

    /**
     * STEP 4 — UPSERT INTO DATABASE
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
      ON CONFLICT (user_id, instagram_business_account_id)
      DO UPDATE SET
        user_access_token_encrypted = EXCLUDED.user_access_token_encrypted,
        page_access_token_encrypted = EXCLUDED.page_access_token_encrypted,
        token_expires_at = EXCLUDED.token_expires_at,
        updated_at = NOW()
      `,
      [
        userId,
        igBusinessId,
        encrypt(longLivedUserToken),
        encrypt(pageAccessToken),
        expiresAt,
      ]
    );

    /**
     * STEP 5 — SUCCESS RESPONSE
     */
    return res.json({
      message: 'Instagram Business account connected successfully',
      pageId: pageWithInstagram.id,
      pageName: pageWithInstagram.name,
      instagramBusinessAccountId: igBusinessId,
      tokenExpiresAt: expiresAt,
    });
  } catch (err) {
    console.error(
      'Instagram callback error:',
      err.response?.data || err
    );

    return res.status(500).json({
      error: 'Instagram onboarding failed',
    });
  }
};




/**
 * GET /instagram/status
 * Check if Instagram is connected for logged-in user
 */
export const getInstagramStatus = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `
      SELECT 
        id,
        instagram_business_account_id,
        token_expires_at,
        created_at
      FROM instagram_accounts
      WHERE user_id = $1
      LIMIT 1
      `,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.json({
        connected: false,
      });
    }

    const account = result.rows[0];

    return res.json({
      connected: true,
      instagramAccount: {
        id: account.id,
        instagramBusinessAccountId: account.instagram_business_account_id,
        tokenExpiresAt: account.token_expires_at,
        connectedAt: account.created_at,
      },
    });
  } catch (error) {
    console.error("Instagram status error:", error);
    return res.status(500).json({
      error: "Failed to fetch Instagram connection status",
    });
  }
};
