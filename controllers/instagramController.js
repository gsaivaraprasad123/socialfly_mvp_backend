import axios from 'axios';
import pool from '../config/database.js';
import { encrypt } from '../utils/encryption.js';

export const connect = async (req, res) => {
  try {
    const userId = req.user.id;
    const redirectUri = `${process.env.BACKEND_URL}/instagram/callback`;
    
    const authUrl = `https://www.facebook.com/v18.0/dialog/oauth?` +
      `client_id=${process.env.FACEBOOK_APP_ID}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `scope=instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement&` +
      `response_type=code&` +
      `state=${userId}`;

    res.json({ authUrl });
  } catch (error) {
    console.error('Instagram connect error:', error);
    res.status(500).json({ error: 'Failed to generate auth URL' });
  }
};

export const callback = async (req, res) => {
  try {
    const { code, state } = req.query;

    if (!code) {
      return res.status(400).json({ error: 'Authorization code is required' });
    }

    if (!state) {
      return res.status(400).json({ error: 'State parameter is required' });
    }

    const userId = parseInt(state);
    
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid state parameter' });
    }

    // Verify user exists
    const userCheck = await pool.query('SELECT id FROM users WHERE id = $1', [userId]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const redirectUri = `${process.env.BACKEND_URL}/instagram/callback`;

    // Exchange code for short-lived access token
    const tokenResponse = await axios.get(
      'https://graph.facebook.com/v18.0/oauth/access_token',
      {
        params: {
          client_id: process.env.FACEBOOK_APP_ID,
          client_secret: process.env.FACEBOOK_APP_SECRET,
          redirect_uri: redirectUri,
          code,
        },
      }
    );

    const shortLivedToken = tokenResponse.data.access_token;

    // Exchange for long-lived token
    const longLivedResponse = await axios.get(
      'https://graph.facebook.com/v18.0/oauth/access_token',
      {
        params: {
          grant_type: 'fb_exchange_token',
          client_id: process.env.FACEBOOK_APP_ID,
          client_secret: process.env.FACEBOOK_APP_SECRET,
          fb_exchange_token: shortLivedToken,
        },
      }
    );

    const longLivedToken = longLivedResponse.data.access_token;
    const expiresIn = longLivedResponse.data.expires_in || 5184000; // Default 60 days

    // Get user's pages
    const pagesResponse = await axios.get(
      'https://graph.facebook.com/v18.0/me/accounts',
      {
        params: {
          access_token: longLivedToken,
        },
      }
    );

    if (pagesResponse.data.data.length === 0) {
      return res.status(400).json({ error: 'No Facebook pages found' });
    }

    // Get Instagram Business Account ID from the first page
    const pageId = pagesResponse.data.data[0].id;
    const pageInfoResponse = await axios.get(
      `https://graph.facebook.com/v18.0/${pageId}`,
      {
        params: {
          fields: 'instagram_business_account',
          access_token: longLivedToken,
        },
      }
    );

    const instagramBusinessAccountId = pageInfoResponse.data.instagram_business_account?.id;

    if (!instagramBusinessAccountId) {
      return res.status(400).json({ error: 'No Instagram Business Account linked to this Facebook page' });
    }

    // Encrypt and store token
    const encryptedToken = encrypt(longLivedToken);
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    // Check if account already exists
    const existingAccount = await pool.query(
      'SELECT id FROM instagram_accounts WHERE user_id = $1 AND instagram_business_account_id = $2',
      [userId, instagramBusinessAccountId]
    );

    if (existingAccount.rows.length > 0) {
      // Update existing account
      await pool.query(
        `UPDATE instagram_accounts 
         SET access_token_encrypted = $1, token_expires_at = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [encryptedToken, expiresAt, existingAccount.rows[0].id]
      );
    } else {
      // Insert new account
      await pool.query(
        `INSERT INTO instagram_accounts (user_id, instagram_business_account_id, access_token_encrypted, token_expires_at)
         VALUES ($1, $2, $3, $4)`,
        [userId, instagramBusinessAccountId, encryptedToken, expiresAt]
      );
    }

    res.json({
      message: 'Instagram account connected successfully',
      instagramBusinessAccountId,
    });
  } catch (error) {
    console.error('Instagram callback error:', error.response?.data || error.message);
    res.status(500).json({ 
      error: 'Failed to connect Instagram account',
      details: error.response?.data || error.message,
    });
  }
};

