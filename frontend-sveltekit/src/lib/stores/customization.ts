/**
 * Customization Store
 * Manages app branding, colors, and navigation settings
 * Loaded from /api/customization on app startup
 */

import { writable, derived, get } from 'svelte/store';
import { browser } from '$app/environment';

// Types
export interface NavItem {
	id: string;
	href: string;
	label: string;
	icon: string;
	visible: boolean;
	isExternal?: boolean;
}

export interface CustomizationColors {
	primary: string;
	primaryDark: string;
	primaryLight: string;
	secondary: string;
	secondaryDark: string;
	accent: string;
}

export interface CustomizationDarkTheme {
	bgPrimary: string;
	bgSecondary: string;
	bgTertiary: string;
	primary: string;
	textPrimary: string;
	textSecondary: string;
	borderColor: string;
}

export interface LoyaltyCardSettings {
	gradientStart: string;
	gradientEnd: string;
	textColor: string;
	accentColor: string;
	badgeBg: string;
	badgeText: string;
	borderRadius: number;
	showShimmer: boolean;
}

export interface CustomizationData {
	appName: string;
	appSlogan: string;
	logoUrl: string;
	faviconUrl: string | null;
	colors: CustomizationColors;
	darkTheme: CustomizationDarkTheme;
	navigation: {
		bottomNav: NavItem[];
		sidebarMenu: NavItem[];
	};
	loyaltyCard: LoyaltyCardSettings;
	productsLabel: string; // Customizable label for Products section
	productsIcon: string; // Customizable icon for Products section (cart, shopping-bag, heart, star)
}

// Default values (fallback if API is not available)
const defaultCustomization: CustomizationData = {
	appName: 'ГРАНАТ',
	appSlogan: '',
	logoUrl: '/logo.png',
	faviconUrl: '/favicon.ico',
	colors: {
		primary: '#ff6b00',
		primaryDark: '#e55d00',
		primaryLight: '#ff8533',
		secondary: '#10b981',
		secondaryDark: '#059669',
		accent: '#dc2626'
	},
	darkTheme: {
		bgPrimary: '#17212b',
		bgSecondary: '#0e1621',
		bgTertiary: '#1f2c38',
		primary: '#ff8533',
		textPrimary: '#ffffff',
		textSecondary: '#aaaaaa',
		borderColor: '#2b3943'
	},
	navigation: {
		bottomNav: [
			{ id: 'home', href: '/', label: 'Главная', icon: 'home', visible: true },
			{ id: 'offers', href: '/offers', label: 'Акции', icon: 'tag', visible: true },
			{ id: 'products', href: '/products', label: 'Меню', icon: 'cart', visible: true },
			{ id: 'history', href: '/history', label: 'Бонусы', icon: 'coins', visible: true },
			{ id: 'profile', href: '/profile', label: 'Профиль', icon: 'user', visible: true }
		],
		sidebarMenu: [
			{ id: 'home', href: '/', label: 'Главная', icon: '📊', visible: true, isExternal: false },
			{ id: 'products', href: '/products', label: 'Меню', icon: '🛍️', visible: true, isExternal: false },
			{ id: 'offers', href: '/offers', label: 'Акции', icon: '🎁', visible: true, isExternal: false },
			{ id: 'stores', href: '/stores', label: 'Магазины', icon: '🏪', visible: true, isExternal: false },
			{ id: 'feed', href: '/feed', label: 'Блог', icon: '📰', visible: true, isExternal: false },
			{ id: 'history', href: '/history', label: 'История', icon: '📜', visible: true, isExternal: false },
			{ id: 'profile', href: '/profile', label: 'Профиль', icon: '👤', visible: true, isExternal: false },
			{ id: 'reputation', href: '/reputation', label: 'Оставить отзыв', icon: '⭐', visible: true, isExternal: false }
		]
	},
	loyaltyCard: {
		gradientStart: '#ff6b00',
		gradientEnd: '#dc2626',
		textColor: '#ffffff',
		accentColor: '#ffffff',
		badgeBg: 'rgba(255,255,255,0.95)',
		badgeText: '#e55d00',
		borderRadius: 24,
		showShimmer: true
	},
	productsLabel: 'Меню',
	productsIcon: 'cart'
};

// SVG paths for bottom nav icons
export const iconPaths: Record<string, string> = {
	home: 'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z',
	tag: 'M21.41 11.58l-9-9C12.05 2.22 11.55 2 11 2H4c-1.1 0-2 .9-2 2v7c0 .55.22 1.05.59 1.42l9 9c.36.36.86.58 1.41.58.55 0 1.05-.22 1.41-.59l7-7c.37-.36.59-.86.59-1.41 0-.55-.23-1.06-.59-1.42zM5.5 7C4.67 7 4 6.33 4 5.5S4.67 4 5.5 4 7 4.67 7 5.5 6.33 7 5.5 7z',
	location: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z',
	coins: 'M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z',
	user: 'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z',
	cart: 'M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z',
	heart: 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z',
	star: 'M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z',
	settings: 'M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z',
	feed: 'M5 3h14c1.1 0 2 .9 2 2v14c0 1.1-.9 2-2 2H5c-1.1 0-2-.9-2-2V5c0-1.1.9-2 2-2zm0 16h14V5H5v14zm2-10h10v2H7v-2zm0 4h10v2H7v-2z',
	'shopping-bag': 'M20 6h-4c0-2.21-1.79-4-4-4S8 3.79 8 6H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-10 0c0-1.1.9-2 2-2s2 .9 2 2h-4zm0 6c0 1.1-.9 2-2 2s-2-.9-2-2h1.5c0 .28.22.5.5.5s.5-.22.5-.5V12h1.5zm6 0c0 .28.22.5.5.5s.5-.22.5-.5h1.5c0 1.1-.9 2-2 2s-2-.9-2-2V12h1.5v0z'
};

// Store
export const customization = writable<CustomizationData>(defaultCustomization);
export const customizationLoaded = writable<boolean>(false);
export const customizationError = writable<string | null>(null);

// Derived stores for convenience
export const appName = derived(customization, $c => $c?.appName || defaultCustomization.appName);
export const appSlogan = derived(customization, $c => $c?.appSlogan || defaultCustomization.appSlogan);
export const logoUrl = derived(customization, $c => $c?.logoUrl || defaultCustomization.logoUrl);
export const colors = derived(customization, $c => $c?.colors || defaultCustomization.colors);
export const darkTheme = derived(customization, $c => $c?.darkTheme || defaultCustomization.darkTheme);
export const bottomNavItems = derived(customization, $c =>
	($c?.navigation?.bottomNav || []).filter(item => item.visible).map(item =>
		item.id === 'products' ? { ...item, label: $c?.productsLabel || defaultCustomization.productsLabel, icon: $c?.productsIcon || defaultCustomization.productsIcon } : item
	)
);
export const sidebarMenuItems = derived(customization, $c =>
	($c?.navigation?.sidebarMenu || []).filter(item => item.visible).map(item =>
		item.id === 'products' ? { ...item, label: $c?.productsLabel || defaultCustomization.productsLabel } : item
	)
);
export const productsLabel = derived(customization, $c => $c?.productsLabel || defaultCustomization.productsLabel);
export const productsIcon = derived(customization, $c => $c?.productsIcon || defaultCustomization.productsIcon);
// BUG-3 FIX: Add fallback for loyaltyCard if undefined (defensive programming)
export const loyaltyCardSettings = derived(customization, $c => $c?.loyaltyCard || defaultCustomization.loyaltyCard);

/**
 * Load customization settings from API
 */
export async function loadCustomization(apiBaseUrl: string = '/api'): Promise<void> {
	if (!browser) return;

	try {
		const response = await fetch(`${apiBaseUrl}/customization`);

		if (!response.ok) {
			throw new Error(`HTTP ${response.status}`);
		}

		const result = await response.json();

		if (result.success && result.data) {
			// BUG-1 FIX: Merge with defaults to handle missing fields (e.g., old API without loyaltyCard)
			const mergedData: CustomizationData = {
				...defaultCustomization,
				...result.data,
				// Deep merge nested objects
				colors: { ...defaultCustomization.colors, ...(result.data.colors || {}) },
				darkTheme: { ...defaultCustomization.darkTheme, ...(result.data.darkTheme || {}) },
				navigation: {
					bottomNav: result.data.navigation?.bottomNav || defaultCustomization.navigation.bottomNav,
					sidebarMenu: result.data.navigation?.sidebarMenu || defaultCustomization.navigation.sidebarMenu
				},
				loyaltyCard: { ...defaultCustomization.loyaltyCard, ...(result.data.loyaltyCard || {}) }
			};
			customization.set(mergedData);
			applyCustomStyles(mergedData);
		}

		customizationLoaded.set(true);
	} catch (error) {
		console.warn('[CUSTOMIZATION] Failed to load settings, using defaults:', error);
		customizationError.set((error as Error).message);
		customizationLoaded.set(true);
		// Use default values - already set
	}
}

/**
 * Apply custom CSS variables to document
 */
export function applyCustomStyles(data: CustomizationData): void {
	if (!browser) return;

	const root = document.documentElement;

	// Light theme colors
	root.style.setProperty('--primary-orange', data.colors.primary);
	root.style.setProperty('--primary-orange-dark', data.colors.primaryDark);
	root.style.setProperty('--primary-orange-light', data.colors.primaryLight);
	root.style.setProperty('--secondary-green', data.colors.secondary);
	root.style.setProperty('--secondary-green-dark', data.colors.secondaryDark);
	root.style.setProperty('--accent-red', data.colors.accent);

	// Create/update dark theme CSS
	updateDarkThemeStyles(data.darkTheme);
}

/**
 * Update dark theme CSS variables via style element
 */
function updateDarkThemeStyles(darkTheme: CustomizationDarkTheme): void {
	const styleId = 'customization-dark-theme';
	let styleElement = document.getElementById(styleId) as HTMLStyleElement;

	if (!styleElement) {
		styleElement = document.createElement('style');
		styleElement.id = styleId;
		document.head.appendChild(styleElement);
	}

	styleElement.textContent = `
		[data-theme="dark"] {
			--primary-orange: ${darkTheme.primary};
			--bg-white: ${darkTheme.bgPrimary};
			--bg-light: ${darkTheme.bgSecondary};
			--bg-tertiary: ${darkTheme.bgTertiary};
			--text-primary: ${darkTheme.textPrimary};
			--text-secondary: ${darkTheme.textSecondary};
			--border-color: ${darkTheme.borderColor};
			--card-bg: ${darkTheme.bgTertiary};
			--card-hover: ${darkTheme.bgTertiary};
		}
	`;
}

/**
 * Get icon path for bottom nav item
 */
export function getIconPath(iconId: string): string {
	return iconPaths[iconId] || iconPaths.home;
}
