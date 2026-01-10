# SocailFlyAI

A comprehensive Node.js/Express backend platform for managing and scheduling Instagram posts with advanced features including OAuth integration, media publishing, carousel support, and automated scheduling.

## Table of Contents

- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Environment Variables](#environment-variables)
- [API Documentation](#api-documentation)
  - [Authentication APIs](#authentication-apis)
  - [Instagram APIs](#instagram-apis)
  - [Post Management APIs](#post-management-apis)
- [Database Schema](#database-schema)
- [Security Features](#security-features)
- [Development](#development)

---

## Features

- ✅ **User Authentication** - JWT-based authentication with secure password hashing
- ✅ **Instagram OAuth Integration** - Complete Instagram Business Account onboarding
- ✅ **Post Creation & Management** - Create, list, and manage Instagram posts
- ✅ **Scheduled Publishing** - Cron-based scheduler (runs every 1 minute)
- ✅ **Direct Publishing** - Publish posts immediately via API
- ✅ **Media Support** - Single images, videos, and carousel posts (up to 10 items)
- ✅ **Rate Limit Handling** - Built-in Instagram API rate limit checks
- ✅ **Encrypted Token Storage** - Secure storage of Instagram access tokens
- ✅ **Error Handling** - Comprehensive error tracking and status management

---

## Prerequisites

- **Node.js** (v14 or higher)
- **PostgreSQL** (v12 or higher)
- **Facebook App** with Instagram Graph API access
- **Instagram Business Account** linked to a Facebook Page

---

## Installation

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Environment Variables

Create a `.env` file in the root directory (see [Environment Variables](#environment-variables) section below).

### 3. Create PostgreSQL Database

```bash
createdb instagram_scheduler
```

Or using SQL:

```sql
CREATE DATABASE instagram_scheduler;
```

### 4. Start the Server

```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm start
```

The server will automatically:
- Connect to PostgreSQL database
- Initialize database schema (tables and indexes)
- Start the cron scheduler (runs every 1 minute)

---

## Environment Variables

Create a `.env` file with the following variables:

```env
# Server Configuration
PORT=8080
BACKEND_URL=http://localhost:8080
INSTAGRAM_REDIRECT_URI=http://localhost:8080/instagram/callback

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=instagram_scheduler
DB_USER=postgres
DB_PASSWORD=your_password

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
JWT_EXPIRES_IN=7d

# Encryption Key (for storing Instagram tokens)
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ENCRYPTION_KEY=your_32_byte_hex_encryption_key

# Facebook/Instagram OAuth Configuration
FACEBOOK_APP_ID=your_facebook_app_id
FACEBOOK_APP_SECRET=your_facebook_app_secret
```

---

## API Documentation

### Base URL

```
http://localhost:8080
```

All API endpoints return JSON responses.

---

### Health Check

#### GET /health

Check server health status.

**Headers:**
```
None required
```

**Response:**
```json
{
  "status": "ok"
}
```

**Example:**
```bash
curl http://localhost:8080/health
```

---

## Authentication APIs

### Register User

#### POST /auth/register

Register a new user account.

**Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Request Parameters:**
- `email` (string, required) - Valid email address (must be unique)
- `password` (string, required) - User password (will be hashed)

**Response:**

**Success (201 Created):**
```json
{
  "message": "User registered successfully",
  "user": {
    "id": 1,
    "email": "user@example.com"
  }
}
```

**Error (409 Conflict):**
```json
{
  "error": "User already exists"
}
```

**Error (400 Bad Request):**
```json
{
  "error": "Email and password are required"
}
```

**Example:**
```bash
curl -X POST http://localhost:8080/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "securePassword123"
  }'
```

---

### Login User

#### POST /auth/login

Authenticate user and receive JWT token.

**Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Request Parameters:**
- `email` (string, required) - Registered email address
- `password` (string, required) - User password

**Response:**

**Success (200 OK):**
```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "user@example.com"
  }
}
```

**Error (401 Unauthorized):**
```json
{
  "error": "Invalid credentials"
}
```

**Example:**
```bash
curl -X POST http://localhost:8080/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "securePassword123"
  }'
```

**Note:** Save the `token` from the response. You'll need it for authenticated endpoints using the `Authorization: Bearer <token>` header.

---

## Instagram APIs

Complete Instagram integration documentation with OAuth flow, account connection, and media publishing.

---

### Connect Instagram Account

#### GET /instagram/connect

Get Instagram OAuth authorization URL. This endpoint initiates the Instagram Business Account connection flow.

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
```

**Query Parameters:**
```
None
```

**Response:**

**Success (200 OK):**
```json
{
  "authUrl": "https://www.facebook.com/v24.0/dialog/oauth?client_id=...&redirect_uri=...&scope=..."
}
```

**Error (401 Unauthorized):**
```json
{
  "error": "Access token required"
}
```

**Error (500 Internal Server Error):**
```json
{
  "error": "Failed to generate login URL"
}
```

**Example:**
```bash
curl -X GET http://localhost:8080/instagram/connect \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**OAuth Flow Details:**

1. **Call this endpoint** to get the authorization URL
2. **Redirect user** to the `authUrl` in the response
3. **User authenticates** with Facebook/Instagram
4. **Facebook redirects** to your callback URL with tokens
5. **Frontend extracts tokens** from the redirect URL hash/query params
6. **Send tokens to callback endpoint** (see below)

**OAuth Scopes Requested:**
- `instagram_basic` - Basic Instagram account info
- `instagram_content_publish` - Publish posts to Instagram
- `instagram_manage_comments` - Manage post comments
- `instagram_manage_insights` - Access insights/analytics
- `pages_show_list` - List Facebook Pages
- `pages_read_engagement` - Read Page engagement data

**Important:** The OAuth URL includes:
- `extras` parameter with `IG_API_ONBOARDING` setup channel (required for Instagram API)
- `state` parameter containing the user ID for CSRF protection
- `response_type: token` for implicit flow

---

### Instagram OAuth Callback

#### POST /instagram/callback

Complete the Instagram OAuth flow by storing the access tokens and connecting the Instagram Business Account.

**Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "access_token": "EAAM1wmZAFNSgB...",
  "long_lived_token": "EAAM1wmZAFNSgB...",
  "expires_in": 5184000,
  "state": "1"
}
```

**Request Parameters:**
- `access_token` (string, optional) - Short-lived access token (if using code flow)
- `long_lived_token` (string, required) - Long-lived user access token (60 days)
- `expires_in` (number, required) - Token expiration time in seconds (e.g., 5184000 for 60 days)
- `state` (string, required) - User ID passed from the connect endpoint

**Response:**

**Success (200 OK):**
```json
{
  "message": "Instagram Business account connected",
  "instagramBusinessAccountId": "17841405309211844",
  "pageId": "842013405671706",
  "pageName": "Nova Link",
  "tokenExpiresAt": "2025-02-28T12:00:00.000Z"
}
```

**Error (400 Bad Request):**
```json
{
  "error": "Missing token or state"
}
```

**Error (400 Bad Request):**
```json
{
  "error": "No Facebook Pages found for this user"
}
```

**Error (400 Bad Request):**
```json
{
  "error": "No Instagram Business Account linked to any Page"
}
```

**Error (500 Internal Server Error):**
```json
{
  "error": "Instagram onboarding failed"
}
```

**Example:**
```bash
curl -X POST http://localhost:8080/instagram/callback \
  -H "Content-Type: application/json" \
  -d '{
    "access_token": "EAAM1wmZAFNSgB...",
    "long_lived_token": "EAAM1wmZAFNSgBQUzmfdZAwaaxr9nkuwYXKchZA7TOOwmknCwznH7iXtzVBzf3KKJjW2ZAOtuLVABYitVn5D6bIgyvZC38SlKchorilPBVQD2DjQl338RJIGTMqCg3u4vZAv9GIZBmpZBO44CswxJPBkWODUtFVofUNWkw9dRpLgRdeb6BUSBvHQNZC3yqd8ONM2iZBByoKCIIO",
    "expires_in": 5184000,
    "state": "1"
  }'
```

**Callback Flow:**

1. **Frontend receives redirect** from Facebook OAuth (URL contains `access_token` in hash or query)
2. **Extract tokens** from the redirect URL
3. **Exchange short-lived token** for long-lived token (if needed) using Facebook Graph API:
   ```
   GET https://graph.facebook.com/v24.0/oauth/access_token
     ?grant_type=fb_exchange_token
     &client_id={FACEBOOK_APP_ID}
     &client_secret={FACEBOOK_APP_SECRET}
     &fb_exchange_token={SHORT_LIVED_TOKEN}
   ```
4. **Send tokens to this endpoint** with the user's state (user ID)
5. **Backend automatically:**
   - Fetches user's Facebook Pages
   - Finds Page with Instagram Business Account
   - Retrieves Page access token (for publishing)
   - Encrypts and stores both tokens
   - Links Instagram Business Account to user

**What Gets Stored:**
- `user_access_token_encrypted` - Long-lived user token (encrypted)
- `page_access_token_encrypted` - Page access token for publishing (encrypted)
- `instagram_business_account_id` - Instagram Business Account ID
- `token_expires_at` - Token expiration timestamp

**Database Schema (instagram_accounts table):**
```sql
- id (SERIAL PRIMARY KEY)
- user_id (INTEGER REFERENCES users)
- instagram_business_account_id (VARCHAR)
- user_access_token_encrypted (TEXT)
- page_access_token_encrypted (TEXT)
- token_expires_at (TIMESTAMP)
- created_at, updated_at (TIMESTAMP)
```

---

## Post Management APIs

Complete documentation for creating, listing, and publishing Instagram posts.

---

### Create Post

#### POST /posts

Create a new Instagram post. Supports single images, videos, and carousel posts (up to 10 items).

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

**Request Body:**

**Single Image Post:**
```json
{
  "caption": "Check out this amazing sunset! 🌅",
  "mediaUrl": "https://example.com/image.jpg",
  "publishAt": "2024-12-31T12:00:00Z"
}
```

**Single Video Post:**
```json
{
  "caption": "Watch this amazing video!",
  "mediaUrl": "https://example.com/video.mp4",
  "publishAt": "2024-12-31T12:00:00Z"
}
```

**Carousel Post (Multiple Images):**
```json
{
  "caption": "Carousel post with multiple images 📸",
  "mediaUrl": [
    "https://example.com/image1.jpg",
    "https://example.com/image2.jpg",
    "https://example.com/image3.jpg"
  ],
  "publishAt": "2024-12-31T12:00:00Z"
}
```

**Draft Post (No Publish Time):**
```json
{
  "caption": "This is a draft post",
  "mediaUrl": "https://example.com/image.jpg"
}
```

**Request Parameters:**
- `caption` (string, optional) - Post caption text
- `mediaUrl` (string | array, required) - 
  - **String**: Single media URL (image or video)
  - **Array**: Multiple media URLs for carousel (max 10 items)
- `publishAt` (string, optional) - ISO 8601 timestamp for scheduled publishing (e.g., `"2024-12-31T12:00:00Z"`)
  - If provided: Post status = `SCHEDULED`
  - If omitted: Post status = `DRAFT`

**Response:**

**Success (201 Created):**
```json
{
  "post": {
    "id": 1,
    "user_id": 1,
    "instagram_account_id": 1,
    "caption": "Check out this amazing sunset! 🌅",
    "media_url": "\"https://example.com/image.jpg\"",
    "status": "SCHEDULED",
    "publish_at": "2024-12-31T12:00:00.000Z",
    "published_at": null,
    "instagram_post_id": null,
    "error_message": null,
    "created_at": "2024-01-15T10:30:00.000Z",
    "updated_at": "2024-01-15T10:30:00.000Z"
  }
}
```

**Error (400 Bad Request):**
```json
{
  "error": "Media URL is required"
}
```

**Error (400 Bad Request):**
```json
{
  "error": "No Instagram account connected"
}
```

**Error (401 Unauthorized):**
```json
{
  "error": "Access token required"
}
```

**Error (500 Internal Server Error):**
```json
{
  "error": "Create post failed"
}
```

**Example:**
```bash
curl -X POST http://localhost:8080/posts \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "caption": "Check out this amazing sunset! 🌅",
    "mediaUrl": "https://example.com/image.jpg",
    "publishAt": "2024-12-31T12:00:00Z"
  }'
```

**Post Status Logic:**
- If `publishAt` is provided → Status = `SCHEDULED`
- If `publishAt` is omitted → Status = `DRAFT`

**Media URL Requirements:**
- Must be publicly accessible HTTPS URLs
- Images: `.jpg`, `.jpeg`, `.png` formats supported
- Videos: `.mp4` format supported
- Carousel: Max 10 media items (all must be images)
- Media URLs are stored as JSON string in database

---

### List Posts

#### GET /posts

Retrieve all posts for the authenticated user, ordered by creation date (newest first).

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
```

**Query Parameters:**
```
None
```

**Response:**

**Success (200 OK):**
```json
{
  "posts": [
    {
      "id": 1,
      "caption": "Check out this amazing sunset! 🌅",
      "mediaUrl": ["https://example.com/image.jpg"],
      "status": "SCHEDULED",
      "publish_at": "2024-12-31T12:00:00.000Z",
      "published_at": null,
      "instagram_post_id": null,
      "error_message": null,
      "created_at": "2024-01-15T10:30:00.000Z",
      "updated_at": "2024-01-15T10:30:00.000Z"
    },
    {
      "id": 2,
      "caption": "This is a draft post",
      "mediaUrl": ["https://example.com/draft.jpg"],
      "status": "DRAFT",
      "publish_at": null,
      "published_at": null,
      "instagram_post_id": null,
      "error_message": null,
      "created_at": "2024-01-14T09:15:00.000Z",
      "updated_at": "2024-01-14T09:15:00.000Z"
    },
    {
      "id": 3,
      "caption": "Published post!",
      "mediaUrl": ["https://example.com/published.jpg"],
      "status": "PUBLISHED",
      "publish_at": null,
      "published_at": "2024-01-13T14:20:00.000Z",
      "instagram_post_id": "17841405309211844_1234567890",
      "error_message": null,
      "created_at": "2024-01-13T14:19:00.000Z",
      "updated_at": "2024-01-13T14:20:00.000Z"
    }
  ]
}
```

**Error (401 Unauthorized):**
```json
{
  "error": "Access token required"
}
```

**Error (500 Internal Server Error):**
```json
{
  "error": "Failed to fetch posts"
}
```

**Example:**
```bash
curl -X GET http://localhost:8080/posts \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Response Fields:**
- `id` - Post ID (integer)
- `caption` - Post caption text (string or null)
- `mediaUrl` - Array of media URLs (parsed from JSON)
- `status` - Post status: `DRAFT`, `SCHEDULED`, `PUBLISHED`, or `FAILED`
- `publish_at` - Scheduled publish time (ISO 8601 timestamp or null)
- `published_at` - Actual publish time (ISO 8601 timestamp or null)
- `instagram_post_id` - Instagram post ID after publishing (string or null)
- `error_message` - Error message if publishing failed (string or null)
- `created_at` - Post creation timestamp
- `updated_at` - Last update timestamp

---

### Publish Post Immediately

#### POST /posts/:id/publish

Publish a post to Instagram immediately. This endpoint bypasses the scheduler and publishes the post right away.

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
```

**URL Parameters:**
- `id` (integer, required) - Post ID to publish

**Request Body:**
```
None
```

**Response:**

**Success (200 OK):**
```json
{
  "instagramPostId": "17841405309211844_1234567890"
}
```

**Error (404 Not Found):**
```json
{
  "error": "Post not found"
}
```

**Error (401 Unauthorized):**
```json
{
  "error": "Access token required"
}
```

**Error (500 Internal Server Error):**
```json
{
  "error": "Instagram publishing rate limit exceeded"
}
```

**Error (500 Internal Server Error):**
```json
{
  "error": "Failed to publish post to Instagram"
}
```

**Example:**
```bash
curl -X POST http://localhost:8080/posts/1/publish \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Publishing Flow:**

1. **Validates ownership** - Ensures post belongs to authenticated user
2. **Checks rate limits** - Queries Instagram API for publishing quota usage
3. **Creates media container** - 
   - Single image/video: Creates single container with caption
   - Carousel: Creates individual containers for each media item, then creates carousel container
4. **Publishes container** - Calls Instagram API to publish the media container
5. **Updates database** - Sets status to `PUBLISHED`, stores Instagram post ID, records publish timestamp
6. **Error handling** - On failure, sets status to `FAILED` and stores error message

**Publishing Features:**
- **Rate limit check** - Prevents publishing if quota usage >= 100%
- **Single media support** - Images and videos
- **Carousel support** - Up to 10 images in a carousel post
- **Automatic retry** - Failed posts can be republished by calling this endpoint again
- **Error tracking** - Error messages stored in `error_message` field

**Instagram API Endpoints Used:**
- `GET /{ig-business-account-id}/content_publishing_limit` - Check rate limits
- `POST /{ig-business-account-id}/media` - Create media container
- `POST /{ig-business-account-id}/media_publish` - Publish media container

---

## Post Status

Posts can have the following statuses throughout their lifecycle:

| Status | Description | When Set |
|--------|-------------|----------|
| `DRAFT` | Post created without publish time | When `publishAt` is not provided |
| `SCHEDULED` | Post has a scheduled publish time | When `publishAt` is provided |
| `PUBLISHED` | Post successfully published to Instagram | After successful publishing |
| `FAILED` | Post publishing failed | When publishing encounters an error |

---

## Scheduling

The cron scheduler runs **every 1 minute** and automatically publishes posts that meet the following criteria:

- `status = SCHEDULED`
- `publish_at <= current_time`

**Scheduler Behavior:**
- Processes up to 10 posts per run (to avoid rate limits)
- Publishes posts in chronological order (oldest `publish_at` first)
- Updates post status to `PUBLISHED` on success
- Updates post status to `FAILED` on error and stores error message
- Logs all publishing activities to console

**Scheduler Logs:**
```
⏰ Checking for scheduled posts...
📬 Found 2 post(s) ready to publish
📤 Publishing post 1...
✅ Post 1 published successfully (Instagram ID: 17841405309211844_1234567890)
📤 Publishing post 2...
❌ Failed to publish post 2: Rate limit exceeded
```

---

## Database Schema

### users

Stores user account information.

```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Fields:**
- `id` - Unique user ID (auto-increment)
- `email` - User email address (unique, required)
- `password_hash` - Bcrypt hashed password (required)
- `created_at` - Account creation timestamp
- `updated_at` - Last update timestamp

---

### instagram_accounts

Stores Instagram Business Account connections and encrypted access tokens.

```sql
CREATE TABLE instagram_accounts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  instagram_business_account_id VARCHAR(255) NOT NULL,
  user_access_token_encrypted TEXT NOT NULL,
  page_access_token_encrypted TEXT NOT NULL,
  token_expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, instagram_business_account_id)
);
```

**Fields:**
- `id` - Unique account ID (auto-increment)
- `user_id` - Foreign key to users table (required)
- `instagram_business_account_id` - Instagram Business Account ID (required)
- `user_access_token_encrypted` - Encrypted long-lived user access token (required)
- `page_access_token_encrypted` - Encrypted page access token for publishing (required)
- `token_expires_at` - Token expiration timestamp
- `created_at` - Connection creation timestamp
- `updated_at` - Last update timestamp

**Indexes:**
- `idx_instagram_accounts_user_id` - Index on `user_id` for faster queries

**Constraints:**
- Unique constraint on `(user_id, instagram_business_account_id)` to prevent duplicate connections

---

### posts

Stores Instagram post drafts, scheduled posts, and published post metadata.

```sql
CREATE TABLE posts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  instagram_account_id INTEGER REFERENCES instagram_accounts(id) ON DELETE SET NULL,
  caption TEXT,
  media_url TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
  publish_at TIMESTAMP,
  published_at TIMESTAMP,
  instagram_post_id VARCHAR(255),
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Fields:**
- `id` - Unique post ID (auto-increment)
- `user_id` - Foreign key to users table (required)
- `instagram_account_id` - Foreign key to instagram_accounts table (nullable)
- `caption` - Post caption text (nullable)
- `media_url` - JSON string of media URLs (required) - Single URL or array of URLs
- `status` - Post status: `DRAFT`, `SCHEDULED`, `PUBLISHED`, or `FAILED` (default: `DRAFT`)
- `publish_at` - Scheduled publish timestamp (nullable)
- `published_at` - Actual publish timestamp (nullable)
- `instagram_post_id` - Instagram post ID after publishing (nullable)
- `error_message` - Error message if publishing failed (nullable)
- `created_at` - Post creation timestamp
- `updated_at` - Last update timestamp

**Indexes:**
- `idx_posts_user_id` - Index on `user_id` for faster user queries
- `idx_posts_status` - Index on `status` for scheduler queries
- `idx_posts_publish_at` - Index on `publish_at` for scheduler queries

**Constraints:**
- Foreign key to `users` table with `ON DELETE CASCADE` (posts deleted when user deleted)
- Foreign key to `instagram_accounts` table with `ON DELETE SET NULL` (posts preserved if account disconnected)

---

## Security Features

### Password Security
- **Bcrypt hashing** - Passwords are hashed with bcrypt (10 salt rounds)
- **No plaintext storage** - Passwords never stored in plaintext

### Token Security
- **JWT tokens** - Secure JSON Web Tokens for authentication
- **Configurable expiration** - Token expiration set via `JWT_EXPIRES_IN` (default: 7 days)
- **Token verification** - All protected routes verify token signature and expiration

### Instagram Token Security
- **AES-256-CBC encryption** - Instagram access tokens encrypted before storage
- **Encryption key** - Stored in environment variable, never in code
- **Encrypted storage** - Both user and page tokens stored encrypted in database

### API Security
- **Protected routes** - Authentication middleware protects sensitive endpoints
- **User verification** - All operations verify user ownership
- **CSRF protection** - State parameter in OAuth flow prevents CSRF attacks
- **Input validation** - Request validation prevents malformed data

### Error Handling
- **No sensitive data leakage** - Error messages don't expose internal details
- **Secure logging** - Sensitive data excluded from logs
- **Graceful failures** - Errors handled gracefully without crashing server

---

## Development

### Running the Server

```bash
# Development mode (with nodemon auto-reload)
npm run dev

# Production mode
npm start
```

### Project Structure

```
prototype-backend/
├── config/
│   ├── database.js          # PostgreSQL connection pool
│   └── constants.js         # Post status enums
├── controllers/
│   ├── authController.js    # Authentication logic
│   ├── instagramController.js # Instagram OAuth & connection
│   └── postController.js    # Post CRUD & publishing
├── middlewares/
│   └── auth.js              # JWT authentication middleware
├── models/
│   ├── schema.sql           # Database schema
│   └── initDatabase.js      # Schema initialization
├── routes/
│   ├── authRoutes.js        # Authentication routes
│   ├── instagramRoutes.js   # Instagram routes
│   └── postRoutes.js        # Post routes
├── services/
│   ├── instagramService.js  # Instagram API integration
│   └── schedulerService.js  # Cron-based scheduler
├── utils/
│   └── encryption.js        # Token encryption/decryption
├── index.js                 # Main server file
├── package.json
└── README.md
```

### API Testing

Use tools like **Postman**, **curl**, or **Thunder Client** to test the API endpoints.

**Example Test Flow:**
1. Register a user: `POST /auth/register`
2. Login: `POST /auth/login` (save the token)
3. Connect Instagram: `GET /instagram/connect` (redirect user to authUrl)
4. Complete OAuth: `POST /instagram/callback` (after user authentication)
5. Create post: `POST /posts`
6. List posts: `GET /posts`
7. Publish post: `POST /posts/:id/publish`

### Debugging

Enable detailed logging by checking console output:
- Database connection status
- OAuth flow progress
- Publishing status and errors
- Scheduler activity

### Troubleshooting

**Database Connection Issues:**
- Verify PostgreSQL is running
- Check database credentials in `.env`
- Ensure database exists

**Instagram OAuth Issues:**
- Verify Facebook App ID and Secret in `.env`
- Check redirect URI matches Facebook App settings
- Ensure Instagram Business Account is linked to Facebook Page

**Publishing Issues:**
- Check Instagram Business Account is connected
- Verify media URLs are publicly accessible
- Check rate limits (Instagram has daily publishing limits)
- Review error messages in post `error_message` field

---

## License

ISC

---

## Support

For issues and questions, please open an issue in the repository.
