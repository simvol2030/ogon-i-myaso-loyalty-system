/**
 * App Configuration
 * Uses SvelteKit $env/static/public for proper build-time injection
 */

import { PUBLIC_BACKEND_URL } from '$env/static/public';

// Client-side should use relative URLs, server-side uses full URL
export const API_BASE_URL = typeof window === 'undefined'
	? (PUBLIC_BACKEND_URL || 'http://localhost:3007') + '/api'
	: '/api'; // Relative URL for client

export const config = {
	apiBaseUrl: API_BASE_URL,
	useMockData: false, // No longer using import.meta.env
	environment: typeof window === 'undefined' ? 'server' : 'client'
};
