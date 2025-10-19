# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a SvelteKit 2.x application with a security-focused architecture. It uses SQLite (better-sqlite3) for data persistence and includes a full admin authentication system with role-based access control.

## Development Commands

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Type checking
npm run check

# Type checking in watch mode
npm run check:watch

# Linting and formatting
npm run lint        # Check both prettier and eslint
npm run format      # Auto-format all files with prettier
```

## Architecture

### Security-First Design

This application implements multiple layers of security controls that must be maintained:

1. **Hook Chain** (`src/hooks.server.ts`): Three sequential hooks run on every request:
   - Request logging (development only)
   - Security headers (CSP, X-Frame-Options, HSTS, etc.)
   - CSRF protection (token generation and validation)

2. **Session Management** (`src/lib/server/auth/session.ts`):
   - Uses encrypted cookies via AES-256-GCM (`crypto.ts`)
   - Requires `SESSION_SECRET` environment variable (see `.env.example`)
   - Session validation checks age and decryption integrity
   - Helper functions: `getSession()`, `createSession()`, `destroySession()`, `requireAuth()`, `requireRole()`

3. **Rate Limiting** (`src/lib/server/rate-limit.ts`):
   - In-memory store (consider Redis for production clustering)
   - Configurable window/max attempts/block duration
   - Used for login brute-force protection
   - Must call `resetRateLimit()` on successful auth to clear counter

4. **Input Validation** (`src/lib/server/validation.ts`):
   - Dedicated validators for email, password, name, ID, role, title, content
   - Checks for SQL injection patterns and XSS attempts
   - Password requirements: 12+ chars, 3 of 4 character types

### Database Layer

**Path**: Shared database at `../data/db/sqlite/app.db` (one level up from frontend)

**Schema** (`src/lib/server/db/database.ts`):
- `users`: Public users (id, name, email, created_at)
- `posts`: Blog posts (id, user_id, title, content, published, created_at)
- `admins`: Admin accounts with bcrypt passwords (id, email, password, role, name, created_at)

**Roles**: `super-admin`, `editor`, `viewer`

**Prepared Statements**: All queries use prepared statements via the `queries` export for SQL injection prevention and performance.

**Initialization**: Database tables are created and seeded automatically on app startup. Default admin: `admin@example.com` / `admin123`.

### Route Groups

**Public Routes** (`src/routes/`):
- `+page.svelte`: Homepage displaying users/posts

**Admin Routes** (`src/routes/(admin)/`):
- Protected by layout load function in `(admin)/+layout.server.ts`
- Redirects to `/login` if not authenticated
- All pages receive `user` and `csrfToken` in load data
- Available pages: `/dashboard`, `/users`, `/posts`, `/settings`, `/login`, `/logout`

### CSRF Protection

- Generated on GET requests, stored in httpOnly cookie
- Must be included in POST/PUT/DELETE/PATCH as:
  - Header: `x-csrf-token`
  - Form field: `csrf_token`
- Login endpoint is exempted (special case, no token yet)
- Use `CsrfToken.svelte` component in forms to include hidden field

### Component Structure

- `src/lib/components/`: Reusable Svelte components (UserList, PostList, FeatureList, CsrfToken)
- Components use Svelte 5 syntax and runes

## Important Development Notes

### Security Considerations

- **Never disable security hooks**: The hook chain in `hooks.server.ts` must remain intact
- **Always use prepared statements**: Use the `queries` object from `database.ts`, never string concatenation
- **Always validate input**: Use validators from `validation.ts` before database operations
- **Always check CSRF**: Include CSRF token in all mutating requests
- **Session encryption required**: `SESSION_SECRET` must be set in production (generate with `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`)

### Working with Auth

When adding new protected routes:
1. Place under `(admin)/` route group to inherit auth protection
2. Access user via `data.user` from layout
3. Check roles with `hasRole()` or `requireRole()` helpers

When adding new form actions:
1. Always include CSRF token validation
2. Apply rate limiting for sensitive operations
3. Use validation functions for all inputs
4. Return `fail()` with 400/401/429 status codes for errors

### Database Modifications

- Schema changes: Update both `CREATE TABLE` and TypeScript interfaces in `database.ts`
- New queries: Add to `queries` object as prepared statements
- Migrations: Currently auto-creates tables; add migration logic if schema changes needed for existing data

## Deployment

- Uses `@sveltejs/adapter-node` for Node.js deployment
- Set `NODE_ENV=production` for production
- Ensure `SESSION_SECRET` is set to a secure random value
- Database path is relative (`../data/db/sqlite/app.db`), ensure parent directory exists
- Security headers include HSTS only in production
