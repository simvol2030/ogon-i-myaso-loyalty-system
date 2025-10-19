# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Project Box v2** is a monorepo containing a full-stack content management system with two independent applications:

1. **Backend** (`backend-expressjs/`): Express.js REST API with JWT authentication
2. **Frontend** (`frontend-sveltekit/`): SvelteKit web application with session-based authentication

Both applications share the same SQLite database located at `data/db/sqlite/app.db`, but implement different authentication mechanisms (JWT vs. session cookies).

## Monorepo Structure

```
project-box-v2/
├── backend-expressjs/     # Express.js REST API (port 3000)
├── frontend-sveltekit/    # SvelteKit web app (port 5173)
├── data/                  # Shared data directory
│   ├── db/sqlite/        # SQLite database (app.db)
│   ├── logs/             # Application logs
│   └── media/            # User-uploaded media files
├── config/               # Empty - reserved for shared config
├── docker/               # Empty - reserved for Docker setup
├── docs/                 # Empty - reserved for documentation
├── infra/                # Empty - reserved for infrastructure
├── libs/                 # Empty - reserved for shared libraries
├── makefile/             # Empty - reserved for make targets
├── scripts/              # Empty - reserved for automation scripts
└── tests/                # Empty - reserved for integration tests
```

## Quick Start

Both applications must be run independently:

```bash
# Terminal 1: Start backend API
cd backend-expressjs
npm install
npm run dev         # Runs on http://localhost:3000

# Terminal 2: Start frontend
cd frontend-sveltekit
npm install
npm run dev         # Runs on http://localhost:5173
```

## Shared Database Architecture

Both applications use the same SQLite database with three tables:

- **`users`**: Public users (no passwords, read-only in frontend)
- **`posts`**: Blog posts linked to users
- **`admins`**: Admin accounts with passwords and roles

**Critical Note**: The backend and frontend have different password handling:
- **Backend**: Stores plain text passwords (security vulnerability)
- **Frontend**: Uses bcrypt hashing (secure)

This means admin accounts created through the backend API won't work with the frontend login, and vice versa.

## Authentication Approaches

### Backend (REST API)
- **Method**: JWT tokens with Bearer authentication
- **Flow**: POST `/api/auth/login` → Receive token → Include `Authorization: Bearer <token>` header
- **Token Expiry**: 7 days
- **CORS**: Configured for `http://localhost:5173`

### Frontend (SvelteKit)
- **Method**: Encrypted session cookies (AES-256-GCM)
- **Flow**: POST to `/login` → Session cookie set → Automatic validation on protected routes
- **Security Layers**:
  - CSRF protection on all mutating requests
  - Rate limiting on login attempts
  - Security headers (CSP, HSTS, X-Frame-Options)
  - Input validation for SQL injection and XSS

## Role-Based Access Control

Both applications implement the same three admin roles:

- **super-admin**: Full CRUD access to all resources
- **editor**: Can create/update users and posts, read everything
- **viewer**: Read-only access to all resources

Role checks are implemented differently in each app:
- **Backend**: `requireRole()` middleware in Express routes
- **Frontend**: `requireRole()` helper in SvelteKit load functions

## Key Architectural Decisions

1. **Monorepo without Workspace**: Each app has its own `node_modules/` and runs independently
2. **Dual Authentication**: Backend and frontend use different auth methods despite sharing a database
3. **Relative Database Path**: Both apps use relative paths (`../data/db/sqlite/app.db` or `../../../data/db/sqlite/app.db`)
4. **No Shared Code**: No shared TypeScript libraries between frontend/backend (separate implementations)
5. **Development-Oriented**: Many directories (config/, docker/, infra/) exist but are currently empty

## Development Workflow

### Working on Backend Only
```bash
cd backend-expressjs
npm run dev          # Hot reload with nodemon + tsx
npm run build        # Compile TypeScript
npm run start        # Run production build
```

See `backend-expressjs/CLAUDE.md` for detailed backend architecture.

### Working on Frontend Only
```bash
cd frontend-sveltekit
npm run dev          # Vite dev server
npm run build        # Production build
npm run preview      # Preview production build
npm run check        # Type checking
npm run lint         # Prettier + ESLint
npm run format       # Auto-format code
```

See `frontend-sveltekit/CLAUDE.md` for detailed frontend architecture.

## Common Tasks

### Adding a New Database Table

1. Update schema in **both** applications:
   - `backend-expressjs/src/db/database.ts`
   - `frontend-sveltekit/src/lib/server/db/database.ts`
2. Add CREATE TABLE statement to `initializeDatabase()` function
3. Define TypeScript interfaces for type safety
4. Create prepared statements in the `queries` object

### Adding a New API Endpoint (Backend)

1. Create route handler in `backend-expressjs/src/routes/`
2. Apply authentication middleware: `authenticateToken`
3. Apply role-based middleware: `requireRole('super-admin', 'editor')`
4. Use prepared statements from `database.ts` for queries
5. Update CORS settings if frontend needs to access it

### Adding a New Protected Page (Frontend)

1. Create page under `frontend-sveltekit/src/routes/(admin)/`
2. Page automatically inherits authentication protection from layout
3. Access user data via `data.user` from parent `+layout.server.ts`
4. Include CSRF token in all forms using `<CsrfToken />` component
5. Validate inputs using validators from `validation.ts`

### Database Migration

No formal migration system exists yet. Current approach:
1. Delete `data/db/sqlite/app.db`
2. Restart applications (auto-creates schema)
3. Default admin is seeded automatically

For production, implement a migration strategy before deployment.

## Environment Configuration

### Backend Environment Variables

Create `backend-expressjs/.env`:
```
PORT=3000
JWT_SECRET=your-secret-key-here
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=admin123
NODE_ENV=development
```

### Frontend Environment Variables

Create `frontend-sveltekit/.env` (see `.env.example`):
```
SESSION_SECRET=base64-encoded-secret-here
NODE_ENV=development
```

Generate session secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## Security Considerations

**Backend Security Issues**:
- Plain text password storage (needs bcrypt/argon2)
- CORS locked to localhost (needs production domain)
- No input validation (vulnerable to injection)
- No rate limiting

**Frontend Security Strengths**:
- Bcrypt password hashing
- CSRF protection on all mutations
- Rate limiting on login
- Input validation for SQL injection and XSS
- Security headers (CSP, HSTS, X-Frame-Options)
- Encrypted session cookies

**Recommendation**: Use the frontend's security patterns as the reference implementation. Consider deprecating the backend's authentication in favor of a unified approach.

## Testing

No test suites are currently implemented. The `tests/` directory is empty.

To add testing:
1. Create integration tests in `tests/` for cross-app workflows
2. Add unit tests in each app's directory
3. Consider test commands: `npm test` at root level

## Deployment Notes

Neither application is production-ready yet:

1. **Security**: Backend passwords must be hashed
2. **CORS**: Update backend to allow production frontend domain
3. **Database**: Consider PostgreSQL for production (SQLite not ideal for concurrent writes)
4. **Session Store**: Frontend rate limiting uses in-memory store (use Redis for clustering)
5. **Environment Variables**: All secrets must be properly managed
6. **HSTS**: Frontend only enables HSTS in production mode
7. **Database Path**: Ensure `data/` directory exists in production environment

## Future Architecture Considerations

The monorepo structure suggests future expansion:
- `libs/`: Shared TypeScript utilities
- `docker/`: Docker Compose setup for easy deployment
- `config/`: Shared configuration files
- `infra/`: Terraform or infrastructure-as-code
- `makefile/`: Automation targets for common tasks
- `scripts/`: Database migrations, seed scripts, CI/CD helpers
