# Instagram Post Scheduler Backend

A Node.js/Express backend for scheduling and publishing Instagram posts.

## Features

- ✅ User authentication (JWT-based)
- ✅ Instagram OAuth integration
- ✅ Post creation and management
- ✅ Scheduled post publishing (cron-based)
- ✅ Direct post publishing
- ✅ Encrypted token storage

## Prerequisites

- Node.js (v14+)
- PostgreSQL (v12+)
- Facebook App with Instagram Basic Display API access

## Installation

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file in the root directory with the following variables:

```env
# Server Configuration
PORT=3000
BACKEND_URL=http://localhost:3000

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

3. Create the PostgreSQL database:
```bash
createdb instagram_scheduler
```

4. Start the server:
```bash
npm run dev
```

The server will automatically:
- Connect to PostgreSQL
- Initialize the database schema
- Start the cron scheduler (runs every 1 minute)

## API Endpoints

### Health Check
- `GET /health` - Returns `{ "status": "ok" }`

### Authentication
- `POST /auth/register` - Register a new user
  ```json
  {
    "email": "user@example.com",
    "password": "password123"
  }
  ```

- `POST /auth/login` - Login user
  ```json
  {
    "email": "user@example.com",
    "password": "password123"
  }
  ```
  Returns: `{ "token": "...", "user": {...} }`

### Instagram Integration
- `GET /instagram/connect` - Get Instagram OAuth URL (requires auth)
  Returns: `{ "authUrl": "..." }`

- `GET /instagram/callback` - OAuth callback handler

### Posts
- `POST /posts` - Create a new post (requires auth)
  ```json
  {
    "caption": "My post caption",
    "mediaUrl": "https://example.com/image.jpg",
    "publishAt": "2024-12-31T12:00:00Z" // Optional
  }
  ```

- `GET /posts` - List all posts for logged-in user (requires auth)

- `POST /posts/:id/publish` - Publish a post immediately (requires auth)

## Post Status

Posts can have the following statuses:
- `DRAFT` - Post created without publish time
- `SCHEDULED` - Post has a `publishAt` time set
- `PUBLISHED` - Post successfully published to Instagram
- `FAILED` - Post publishing failed (error stored in `error_message`)

## Scheduling

The cron scheduler runs every 1 minute and automatically publishes posts where:
- `status = SCHEDULED`
- `publish_at <= current_time`

Failed posts are marked with `status = FAILED` and the error message is stored.

## Database Schema

### users
- `id` (SERIAL PRIMARY KEY)
- `email` (VARCHAR UNIQUE)
- `password_hash` (VARCHAR)
- `created_at`, `updated_at` (TIMESTAMP)

### instagram_accounts
- `id` (SERIAL PRIMARY KEY)
- `user_id` (INTEGER REFERENCES users)
- `instagram_business_account_id` (VARCHAR)
- `access_token_encrypted` (TEXT)
- `token_expires_at` (TIMESTAMP)
- `created_at`, `updated_at` (TIMESTAMP)

### posts
- `id` (SERIAL PRIMARY KEY)
- `user_id` (INTEGER REFERENCES users)
- `instagram_account_id` (INTEGER REFERENCES instagram_accounts)
- `caption` (TEXT)
- `media_url` (TEXT)
- `status` (VARCHAR) - DRAFT, SCHEDULED, PUBLISHED, FAILED
- `publish_at` (TIMESTAMP)
- `published_at` (TIMESTAMP)
- `instagram_post_id` (VARCHAR)
- `error_message` (TEXT)
- `created_at`, `updated_at` (TIMESTAMP)

## Security Features

- Password hashing with bcrypt
- JWT token authentication
- Encrypted Instagram access tokens
- Protected routes with authentication middleware

## Development

```bash
# Run in development mode (with nodemon)
npm run dev

# Run in production mode
npm start
```

