/**
 * Rate limiting for brute-force protection
 */

interface RateLimitEntry {
	attempts: number;
	firstAttemptTime: number;
	lastAttemptTime: number;
	blockedUntil?: number;
}

// In-memory store (for production, consider Redis or database)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup old entries every 10 minutes
setInterval(() => {
	const now = Date.now();
	const tenMinutesAgo = now - 10 * 60 * 1000;

	for (const [key, entry] of rateLimitStore.entries()) {
		if (entry.lastAttemptTime < tenMinutesAgo && (!entry.blockedUntil || entry.blockedUntil < now)) {
			rateLimitStore.delete(key);
		}
	}
}, 10 * 60 * 1000);

export interface RateLimitConfig {
	/** Maximum attempts allowed within the window */
	maxAttempts: number;
	/** Time window in milliseconds */
	windowMs: number;
	/** Block duration in milliseconds after max attempts exceeded */
	blockDurationMs: number;
}

export interface RateLimitResult {
	allowed: boolean;
	remainingAttempts?: number;
	retryAfterMs?: number;
	message?: string;
}

/**
 * Check if a request should be rate limited
 * @param identifier - Unique identifier (e.g., IP address or email)
 * @param config - Rate limit configuration
 */
export function checkRateLimit(identifier: string, config: RateLimitConfig): RateLimitResult {
	const now = Date.now();
	const entry = rateLimitStore.get(identifier);

	// Check if currently blocked
	if (entry?.blockedUntil && entry.blockedUntil > now) {
		const retryAfterMs = entry.blockedUntil - now;
		const retryAfterSeconds = Math.ceil(retryAfterMs / 1000);
		return {
			allowed: false,
			retryAfterMs,
			message: `Too many attempts. Please try again in ${retryAfterSeconds} seconds.`
		};
	}

	// No entry or window expired - start fresh
	if (!entry || now - entry.firstAttemptTime > config.windowMs) {
		rateLimitStore.set(identifier, {
			attempts: 1,
			firstAttemptTime: now,
			lastAttemptTime: now
		});

		return {
			allowed: true,
			remainingAttempts: config.maxAttempts - 1
		};
	}

	// Increment attempts
	entry.attempts++;
	entry.lastAttemptTime = now;

	// Check if exceeded max attempts
	if (entry.attempts > config.maxAttempts) {
		entry.blockedUntil = now + config.blockDurationMs;
		rateLimitStore.set(identifier, entry);

		const retryAfterSeconds = Math.ceil(config.blockDurationMs / 1000);
		return {
			allowed: false,
			retryAfterMs: config.blockDurationMs,
			message: `Too many failed attempts. Account temporarily locked for ${retryAfterSeconds} seconds.`
		};
	}

	// Still within limits
	rateLimitStore.set(identifier, entry);
	return {
		allowed: true,
		remainingAttempts: config.maxAttempts - entry.attempts
	};
}

/**
 * Reset rate limit for an identifier (e.g., after successful login)
 */
export function resetRateLimit(identifier: string): void {
	rateLimitStore.delete(identifier);
}

/**
 * Preset configurations
 */
export const RATE_LIMIT_CONFIGS = {
	// Login: 5 attempts per 15 minutes, then block for 15 minutes
	LOGIN: {
		maxAttempts: 5,
		windowMs: 15 * 60 * 1000, // 15 minutes
		blockDurationMs: 15 * 60 * 1000 // 15 minutes
	} as RateLimitConfig,

	// Strict login: 3 attempts per 10 minutes, block for 30 minutes
	LOGIN_STRICT: {
		maxAttempts: 3,
		windowMs: 10 * 60 * 1000,
		blockDurationMs: 30 * 60 * 1000
	} as RateLimitConfig,

	// API: 100 requests per minute
	API: {
		maxAttempts: 100,
		windowMs: 60 * 1000,
		blockDurationMs: 60 * 1000
	} as RateLimitConfig
};

/**
 * Get client IP address from request
 */
export function getClientIP(request: Request): string {
	// Check various headers for real IP (consider your deployment environment)
	const forwardedFor = request.headers.get('x-forwarded-for');
	if (forwardedFor) {
		return forwardedFor.split(',')[0].trim();
	}

	const realIP = request.headers.get('x-real-ip');
	if (realIP) {
		return realIP;
	}

	// Fallback to connection remote address
	return 'unknown';
}
