# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a SvelteKit 2.x application with a security-focused architecture. It uses SQLite (better-sqlite3) for data persistence and includes:
- Full admin authentication system with role-based access control
- **Cashier POS Interface** - Desktop-optimized loyalty program interface with virtual keyboard support

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

## Cashier POS Interface

### Overview

The cashier interface (`src/routes/cashier/`) is a **desktop-optimized POS system** for loyalty program management. It provides a streamlined workflow for cashiers to scan customer cards, enter transaction amounts, and earn/redeem loyalty points.

**Key characteristics**:
- Full viewport, no scrolling (1030px min width + 230px extra = 1260px total)
- Standalone layout (no header/footer)
- Virtual keyboard support for touchscreen/kiosk environments
- Business rules: 4% cashback on purchases, 20% max discount with points

### Development Commands

```bash
# Run cashier interface in dev mode
npm run dev
# Then navigate to: http://localhost:5173/cashier

# Type check cashier components
npm run check

# Test with mock data
# Use quick-test buttons: 421856, 789012, 654321
```

### Route Structure

```
src/routes/cashier/
├── +layout.svelte          # Standalone layout (no header/footer)
├── +page.svelte            # Main cashier UI (162 lines)
├── +page.ts                # Page loader with store config
└── components/
    ├── CustomerSearch.svelte      # Screen 1: QR/Card search with autosearch
    ├── VirtualKeyboard.svelte     # Reusable keyboard (dual-mode)
    ├── CheckAmountInput.svelte    # Screen 2: Amount entry with keyboard
    ├── CustomerInfo.svelte        # Customer balance display
    ├── RedeemChoice.svelte        # Screen 3: Redeem vs Accumulate choice
    ├── CheckSummary.svelte        # Transaction summary
    ├── TransactionButtons.svelte  # Complete/Cancel buttons
    ├── TransactionStatus.svelte   # Success/Error/Processing states
    └── RecentTransactions.svelte  # Recent activity list
```

### Virtual Keyboard Component Pattern

**File**: `src/routes/cashier/components/VirtualKeyboard.svelte` (289 lines)

**Usage**: The VirtualKeyboard is a reusable component with **dual-mode** support:

#### Mode 1: Numbers (6 digits for card numbers)
```svelte
<VirtualKeyboard
    value={cardNumber}
    onInput={handleInput}
    isOpen={isKeyboardOpen}
    onClose={closeKeyboard}
    type="numbers"
/>
```
- Max length: 6 digits
- Display: `------` placeholder
- Buttons: 0-9, ⌫ (backspace), C (clear)

#### Mode 2: Decimal (amounts with currency)
```svelte
<VirtualKeyboard
    value={amount}
    onInput={handleInput}
    isOpen={isKeyboardOpen}
    onClose={closeKeyboard}
    type="decimal"
    onEnter={handleSubmit}
/>
```
- Max length: 10 characters (including decimal point)
- Display: `0.00 ₽` placeholder with currency symbol
- Buttons: 0-9, . (decimal), ⌫, C, ✓ Готово (Enter, spans 2 columns)

**Key features**:
- Full-screen modal overlay with backdrop blur
- Animated entrance (fadeIn + slideUp)
- Touch-optimized button sizes (64px height)
- Gradient backgrounds matching POS theme
- Automatic 6-digit detection with 1-second autosearch delay

### UI State Machine

The cashier interface uses a state machine with 6 states:

```typescript
type UIState = 'idle' | 'customer_found' | 'ready' | 'processing' | 'success' | 'error';
```

**State flow**:
1. `idle` → Customer search screen with QR input + virtual keyboard
2. `customer_found` → Show customer info + check amount input
3. `ready` → Show redeem choice + transaction summary
4. `processing` → Loading state during API call
5. `success` → Success message (auto-resets after 3 seconds)
6. `error` → Error message with retry button

### Business Logic

**Location**: Implemented in `+page.svelte` using Svelte 5 `$derived` runes

```typescript
// Cashback calculation (4% of purchase)
let cashbackAmount = $derived(() => {
    return Math.floor(checkAmount * 0.04);  // 4% rounded down
});

// Max redeem calculation (20% of purchase OR customer balance, whichever is lower)
let maxRedeemPoints = $derived(() => {
    if (!customer || checkAmount === 0) return 0;
    const maxByPercent = Math.floor(checkAmount * 0.20);  // 20% max discount
    const maxByBalance = customer.balance;
    return Math.min(maxByPercent, maxByBalance);
});

// Points to redeem (depends on user choice)
let pointsToRedeem = $derived(() => {
    return isRedeemSelected ? maxRedeemPoints() : 0;
});

// Final amount customer pays
let finalAmount = $derived(() => {
    return Math.max(0, checkAmount - pointsToRedeem());
});
```

**Key rules**:
- 1 point = 1 ruble
- Earn: 4% of purchase amount (rounded down)
- Redeem: Maximum 20% discount, limited by customer balance
- Customer can choose: "Списать" (redeem) or "Начислить" (accumulate only)

### Mock API

**Location**: `src/lib/api/cashier.ts`

**Available functions**:
```typescript
// Find customer by QR code (format: 99 + 6 digits, e.g., "99421856")
async function findCustomer(qrCode: string, storeId: number): Promise<Customer | null>

// Create earn/redeem transaction
async function createTransaction(params: {
    customer: Customer,
    storeId: number,
    checkAmount: number,
    pointsToRedeem: number,
    cashbackAmount: number,
    finalAmount: number
}): Promise<{ success: boolean }>

// Get recent transactions for store
async function getRecentTransactions(storeId: number): Promise<Transaction[]>
```

**Mock data**: Three test customers with balances 2500, 800, 150 (QR codes: 421856, 789012, 654321)

### Layout Specifications

**Container sizing** (`+page.svelte` styles):
```css
.app-container {
    width: calc(100vw + 230px);  /* Extra 230px for wider interface */
    min-width: 1030px;            /* Minimum width requirement */
    height: 100vh;                /* Full viewport height */
    overflow: hidden;             /* No scrolling */
}

.header {
    height: 44px;                 /* Fixed header height */
}

.content {
    flex: 1;                      /* Remaining space */
    overflow-y: auto;             /* Scrollable content area */
    padding: 20px;
}
```

**Reason for 230px extra**: Allows full text "Клавиатура" to fit on buttons without wrapping.

### Component Patterns

#### Autosearch Pattern (CustomerSearch.svelte)

```typescript
let autoSearchTimer: number | null = null;

function handleInput(e: Event) {
    const newValue = (e.currentTarget as HTMLInputElement).value;
    onInput(newValue);

    // Clear previous timer
    if (autoSearchTimer) {
        clearTimeout(autoSearchTimer);
        autoSearchTimer = null;
    }

    // Auto-search after 1 second if 6 digits entered
    if (newValue.length === 6 && /^\d{6}$/.test(newValue)) {
        autoSearchTimer = setTimeout(() => {
            onSearch();
        }, 1000) as unknown as number;
    }
}
```

**Benefits**: Reduces clicks, works with barcode scanners, still allows manual search button.

#### Button Grid Pattern

Used in `CustomerSearch.svelte`, `CheckAmountInput.svelte`, and `RedeemChoice.svelte`:

```svelte
<div class="button-group">
    <button class="btn btn-primary">Primary Action</button>
    <button class="btn btn-secondary">🔢 Клавиатура</button>
</div>

<style>
    .button-group {
        display: grid;
        grid-template-columns: 2fr 1fr;  /* Primary button 2x wider */
        gap: 8px;
    }
</style>
```

#### Choice Pattern (RedeemChoice.svelte)

Two side-by-side selection buttons with visual feedback:

```svelte
<button class="choice-btn" class:selected={isRedeemSelected}>
    <div class="choice-title">💳 СПИСАТЬ</div>
    <div class="choice-details">
        <div>Списание: -{maxRedeemPoints} ₽</div>
        <div>Начисление: +{cashbackAmount} ₽</div>
        <div>Новый баланс: {newBalance} ₽</div>
    </div>
</button>
```

**Selected state**: Gradient background, glowing border, increased shadow.

### CSS Variables (Theme)

All cashier components use these CSS variables defined in `+page.svelte`:

```css
:global(:root) {
    --bg-primary: #0f172a;          /* Dark blue background */
    --bg-secondary: #1e293b;        /* Lighter blue for cards */
    --bg-header: #334155;           /* Header background */
    --text-primary: #f8fafc;        /* White text */
    --text-secondary: #cbd5e1;      /* Gray text */
    --accent: #10b981;              /* Green (primary action) */
    --accent-hover: #059669;        /* Darker green */
    --accent-light: #34d399;        /* Light green */
    --primary: #3b82f6;             /* Blue (secondary action) */
    --primary-hover: #2563eb;       /* Darker blue */
    --danger: #ef4444;              /* Red (errors) */
    --warning: #f59e0b;             /* Orange (warnings) */
    --success: #22c55e;             /* Green (success) */
    --border: #475569;              /* Border color */
    --glow-accent: rgba(16, 185, 129, 0.3);   /* Green glow */
    --glow-primary: rgba(59, 130, 246, 0.3);  /* Blue glow */
}
```

### Accessibility Features

- Mobile-optimized input attributes: `inputmode="numeric"` and `pattern="[0-9]*"`
- Fallback text for missing customer names: `{customer.name || 'Без имени'}`
- Large touch targets (60px min height for buttons, 64px for keyboard keys)
- Clear visual feedback for all states (loading, success, error)
- Keyboard-friendly (Enter key triggers search/submit)

### Common Development Tasks

#### Adding a new input field with virtual keyboard

1. Import VirtualKeyboard component
2. Add state variables:
```typescript
let inputValue = $state('');
let isKeyboardOpen = $state(false);
```

3. Create handler functions:
```typescript
function openVirtualKeyboard() {
    isKeyboardOpen = true;
}

function closeVirtualKeyboard() {
    isKeyboardOpen = false;
}

function handleKeyboardInput(newValue: string) {
    inputValue = newValue;
}
```

4. Render keyboard:
```svelte
<VirtualKeyboard
    value={inputValue}
    onInput={handleKeyboardInput}
    isOpen={isKeyboardOpen}
    onClose={closeVirtualKeyboard}
    type="decimal"  // or "numbers"
    onEnter={handleSubmit}  // optional for decimal mode
/>
```

#### Modifying business logic percentages

Edit the `$derived` runes in `+page.svelte`:

```typescript
// Change cashback from 4% to 5%
let cashbackAmount = $derived(() => {
    return Math.floor(checkAmount * 0.05);  // Changed from 0.04
});

// Change max discount from 20% to 30%
let maxRedeemPoints = $derived(() => {
    const maxByPercent = Math.floor(checkAmount * 0.30);  // Changed from 0.20
    // ...
});
```

#### Testing with different customer balances

Edit `src/lib/data/cashier-mocks.ts`:

```typescript
export const MOCK_CUSTOMERS: Customer[] = [
    {
        id: 1,
        card_number: '421856',
        qr_code: '99421856',
        name: 'Иван Петров',
        balance: 5000,  // Change balance here
        created_at: '2024-01-15'
    },
    // ...
];
```

### Integration with Backend (Future)

When connecting to real backend API, replace mock calls in `+page.svelte`:

**Current mock**:
```typescript
const foundCustomer = await findCustomer(qrInput, data.storeId);
```

**Future backend**:
```typescript
const response = await fetch(`/api/cashier/customers/${qrInput}?store=${data.storeId}`);
const foundCustomer = response.ok ? await response.json() : null;
```

Similar replacements needed for `createTransaction()` and `getRecentTransactions()`.

### Electron Wrapper (Production Deployment)

The cashier interface is designed to run inside an Electron wrapper for POS hardware deployment. See `/cashier-electron/` directory for:

- `electron.js` - Main process with window configuration
- Window specs: 1/3 screen width × 1/3 screen height, bottom-left corner, always-on-top
- Store-specific configs in `/configs/.env.store1` through `.env.store6`
- Multi-store build scripts: `npm run package:store1` through `package:store6`

**Production deployment guide**: See `/cashier-electron/configs/DEPLOYMENT_GUIDE.md`

## Deployment

- Uses `@sveltejs/adapter-node` for Node.js deployment
- Set `NODE_ENV=production` for production
- Ensure `SESSION_SECRET` is set to a secure random value
- Database path is relative (`../data/db/sqlite/app.db`), ensure parent directory exists
- Security headers include HSTS only in production
