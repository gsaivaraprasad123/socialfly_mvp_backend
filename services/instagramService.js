import axios from 'axios';
import { decrypt } from '../utils/encryption.js';
import pool from '../config/database.js';

const INSTAGRAM_API_BASE = 'https://graph.facebook.com/v18.0';

// Get decrypted access token for an Instagram account
const getAccessToken = async (instagramAccountId) => {
  const result = await pool.query(
    'SELECT access_token_encrypted FROM instagram_accounts WHERE id = $1',
    [instagramAccountId]
  );

  if (result.rows.length === 0) {
    throw new Error('Instagram account not found');
  }

  return decrypt(result.rows[0].access_token_encrypted);
};

// Upload media to Instagram
export const uploadMedia = async (instagramAccountId, mediaUrl, mediaType = 'IMAGE') => {
  try {
    const accessToken = await getAccessToken(instagramAccountId);
    
    const accountResult = await pool.query(
      'SELECT instagram_business_account_id FROM instagram_accounts WHERE id = $1',
      [instagramAccountId]
    );

    const businessAccountId = accountResult.rows[0].instagram_business_account_id;

    // Step 1: Create media container
    const containerResponse = await axios.post(
      `${INSTAGRAM_API_BASE}/${businessAccountId}/media`,
      {
        image_url: mediaUrl,
        caption: '', // Will be added in publish step
        access_token: accessToken,
      }
    );

    const creationId = containerResponse.data.id;

    // Step 2: Publish the media
    const publishResponse = await axios.post(
      `${INSTAGRAM_API_BASE}/${businessAccountId}/media_publish`,
      {
        creation_id: creationId,
        access_token: accessToken,
      }
    );

    return publishResponse.data.id; // Instagram post ID
  } catch (error) {
    console.error('Instagram media upload error:', error.response?.data || error.message);
    throw error;
  }
};

// Publish post with caption
export const publishPost = async (instagramAccountId, mediaUrl, caption) => {
  try {
    const accessToken = await getAccessToken(instagramAccountId);
    
    const accountResult = await pool.query(
      'SELECT instagram_business_account_id FROM instagram_accounts WHERE id = $1',
      [instagramAccountId]
    );

    const businessAccountId = accountResult.rows[0].instagram_business_account_id;

    // Step 1: Create media container with caption
    const containerResponse = await axios.post(
      `${INSTAGRAM_API_BASE}/${businessAccountId}/media`,
      {
        image_url: mediaUrl,
        caption: caption || '',
        access_token: accessToken,
      }
    );

    const creationId = containerResponse.data.id;

    // Step 2: Publish the media
    const publishResponse = await axios.post(
      `${INSTAGRAM_API_BASE}/${businessAccountId}/media_publish`,
      {
        creation_id: creationId,
        access_token: accessToken,
      }
    );

    return publishResponse.data.id; // Instagram post ID
  } catch (error) {
    console.error('Instagram publish error:', error.response?.data || error.message);
    throw error;
  }
};

// Validate and refresh token if needed
export const validateToken = async (instagramAccountId) => {
  try {
    const accessToken = await getAccessToken(instagramAccountId);
    
    // Check token validity by making a simple API call
    const accountResult = await pool.query(
      'SELECT instagram_business_account_id FROM instagram_accounts WHERE id = $1',
      [instagramAccountId]
    );

    const businessAccountId = accountResult.rows[0].instagram_business_account_id;

    await axios.get(
      `${INSTAGRAM_API_BASE}/${businessAccountId}`,
      {
        params: {
          fields: 'id,username',
          access_token: accessToken,
        },
      }
    );

    return true;
  } catch (error) {
    console.error('Token validation error:', error.response?.data || error.message);
    return false;
  }
};

