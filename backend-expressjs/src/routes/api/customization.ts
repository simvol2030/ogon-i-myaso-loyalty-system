/**
 * Public API: App Customization
 * Публичный эндпоинт для получения настроек внешнего вида
 * Используется Telegram WebApp для динамической настройки UI
 */

import { Router } from 'express';
import { db } from '../../db/client';
import { appCustomization } from '../../db/schema';
import { eq } from 'drizzle-orm';

const router = Router();

// Simple in-memory cache for customization settings
let cachedSettings: any = null;
let cacheTimestamp: number = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Invalidate cache (called when settings are updated)
 */
export function invalidateCustomizationCache() {
	cachedSettings = null;
	cacheTimestamp = 0;
	console.log('[CUSTOMIZATION CACHE] Cache invalidated');
}

/**
 * GET /api/customization - Get app customization settings (public)
 * Returns branding, colors, and navigation configuration
 * Cached for 5 minutes to reduce database load
 */
router.get('/', async (req, res) => {
	try {
		// Check cache first
		const now = Date.now();
		if (cachedSettings && (now - cacheTimestamp) < CACHE_TTL) {
			return res.json({
				success: true,
				data: cachedSettings,
				cached: true
			});
		}

		// Fetch from database
		let settings = await db.select().from(appCustomization).where(eq(appCustomization.id, 1)).limit(1);

		// Auto-create default settings if missing
		if (settings.length === 0) {
			console.log('[CUSTOMIZATION] Creating default settings (missing row)');
			await db.insert(appCustomization).values({ id: 1 });
			settings = await db.select().from(appCustomization).where(eq(appCustomization.id, 1)).limit(1);
		}

		const s = settings[0];

		// Transform to API response format
		const responseData = {
			// Branding
			appName: s.app_name,
			appSlogan: s.app_slogan,
			logoUrl: s.logo_url,
			faviconUrl: s.favicon_url,

			// Light theme colors
			colors: {
				primary: s.primary_color,
				primaryDark: s.primary_color_dark,
				primaryLight: s.primary_color_light,
				secondary: s.secondary_color,
				secondaryDark: s.secondary_color_dark,
				accent: s.accent_color
			},

			// Dark theme colors
			darkTheme: {
				bgPrimary: s.dark_bg_primary,
				bgSecondary: s.dark_bg_secondary,
				bgTertiary: s.dark_bg_tertiary,
				primary: s.dark_primary_color,
				textPrimary: s.dark_text_primary,
				textSecondary: s.dark_text_secondary,
				borderColor: s.dark_border_color
			},

			// Navigation
			navigation: {
				bottomNav: JSON.parse(s.bottom_nav_items),
				sidebarMenu: JSON.parse(s.sidebar_menu_items)
			},

			// Loyalty Card Widget
			loyaltyCard: {
				gradientStart: s.loyalty_card_gradient_start,
				gradientEnd: s.loyalty_card_gradient_end,
				textColor: s.loyalty_card_text_color,
				accentColor: s.loyalty_card_accent_color,
				badgeBg: s.loyalty_card_badge_bg,
				badgeText: s.loyalty_card_badge_text,
				borderRadius: s.loyalty_card_border_radius,
				showShimmer: Boolean(s.loyalty_card_show_shimmer)
			},

			// Customizable Labels
			productsLabel: s.products_label
		};

		// Update cache
		cachedSettings = responseData;
		cacheTimestamp = now;

		res.json({
			success: true,
			data: responseData,
			cached: false
		});
	} catch (error: any) {
		console.error('Error fetching customization settings:', error);
		res.status(500).json({ success: false, error: 'Internal server error' });
	}
});

/**
 * GET /api/customization/css - Get CSS variables for theming
 * Returns a CSS string that can be injected into the page
 */
router.get('/css', async (req, res) => {
	try {
		let settings = await db.select().from(appCustomization).where(eq(appCustomization.id, 1)).limit(1);

		if (settings.length === 0) {
			await db.insert(appCustomization).values({ id: 1 });
			settings = await db.select().from(appCustomization).where(eq(appCustomization.id, 1)).limit(1);
		}

		const s = settings[0];

		// Generate CSS variables
		const css = `:root {
  /* Primary Colors */
  --primary-orange: ${s.primary_color};
  --primary-orange-dark: ${s.primary_color_dark};
  --primary-orange-light: ${s.primary_color_light};
  --secondary-green: ${s.secondary_color};
  --secondary-green-dark: ${s.secondary_color_dark};
  --accent-red: ${s.accent_color};
}

[data-theme="dark"] {
  --primary-orange: ${s.dark_primary_color};
  --bg-white: ${s.dark_bg_primary};
  --bg-light: ${s.dark_bg_secondary};
  --bg-tertiary: ${s.dark_bg_tertiary};
  --text-primary: ${s.dark_text_primary};
  --text-secondary: ${s.dark_text_secondary};
  --border-color: ${s.dark_border_color};
}`;

		res.setHeader('Content-Type', 'text/css');
		res.setHeader('Cache-Control', 'public, max-age=300'); // 5 minutes
		res.send(css);
	} catch (error: any) {
		console.error('Error generating CSS:', error);
		res.status(500).send('/* Error loading theme */');
	}
});

export default router;
