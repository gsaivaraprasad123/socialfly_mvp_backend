import axios from "axios";
import pool from "../config/database.js";
import { encrypt } from "../utils/encryption.js";

const GRAPH_BASE = "https://graph.facebook.com/v24.0";

// /instagram/connect
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
      ].join(","),

      // IMPORTANT — required for IG API onboarding
      extras: JSON.stringify({
        setup: { channel: "IG_API_ONBOARDING" },
      }),

      // CSRF + user mapping
      state: String(userId),
    });

    const authUrl = `https://www.facebook.com/v24.0/dialog/oauth?${params.toString()}`;

    return res.json({ authUrl });
  } catch (err) {
    console.error("Instagram connect error:", err);
    return res.status(500).json({ error: "Failed to generate login URL" });
  }
};

 // POST /instagram/callback
export const callback = async (req, res) => {
  try {
    const {
      access_token,
      long_lived_token,
      expires_in,
      state,
    } = req.body;

    const userId = Number(state);

    if (!long_lived_token || !userId) {
      return res.status(400).json({ error: "Missing token or state" });
    }

    const expiresAt = new Date(Date.now() + Number(expires_in) * 1000);

    /**
     * STEP 4 — Get Pages + IG Business Account
     */
    const pagesRes = await axios.get(`${GRAPH_BASE}/me/accounts`, {
      params: {
        fields: "id,name,access_token,instagram_business_account",
        access_token: long_lived_token,
      },
    });

    const pages = pagesRes.data.data || [];

    if (pages.length === 0) {
      return res.status(400).json({
        error: "No Facebook Pages found for this user",
      });
    }

    /**
     * Pick first page WITH IG business account
     * (Later you can allow user selection)
     */
    const page = pages.find(
      (p) => p.instagram_business_account?.id
    );

    if (!page) {
      return res.status(400).json({
        error: "No Instagram Business Account linked to any Page",
      });
    }

    const igBusinessId = page.instagram_business_account.id;
    const pageAccessToken = page.access_token;

    /**
     * STEP 5 — UPSERT into DB (MATCHES YOUR SCHEMA)
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
        encrypt(long_lived_token),
        encrypt(pageAccessToken),
        expiresAt,
      ]
    );

    return res.json({
      message: "Instagram Business account connected",
      instagramBusinessAccountId: igBusinessId,
      pageId: page.id,
      pageName: page.name,
      tokenExpiresAt: expiresAt,
    });
  } catch (err) {
    console.error("Instagram callback error:", err.response?.data || err);
    return res.status(500).json({ error: "Instagram onboarding failed" });
  }
};
