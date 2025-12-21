/**
 * Admin API: App Appearance/Customization Management
 * Управление внешним видом приложения (брендинг, цвета, навигация)
 */

import { Router } from 'express';
import { db } from '../../db/client';
import { appCustomization } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { authenticateSession, requireRole } from '../../middleware/session-auth';
import { invalidateCustomizationCache } from '../api/customization';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';

const router = Router();

// Configure multer for logo uploads
const storage = multer.diskStorage({
	destination: (req, file, cb) => {
		const uploadDir = path.join(process.cwd(), 'uploads', 'branding');
		// Create directory if it doesn't exist
		if (!fs.existsSync(uploadDir)) {
			fs.mkdirSync(uploadDir, { recursive: true });
		}
		cb(null, uploadDir);
	},
	filename: (req, file, cb) => {
		const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
		const ext = path.extname(file.originalname);
		cb(null, `logo-${uniqueSuffix}${ext}`);
	}
});

const upload = multer({
	storage,
	limits: {
		fileSize: 5 * 1024 * 1024 // 5MB max
	},
	fileFilter: (req, file, cb) => {
		const allowedTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
		if (allowedTypes.includes(file.mimetype)) {
			cb(null, true);
		} else {
			cb(new Error('Invalid file type. Only PNG, JPEG, WebP, and SVG are allowed.'));
		}
	}
});

// 🔒 SECURITY: All admin routes require authentication
router.use(authenticateSession);

/**
 * Validation helpers
 */
function isValidHexColor(color: string): boolean {
	return /^#[0-9A-Fa-f]{6}$/.test(color);
}

function validateAppearanceData(data: any): string | null {
	// Validate branding
	if (data.appName !== undefined) {
		if (typeof data.appName !== 'string' || data.appName.trim().length < 1 || data.appName.length > 50) {
			return 'Название приложения должно быть от 1 до 50 символов';
		}
		if (/<|>/.test(data.appName)) {
			return 'Название приложения не может содержать символы < или >';
		}
	}

	if (data.appSlogan !== undefined) {
		if (typeof data.appSlogan !== 'string' || data.appSlogan.length > 50) {
			return 'Слоган должен быть до 50 символов';
		}
		if (/<|>/.test(data.appSlogan)) {
			return 'Слоган не может содержать символы < или >';
		}
	}

	// Validate colors
	const colorFields = [
		'primaryColor', 'primaryColorDark', 'primaryColorLight',
		'secondaryColor', 'secondaryColorDark', 'accentColor',
		'darkBgPrimary', 'darkBgSecondary', 'darkBgTertiary',
		'darkPrimaryColor', 'darkTextPrimary', 'darkTextSecondary', 'darkBorderColor',
		'loyaltyCardGradientStart', 'loyaltyCardGradientEnd', 'loyaltyCardTextColor',
		'loyaltyCardAccentColor', 'loyaltyCardBadgeText'
	];

	// Validate RGBA color (for badge background)
	if (data.loyaltyCardBadgeBg !== undefined) {
		// BUG-2 FIX: Accept "1.0" format in alpha value (not just "1" or "0.x")
		const rgbaPattern = /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*(0|1(\.0+)?|0?\.\d+))?\s*\)$/;
		if (!isValidHexColor(data.loyaltyCardBadgeBg) && !rgbaPattern.test(data.loyaltyCardBadgeBg)) {
			return 'Неверный формат цвета для loyaltyCardBadgeBg. Используйте HEX (#RRGGBB) или RGBA';
		}
	}

	// Validate loyalty card border radius
	if (data.loyaltyCardBorderRadius !== undefined) {
		const radius = Number(data.loyaltyCardBorderRadius);
		if (isNaN(radius) || radius < 0 || radius > 50) {
			return 'Радиус скругления карты лояльности должен быть от 0 до 50';
		}
	}

	// Validate loyalty card shimmer toggle
	if (data.loyaltyCardShowShimmer !== undefined) {
		if (typeof data.loyaltyCardShowShimmer !== 'boolean' && data.loyaltyCardShowShimmer !== 0 && data.loyaltyCardShowShimmer !== 1) {
			return 'loyaltyCardShowShimmer должен быть boolean';
		}
	}

	for (const field of colorFields) {
		if (data[field] !== undefined) {
			if (!isValidHexColor(data[field])) {
				return `Неверный формат цвета для ${field}. Используйте HEX формат (#RRGGBB)`;
			}
		}
	}

	// Validate navigation items
	if (data.bottomNavItems !== undefined) {
		try {
			const items = typeof data.bottomNavItems === 'string'
				? JSON.parse(data.bottomNavItems)
				: data.bottomNavItems;

			if (!Array.isArray(items)) {
				return 'bottomNavItems должен быть массивом';
			}

			// BUG-6 FIX: At least one visible item required
			const visibleItems = items.filter((item: any) => item.visible !== false);
			if (visibleItems.length === 0) {
				return 'Должен быть хотя бы один видимый пункт в нижней навигации';
			}

			for (const item of items) {
				if (!item.id || !item.href || !item.label || !item.icon) {
					return 'Каждый элемент навигации должен иметь id, href, label и icon';
				}
				if (/<|>/.test(item.label)) {
					return 'Названия пунктов меню не могут содержать символы < или >';
				}
			}
		} catch (e) {
			return 'Неверный формат JSON для bottomNavItems';
		}
	}

	if (data.sidebarMenuItems !== undefined) {
		try {
			const items = typeof data.sidebarMenuItems === 'string'
				? JSON.parse(data.sidebarMenuItems)
				: data.sidebarMenuItems;

			if (!Array.isArray(items)) {
				return 'sidebarMenuItems должен быть массивом';
			}

			for (const item of items) {
				if (!item.id || !item.href || !item.label || !item.icon) {
					return 'Каждый элемент меню должен иметь id, href, label и icon';
				}
				if (/<|>/.test(item.label)) {
					return 'Названия пунктов меню не могут содержать символы < или >';
				}
				// BUG-5 FIX: External links must be valid URLs
				if (item.isExternal && !item.href.startsWith('http://') && !item.href.startsWith('https://')) {
					return `Внешняя ссылка "${item.label}" должна начинаться с http:// или https://`;
				}
			}
		} catch (e) {
			return 'Неверный формат JSON для sidebarMenuItems';
		}
	}

	return null;
}

/**
 * GET /api/admin/settings/appearance - Get appearance settings
 */
router.get('/', async (req, res) => {
	try {
		let settings = await db.select().from(appCustomization).where(eq(appCustomization.id, 1)).limit(1);

		// Auto-create default settings if missing
		if (settings.length === 0) {
			console.log('[APPEARANCE] Creating default settings (missing row)');
			await db.insert(appCustomization).values({ id: 1 });
			settings = await db.select().from(appCustomization).where(eq(appCustomization.id, 1)).limit(1);
		}

		const s = settings[0];

		res.json({
			success: true,
			data: {
				// Branding
				appName: s.app_name,
				appSlogan: s.app_slogan,
				logoUrl: s.logo_url,
				faviconUrl: s.favicon_url,

				// Light theme colors
				primaryColor: s.primary_color,
				primaryColorDark: s.primary_color_dark,
				primaryColorLight: s.primary_color_light,
				secondaryColor: s.secondary_color,
				secondaryColorDark: s.secondary_color_dark,
				accentColor: s.accent_color,

				// Dark theme colors
				darkBgPrimary: s.dark_bg_primary,
				darkBgSecondary: s.dark_bg_secondary,
				darkBgTertiary: s.dark_bg_tertiary,
				darkPrimaryColor: s.dark_primary_color,
				darkTextPrimary: s.dark_text_primary,
				darkTextSecondary: s.dark_text_secondary,
				darkBorderColor: s.dark_border_color,

				// Navigation
				bottomNavItems: JSON.parse(s.bottom_nav_items),
				sidebarMenuItems: JSON.parse(s.sidebar_menu_items),

				// Loyalty Card Widget
				loyaltyCardGradientStart: s.loyalty_card_gradient_start,
				loyaltyCardGradientEnd: s.loyalty_card_gradient_end,
				loyaltyCardTextColor: s.loyalty_card_text_color,
				loyaltyCardAccentColor: s.loyalty_card_accent_color,
				loyaltyCardBadgeBg: s.loyalty_card_badge_bg,
				loyaltyCardBadgeText: s.loyalty_card_badge_text,
				loyaltyCardBorderRadius: s.loyalty_card_border_radius,
				loyaltyCardShowShimmer: Boolean(s.loyalty_card_show_shimmer),

				// Customizable Labels
				productsLabel: s.products_label,
				productsIcon: s.products_icon,

				// Meta
				updatedAt: s.updated_at
			}
		});
	} catch (error: any) {
		console.error('Error fetching appearance settings:', error);
		res.status(500).json({ success: false, error: 'Internal server error' });
	}
});

/**
 * PUT /api/admin/settings/appearance - Update appearance settings
 * ONLY: super-admin, editor
 */
router.put('/', requireRole('super-admin', 'editor'), async (req, res) => {
	try {
		const data = req.body;

		// Validate input
		const validationError = validateAppearanceData(data);
		if (validationError) {
			return res.status(400).json({ success: false, error: validationError });
		}

		// Ensure settings row exists
		let currentSettings = await db.select().from(appCustomization).where(eq(appCustomization.id, 1)).limit(1);
		if (currentSettings.length === 0) {
			await db.insert(appCustomization).values({ id: 1 });
		}

		// Build update object
		const updates: any = {
			updated_at: new Date().toISOString()
		};

		// Branding
		if (data.appName !== undefined) updates.app_name = data.appName.trim();
		if (data.appSlogan !== undefined) updates.app_slogan = data.appSlogan.trim();
		if (data.logoUrl !== undefined) updates.logo_url = data.logoUrl;
		if (data.faviconUrl !== undefined) updates.favicon_url = data.faviconUrl;

		// Light theme colors
		if (data.primaryColor !== undefined) updates.primary_color = data.primaryColor;
		if (data.primaryColorDark !== undefined) updates.primary_color_dark = data.primaryColorDark;
		if (data.primaryColorLight !== undefined) updates.primary_color_light = data.primaryColorLight;
		if (data.secondaryColor !== undefined) updates.secondary_color = data.secondaryColor;
		if (data.secondaryColorDark !== undefined) updates.secondary_color_dark = data.secondaryColorDark;
		if (data.accentColor !== undefined) updates.accent_color = data.accentColor;

		// Dark theme colors
		if (data.darkBgPrimary !== undefined) updates.dark_bg_primary = data.darkBgPrimary;
		if (data.darkBgSecondary !== undefined) updates.dark_bg_secondary = data.darkBgSecondary;
		if (data.darkBgTertiary !== undefined) updates.dark_bg_tertiary = data.darkBgTertiary;
		if (data.darkPrimaryColor !== undefined) updates.dark_primary_color = data.darkPrimaryColor;
		if (data.darkTextPrimary !== undefined) updates.dark_text_primary = data.darkTextPrimary;
		if (data.darkTextSecondary !== undefined) updates.dark_text_secondary = data.darkTextSecondary;
		if (data.darkBorderColor !== undefined) updates.dark_border_color = data.darkBorderColor;

		// Navigation (store as JSON string)
		if (data.bottomNavItems !== undefined) {
			updates.bottom_nav_items = typeof data.bottomNavItems === 'string'
				? data.bottomNavItems
				: JSON.stringify(data.bottomNavItems);
		}
		if (data.sidebarMenuItems !== undefined) {
			updates.sidebar_menu_items = typeof data.sidebarMenuItems === 'string'
				? data.sidebarMenuItems
				: JSON.stringify(data.sidebarMenuItems);
		}

		// Loyalty Card Widget
		if (data.loyaltyCardGradientStart !== undefined) updates.loyalty_card_gradient_start = data.loyaltyCardGradientStart;
		if (data.loyaltyCardGradientEnd !== undefined) updates.loyalty_card_gradient_end = data.loyaltyCardGradientEnd;
		if (data.loyaltyCardTextColor !== undefined) updates.loyalty_card_text_color = data.loyaltyCardTextColor;
		if (data.loyaltyCardAccentColor !== undefined) updates.loyalty_card_accent_color = data.loyaltyCardAccentColor;
		if (data.loyaltyCardBadgeBg !== undefined) updates.loyalty_card_badge_bg = data.loyaltyCardBadgeBg;
		if (data.loyaltyCardBadgeText !== undefined) updates.loyalty_card_badge_text = data.loyaltyCardBadgeText;
		if (data.loyaltyCardBorderRadius !== undefined) updates.loyalty_card_border_radius = Number(data.loyaltyCardBorderRadius);
		if (data.loyaltyCardShowShimmer !== undefined) updates.loyalty_card_show_shimmer = data.loyaltyCardShowShimmer ? 1 : 0;

		// Customizable Labels
		if (data.productsLabel !== undefined) updates.products_label = data.productsLabel.trim();
		if (data.productsIcon !== undefined) updates.products_icon = data.productsIcon;

		// Update settings
		await db.update(appCustomization).set(updates).where(eq(appCustomization.id, 1));

		// Invalidate public API cache
		invalidateCustomizationCache();

		// Log changes
		const adminName = (req as any).user?.name || 'Unknown Admin';
		const adminId = (req as any).user?.id || 0;
		console.log(`[APPEARANCE UPDATE] Admin ID=${adminId} (${adminName}) updated settings`);

		// Return updated settings
		const updated = await db.select().from(appCustomization).where(eq(appCustomization.id, 1)).limit(1);
		const s = updated[0];

		res.json({
			success: true,
			data: {
				appName: s.app_name,
				appSlogan: s.app_slogan,
				logoUrl: s.logo_url,
				faviconUrl: s.favicon_url,
				primaryColor: s.primary_color,
				primaryColorDark: s.primary_color_dark,
				primaryColorLight: s.primary_color_light,
				secondaryColor: s.secondary_color,
				secondaryColorDark: s.secondary_color_dark,
				accentColor: s.accent_color,
				darkBgPrimary: s.dark_bg_primary,
				darkBgSecondary: s.dark_bg_secondary,
				darkBgTertiary: s.dark_bg_tertiary,
				darkPrimaryColor: s.dark_primary_color,
				darkTextPrimary: s.dark_text_primary,
				darkTextSecondary: s.dark_text_secondary,
				darkBorderColor: s.dark_border_color,
				bottomNavItems: JSON.parse(s.bottom_nav_items),
				sidebarMenuItems: JSON.parse(s.sidebar_menu_items),
				loyaltyCardGradientStart: s.loyalty_card_gradient_start,
				loyaltyCardGradientEnd: s.loyalty_card_gradient_end,
				loyaltyCardTextColor: s.loyalty_card_text_color,
				loyaltyCardAccentColor: s.loyalty_card_accent_color,
				loyaltyCardBadgeBg: s.loyalty_card_badge_bg,
				loyaltyCardBadgeText: s.loyalty_card_badge_text,
				loyaltyCardBorderRadius: s.loyalty_card_border_radius,
				loyaltyCardShowShimmer: Boolean(s.loyalty_card_show_shimmer),
				updatedAt: s.updated_at
			}
		});
	} catch (error: any) {
		console.error('Error updating appearance settings:', error);
		res.status(500).json({ success: false, error: 'Internal server error' });
	}
});

/**
 * POST /api/admin/settings/appearance/logo - Upload new logo
 * ONLY: super-admin, editor
 */
router.post('/logo', requireRole('super-admin', 'editor'), upload.single('logo'), async (req, res) => {
	try {
		if (!req.file) {
			return res.status(400).json({ success: false, error: 'Файл не загружен' });
		}

		const uploadedPath = req.file.path;

		// BUG FIX V2: Always save to static/logo.png ONLY (no timestamped files)
		// This prevents logo flashing because URL never changes (/logo.png)
		const staticLogoPath = path.join(process.cwd(), '..', 'frontend-sveltekit', 'static', 'logo.png');
		await sharp(uploadedPath)
			.resize(200, 200, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
			.png({ quality: 90 })
			.toFile(staticLogoPath);

		// Delete original uploaded file
		fs.unlinkSync(uploadedPath);

		// BUG FIX V3: Add cache busting query param to force browser reload
		// Without this, browser caches /logo.png and doesn't see new version
		const timestamp = Date.now();
		const logoUrlWithCacheBusting = `/logo.png?v=${timestamp}`;

		// Update logo URL in database with cache busting
		await db.update(appCustomization)
			.set({
				logo_url: logoUrlWithCacheBusting,
				updated_at: new Date().toISOString()
			})
			.where(eq(appCustomization.id, 1));

		// Invalidate public API cache
		invalidateCustomizationCache();

		// Log upload
		const adminName = (req as any).user?.name || 'Unknown Admin';
		console.log(`[LOGO UPLOAD] Admin (${adminName}) uploaded new logo to /static/logo.png (cache: v=${timestamp})`);

		res.json({
			success: true,
			data: {
				logoUrl: logoUrlWithCacheBusting
			}
		});
	} catch (error: any) {
		console.error('Error uploading logo:', error);
		res.status(500).json({ success: false, error: 'Ошибка загрузки логотипа' });
	}
});

/**
 * DELETE /api/admin/settings/appearance/logo - Reset logo to default
 * ONLY: super-admin, editor
 */
router.delete('/logo', requireRole('super-admin', 'editor'), async (req, res) => {
	try {
		// NOTE: Logo reset is not meaningful anymore since we only use /logo.png
		// This endpoint is kept for API compatibility but does nothing
		// To reset logo, admin should upload original logo file

		res.json({
			success: true,
			data: {
				logoUrl: '/logo.png'
			},
			message: 'Для сброса логотипа загрузите оригинальный файл'
		});
	} catch (error: any) {
		console.error('Error resetting logo:', error);
		res.status(500).json({ success: false, error: 'Ошибка сброса логотипа' });
	}
});

export default router;
