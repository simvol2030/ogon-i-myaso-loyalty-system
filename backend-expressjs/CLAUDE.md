# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an Express.js REST API backend for "Project Box v2" - a content management system with user and post management. The API uses SQLite with better-sqlite3 for data persistence, JWT for authentication, and implements role-based access control.

## Development Commands

```bash
# Start development server with hot reload
npm run dev

# Build TypeScript to JavaScript
npm run build

# Start production server (must build first)
npm run start
```

## Architecture

### Database Layer (`src/db/database.ts`)

- Uses **better-sqlite3** with WAL mode for concurrent read/write performance
- Database file location: `../../../data/db/sqlite/app.db` (shared across project)
- Three main tables: `users`, `posts`, `admins`
- Database initialization happens on server startup via `initializeDatabase()`
- Default super-admin is created automatically if no admins exist (credentials from .env)

**Important**: Passwords are stored in plain text (not hashed) - this is a security vulnerability in the current implementation.

### Authentication System (`src/middleware/auth.ts`)

- JWT-based authentication with Bearer tokens
- Token expiry: 7 days
- JWT_SECRET configurable via environment variable
- Two middleware functions:
  - `authenticateToken`: Validates JWT and attaches user to request
  - `requireRole(...roles)`: Checks if authenticated user has required role
- Extended `AuthRequest` interface adds `user` property to Express Request

### Role Hierarchy

Three admin roles with different permissions:
- **super-admin**: Full access (CRUD on all resources)
- **editor**: Can create/update users and posts, read everything
- **viewer**: Read-only access to all resources

### API Routes

All API routes are prefixed with `/api`:

**Authentication** (`/api/auth`):
- POST `/login` - Login with email/password, returns JWT token
- GET `/me` - Get current user info from token

**Users** (`/api/users`) - All routes require authentication:
- GET `/` - List all users
- GET `/:id` - Get single user
- POST `/` - Create user (editor/super-admin only)
- PUT `/:id` - Update user (editor/super-admin only)
- DELETE `/:id` - Delete user (super-admin only)

**Posts** (`/api/posts`) - All routes require authentication:
- GET `/` - List all posts with author info
- GET `/:id` - Get single post with author info
- POST `/` - Create post (editor/super-admin only)
- PUT `/:id` - Update post (editor/super-admin only)
- DELETE `/:id` - Delete post (super-admin only)

### Application Entry (`src/index.ts`)

- Express server with CORS enabled for `http://localhost:5173` (SvelteKit frontend)
- Credentials enabled in CORS for cookie/auth header support
- Database initialized before routes are registered
- 404 handler for undefined endpoints
- Root endpoint (`/`) returns API documentation

## Environment Configuration

Required variables in `.env`:
- `PORT` - Server port (default: 3000)
- `JWT_SECRET` - Secret key for JWT signing
- `ADMIN_EMAIL` - Default super-admin email
- `ADMIN_PASSWORD` - Default super-admin password
- `NODE_ENV` - Environment (development/production)

## TypeScript Configuration

- Target: ES2020
- Module: CommonJS
- Strict mode enabled
- Output directory: `./dist`
- Source directory: `./src`

## Testing Authentication

To test endpoints requiring authentication:
1. POST to `/api/auth/login` with `{ "email": "admin@example.com", "password": "admin123" }`
2. Extract `token` from response
3. Include header: `Authorization: Bearer <token>` in subsequent requests

## Key Design Decisions

1. **Shared Database**: Database is stored in a parent directory (`../../../data/db/sqlite/app.db`), suggesting this backend is part of a larger monorepo structure
2. **No Password Hashing**: Current implementation stores plain text passwords - should use bcrypt/argon2 for production
3. **Synchronous SQLite**: Uses better-sqlite3 (synchronous) rather than async driver - suitable for Express's synchronous route handlers
4. **Direct SQL Queries**: No ORM used, raw SQL with prepared statements for security and performance
5. **Frontend-Specific CORS**: CORS locked to localhost:5173, needs adjustment for production deployment
