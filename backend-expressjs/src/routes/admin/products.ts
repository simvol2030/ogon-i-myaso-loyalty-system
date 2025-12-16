/**
 * Admin API: Products Management
 * Based on API-CONTRACT-Products.md
 */

import { Router } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import AdmZip from 'adm-zip';
import { db } from '../../db/client';
import { products, categories, productVariations } from '../../db/schema';
import { eq, and, desc, like, sql, asc } from 'drizzle-orm';
import { authenticateSession, requireRole } from '../../middleware/session-auth';
import { validateProductData } from '../../utils/validation';
import { parse as csvParse } from 'csv-parse/sync';
import {
	getVariationsByProductId,
	getVariationById,
	createVariation,
	updateVariation,
	deleteVariation,
	createVariationsBulk,
	updateVariationsOrder,
	hasVariations
} from '../../db/queries/productVariations';

const router = Router();

// Uploads directory
const UPLOADS_DIR = path.join(process.cwd(), 'uploads', 'products');

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
	fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Multer configuration - store in memory for processing
const upload = multer({
	storage: multer.memoryStorage(),
	limits: {
		fileSize: 5 * 1024 * 1024 // 5MB max
	},
	fileFilter: (req, file, cb) => {
		const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
		if (allowedTypes.includes(file.mimetype)) {
			cb(null, true);
		} else {
			cb(new Error('Разрешены только изображения (JPEG, PNG, WebP, GIF)'));
		}
	}
});

// 🔒 SECURITY: All admin routes require authentication
router.use(authenticateSession);

/**
 * POST /api/admin/products/upload - Upload product image
 * ONLY: super-admin, editor
 */
router.post('/upload', requireRole('super-admin', 'editor'), upload.single('image'), async (req, res) => {
	try {
		const file = req.file;

		if (!file) {
			return res.status(400).json({ success: false, error: 'Файл не загружен' });
		}

		// Generate unique filename
		const timestamp = Date.now();
		const randomSuffix = Math.random().toString(36).substring(2, 8);
		const filename = `product_${timestamp}_${randomSuffix}.webp`;
		const filepath = path.join(UPLOADS_DIR, filename);

		// Process image with sharp:
		// - Convert to WebP
		// - Resize to max 800px width (keeping aspect ratio)
		// - Quality 85%
		await sharp(file.buffer)
			.resize(800, 800, {
				fit: 'inside',
				withoutEnlargement: true
			})
			.webp({ quality: 85 })
			.toFile(filepath);

		// Return URL path for database storage
		const imageUrl = `/api/uploads/products/${filename}`;

		res.status(201).json({
			success: true,
			data: {
				url: imageUrl,
				filename: filename
			}
		});
	} catch (error: any) {
		console.error('Error uploading product image:', error);
		res.status(500).json({ success: false, error: error.message || 'Internal server error' });
	}
});

/**
 * GET /api/admin/products - Список товаров
 */
router.get('/', async (req, res) => {
	try {
		const { search, status = 'all', category, page = '1', limit = '20' } = req.query;

		const pageNum = parseInt(page as string);
		const limitNum = parseInt(limit as string);
		const offset = (pageNum - 1) * limitNum;

		const conditions: any[] = [];

		if (status === 'active') conditions.push(eq(products.is_active, true));
		else if (status === 'inactive') conditions.push(eq(products.is_active, false));

		if (category && category !== 'all') {
			conditions.push(eq(products.category, category as string));
		}

		if (search && typeof search === 'string') {
			conditions.push(like(products.name, `%${search.trim()}%`));
		}

		const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

		const totalResult = await db
			.select({ count: sql<number>`COUNT(*)` })
			.from(products)
			.where(whereClause);
		const total = Number(totalResult[0].count);

		const dbProducts = await db
			.select()
			.from(products)
			.where(whereClause)
			.orderBy(desc(products.id))
			.limit(limitNum)
			.offset(offset);

		// Get variations for all products
		const productIds = dbProducts.map(p => p.id);
		const allVariations = productIds.length > 0
			? await db.select().from(productVariations).where(sql`${productVariations.product_id} IN (${sql.join(productIds.map(id => sql`${id}`), sql`, `)})`)
			: [];

		const variationsByProduct = new Map<number, typeof allVariations>();
		for (const v of allVariations) {
			if (!variationsByProduct.has(v.product_id)) {
				variationsByProduct.set(v.product_id, []);
			}
			variationsByProduct.get(v.product_id)!.push(v);
		}

		const productsData = dbProducts.map((p) => {
			const productVariations = variationsByProduct.get(p.id) || [];
			return {
				id: p.id,
				name: p.name,
				description: p.description,
				price: p.price,
				oldPrice: p.old_price,
				quantityInfo: p.quantity_info,
				image: p.image,
				category: p.category,
				categoryId: p.category_id,
				sku: p.sku,
				position: p.position,
				isActive: Boolean(p.is_active),
				showOnHome: Boolean(p.show_on_home),
				isRecommendation: Boolean(p.is_recommendation),
				variationAttribute: p.variation_attribute,
				hasVariations: productVariations.length > 0,
				variations: productVariations.map(v => ({
					id: v.id,
					name: v.name,
					price: v.price,
					oldPrice: v.old_price,
					sku: v.sku,
					position: v.position,
					isDefault: Boolean(v.is_default),
					isActive: Boolean(v.is_active)
				}))
			};
		});

		res.json({
			success: true,
			data: {
				products: productsData,
				pagination: {
					page: pageNum,
					limit: limitNum,
					total,
					totalPages: Math.ceil(total / limitNum)
				}
			}
		});
	} catch (error: any) {
		console.error('Error fetching products:', error);
		res.status(500).json({ success: false, error: 'Internal server error' });
	}
});

/**
 * GET /api/admin/products/categories - Список категорий
 * Возвращает категории из новой таблицы categories + legacy из products.category
 */
router.get('/categories', async (req, res) => {
	try {
		// Get categories from new categories table
		const dbCategories = await db
			.select()
			.from(categories)
			.where(eq(categories.is_active, true))
			.orderBy(asc(categories.position), asc(categories.name));

		// Get product counts for each category
		const productCounts = await db
			.select({
				category_id: products.category_id,
				count: sql<number>`COUNT(*)`
			})
			.from(products)
			.groupBy(products.category_id);

		const countsMap = new Map(productCounts.map(pc => [pc.category_id, Number(pc.count)]));

		// Map to response format
		const categoriesList = dbCategories.map(c => ({
			id: c.id,
			name: c.name,
			slug: c.slug,
			count: countsMap.get(c.id) || 0
		}));

		// Also get legacy text categories (for backwards compatibility)
		const legacyCategoriesResult = await db
			.select({
				name: products.category,
				count: sql<number>`COUNT(*)`
			})
			.from(products)
			.groupBy(products.category)
			.orderBy(products.category);

		const legacyCategories = legacyCategoriesResult.map((c) => ({
			name: c.name,
			count: Number(c.count)
		}));

		res.json({
			success: true,
			data: {
				categories: categoriesList,
				legacyCategories // Keep old format for backwards compatibility
			}
		});
	} catch (error: any) {
		console.error('Error fetching categories:', error);
		res.status(500).json({ success: false, error: 'Internal server error' });
	}
});

/**
 * POST /api/admin/products - Создать товар
 * ONLY: super-admin, editor
 */
router.post('/', requireRole('super-admin', 'editor'), async (req, res) => {
	try {
		const {
			name, description, price, oldPrice, quantityInfo, image,
			category, categoryId, sku,
			variationAttribute, variations, // Product variations support
			isActive = true, showOnHome = false, isRecommendation = false
		} = req.body;

		// 🔒 FIX: Add comprehensive validation (Sprint 3)
		const validation = validateProductData(req.body);
		if (!validation.valid) {
			return res.status(400).json({
				success: false,
				error: validation.errors.join('; ')
			});
		}

		const result = await db
			.insert(products)
			.values({
				name,
				description,
				price,
				old_price: oldPrice,
				quantity_info: quantityInfo,
				image,
				category,
				category_id: categoryId || null,
				sku: sku || null,
				variation_attribute: variationAttribute || null,
				is_active: isActive,
				show_on_home: showOnHome,
				is_recommendation: isRecommendation
			})
			.returning();

		const created = result[0];

		// Create variations if provided
		let createdVariations: any[] = [];
		if (variations && Array.isArray(variations) && variations.length > 0) {
			createdVariations = await createVariationsBulk(created.id, variations.map((v: any, index: number) => ({
				name: v.name,
				price: Number(v.price) || 0,
				old_price: v.oldPrice != null ? Number(v.oldPrice) : null,
				sku: v.sku || null,
				position: v.position ?? index,
				is_default: Boolean(v.isDefault ?? (index === 0)),
				is_active: v.isActive !== false
			})));
		}

		res.status(201).json({
			success: true,
			data: {
				id: created.id,
				name: created.name,
				description: created.description,
				price: created.price,
				oldPrice: created.old_price,
				quantityInfo: created.quantity_info,
				image: created.image,
				category: created.category,
				categoryId: created.category_id,
				sku: created.sku,
				variationAttribute: created.variation_attribute,
				isActive: Boolean(created.is_active),
				showOnHome: Boolean(created.show_on_home),
				isRecommendation: Boolean(created.is_recommendation),
				hasVariations: createdVariations.length > 0,
				variations: createdVariations.map(v => ({
					id: v.id,
					name: v.name,
					price: v.price,
					oldPrice: v.old_price,
					sku: v.sku,
					position: v.position,
					isDefault: Boolean(v.is_default),
					isActive: Boolean(v.is_active)
				}))
			}
		});
	} catch (error: any) {
		console.error('Error creating product:', error);
		res.status(500).json({ success: false, error: 'Internal server error' });
	}
});

/**
 * PUT /api/admin/products/:id - Обновить товар
 * ONLY: super-admin, editor
 */
router.put('/:id', requireRole('super-admin', 'editor'), async (req, res) => {
	try {
		const productId = parseInt(req.params.id);
		const {
			name, description, price, oldPrice, quantityInfo, image,
			category, categoryId, sku,
			variationAttribute, variations, // Product variations support
			isActive, showOnHome, isRecommendation
		} = req.body;

		// 🔒 FIX: Add validation (Sprint 3)
		const validation = validateProductData(req.body);
		if (!validation.valid) {
			return res.status(400).json({
				success: false,
				error: validation.errors.join('; ')
			});
		}

		const result = await db
			.update(products)
			.set({
				name,
				description,
				price,
				old_price: oldPrice,
				quantity_info: quantityInfo,
				image,
				category,
				category_id: categoryId !== undefined ? categoryId : undefined,
				sku: sku !== undefined ? sku : undefined,
				variation_attribute: variationAttribute !== undefined ? variationAttribute : undefined,
				is_active: isActive,
				show_on_home: showOnHome,
				is_recommendation: isRecommendation
			})
			.where(eq(products.id, productId))
			.returning();

		if (result.length === 0) {
			return res.status(404).json({ success: false, error: 'Товар не найден' });
		}

		const updated = result[0];

		// Update variations if provided
		let updatedVariations: any[] = [];
		if (variations !== undefined) {
			if (Array.isArray(variations) && variations.length > 0) {
				updatedVariations = await createVariationsBulk(productId, variations.map((v: any, index: number) => ({
					name: v.name,
					price: Number(v.price) || 0,
					old_price: v.oldPrice != null ? Number(v.oldPrice) : null, // Convert undefined to null
					sku: v.sku || null, // Convert undefined/empty to null
					position: v.position ?? index,
					is_default: Boolean(v.isDefault ?? (index === 0)),
					is_active: v.isActive !== false // Default to true
				})));
			} else if (Array.isArray(variations) && variations.length === 0) {
				// Clear all variations if empty array provided
				await db.delete(productVariations).where(eq(productVariations.product_id, productId));
			}
		} else {
			// Get existing variations
			updatedVariations = await getVariationsByProductId(productId);
		}

		res.json({
			success: true,
			data: {
				id: updated.id,
				name: updated.name,
				description: updated.description,
				price: updated.price,
				oldPrice: updated.old_price,
				quantityInfo: updated.quantity_info,
				image: updated.image,
				category: updated.category,
				categoryId: updated.category_id,
				sku: updated.sku,
				variationAttribute: updated.variation_attribute,
				isActive: Boolean(updated.is_active),
				showOnHome: Boolean(updated.show_on_home),
				isRecommendation: Boolean(updated.is_recommendation),
				hasVariations: updatedVariations.length > 0,
				variations: updatedVariations.map(v => ({
					id: v.id,
					name: v.name,
					price: v.price,
					oldPrice: v.old_price,
					sku: v.sku,
					position: v.position,
					isDefault: Boolean(v.is_default),
					isActive: Boolean(v.is_active)
				}))
			}
		});
	} catch (error: any) {
		console.error('Error updating product:', error);
		res.status(500).json({ success: false, error: 'Internal server error' });
	}
});

/**
 * DELETE /api/admin/products/:id - Удалить товар
 * ONLY: super-admin
 */
router.delete('/:id', requireRole('super-admin'), async (req, res) => {
	try {
		const productId = parseInt(req.params.id);
		const { soft = 'true' } = req.query;

		if (soft === 'true') {
			await db.update(products).set({ is_active: false }).where(eq(products.id, productId));
			res.json({ success: true, message: 'Товар скрыт' });
		} else {
			await db.delete(products).where(eq(products.id, productId));
			res.json({ success: true, message: 'Товар удален' });
		}
	} catch (error: any) {
		console.error('Error deleting product:', error);
		res.status(500).json({ success: false, error: 'Internal server error' });
	}
});

/**
 * PATCH /api/admin/products/:id/toggle-active - Показать/скрыть
 * ONLY: super-admin, editor
 */
router.patch('/:id/toggle-active', requireRole('super-admin', 'editor'), async (req, res) => {
	try {
		const productId = parseInt(req.params.id);
		const { isActive } = req.body;

		await db.update(products).set({ is_active: isActive }).where(eq(products.id, productId));

		res.json({
			success: true,
			data: { id: productId, isActive }
		});
	} catch (error: any) {
		console.error('Error toggling product:', error);
		res.status(500).json({ success: false, error: 'Internal server error' });
	}
});

// Multer configuration for import files
const importUpload = multer({
	storage: multer.memoryStorage(),
	limits: {
		fileSize: 10 * 1024 * 1024 // 10MB max for import files
	},
	fileFilter: (req, file, cb) => {
		const allowedTypes = ['text/csv', 'application/json', 'text/plain'];
		const allowedExts = ['.csv', '.json'];
		const ext = path.extname(file.originalname).toLowerCase();

		if (allowedTypes.includes(file.mimetype) || allowedExts.includes(ext)) {
			cb(null, true);
		} else {
			cb(new Error('Разрешены только файлы CSV и JSON'));
		}
	}
});

// Multer configuration for ZIP import
const zipImportUpload = multer({
	storage: multer.memoryStorage(),
	limits: {
		fileSize: 50 * 1024 * 1024 // 50MB max for ZIP files with images
	},
	fileFilter: (req, file, cb) => {
		const allowedTypes = ['application/zip', 'application/x-zip-compressed', 'application/octet-stream'];
		const allowedExts = ['.zip'];
		const ext = path.extname(file.originalname).toLowerCase();

		if (allowedTypes.includes(file.mimetype) || allowedExts.includes(ext)) {
			cb(null, true);
		} else {
			cb(new Error('Разрешены только ZIP файлы'));
		}
	}
});

interface ImportProductRow {
	name?: string;
	description?: string;
	price?: string | number;
	oldPrice?: string | number;
	old_price?: string | number;
	quantityInfo?: string;
	quantity_info?: string;
	image?: string;
	category?: string;
	categoryId?: string | number;
	category_id?: string | number;
	sku?: string;
	position?: string | number;
	isActive?: boolean | string | number;
	is_active?: boolean | string | number;
	showOnHome?: boolean | string | number;
	show_on_home?: boolean | string | number;
	isRecommendation?: boolean | string | number;
	is_recommendation?: boolean | string | number;
	// Variations support
	variationAttribute?: string;
	variation_attribute?: string;
	variations?: string; // JSON array or pipe-separated format: "25см:250|30см:350"
}

interface ImportVariation {
	name: string;
	price: number;
	oldPrice?: number;
	sku?: string;
	isDefault?: boolean;
}

interface ImportResult {
	created: number;
	updated: number;
	skipped: number;
	errors: string[];
}

// Helper: Parse boolean value from various formats
function parseBoolean(value: any): boolean {
	if (typeof value === 'boolean') return value;
	if (typeof value === 'number') return value === 1;
	if (typeof value === 'string') {
		const lower = value.toLowerCase().trim();
		return lower === 'true' || lower === '1' || lower === 'yes' || lower === 'да';
	}
	return false;
}

// Helper: Parse number value
function parseNumber(value: any): number | null {
	if (value === null || value === undefined || value === '') return null;
	const num = parseFloat(String(value).replace(',', '.'));
	return isNaN(num) ? null : num;
}

// Helper: Generate slug from name
function generateSlug(name: string): string {
	const translitMap: Record<string, string> = {
		'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'e',
		'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
		'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
		'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch',
		'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya'
	};

	return name
		.toLowerCase()
		.split('')
		.map(char => translitMap[char] || char)
		.join('')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '')
		.substring(0, 100);
}

// Cache for categories during import (to avoid duplicate queries)
const categoryCache = new Map<string, number>();

// Helper: Find or create category by path (supports hierarchy with ">" separator)
// Examples:
// - "Вина" -> creates/finds "Вина" category
// - "Напитки > Вина" -> creates/finds "Напитки", then creates/finds "Вина" under it
// - "Напитки > Алкоголь > Вина" -> creates full hierarchy
async function findOrCreateCategoryByPath(categoryPath: string): Promise<{ categoryId: number; categoryName: string }> {
	const parts = categoryPath.split('>').map(p => p.trim()).filter(p => p.length > 0);

	if (parts.length === 0) {
		// Return default category
		const defaultName = 'Без категории';
		const cacheKey = defaultName.toLowerCase();

		if (categoryCache.has(cacheKey)) {
			return { categoryId: categoryCache.get(cacheKey)!, categoryName: defaultName };
		}

		// Find or create default category
		const existing = await db
			.select({ id: categories.id })
			.from(categories)
			.where(eq(categories.name, defaultName))
			.limit(1);

		if (existing.length > 0) {
			categoryCache.set(cacheKey, existing[0].id);
			return { categoryId: existing[0].id, categoryName: defaultName };
		}

		const slug = generateSlug(defaultName) + '-' + Date.now();
		const [created] = await db
			.insert(categories)
			.values({
				name: defaultName,
				slug: slug,
				parent_id: null,
				position: 0,
				is_active: true
			})
			.returning({ id: categories.id });

		categoryCache.set(cacheKey, created.id);
		return { categoryId: created.id, categoryName: defaultName };
	}

	let parentId: number | null = null;
	let finalCategoryId: number = 0;
	let finalCategoryName: string = parts[parts.length - 1];

	// Process each level of hierarchy
	for (let i = 0; i < parts.length; i++) {
		const name: string = parts[i];
		const cacheKey: string = (parentId ? `${parentId}:` : '') + name.toLowerCase();

		// Check cache first
		if (categoryCache.has(cacheKey)) {
			parentId = categoryCache.get(cacheKey)!;
			finalCategoryId = parentId;
			continue;
		}

		// Find existing category with same name and parent
		const existing = await db
			.select({ id: categories.id })
			.from(categories)
			.where(
				parentId
					? and(eq(categories.name, name), eq(categories.parent_id, parentId))
					: and(eq(categories.name, name), sql`${categories.parent_id} IS NULL`)
			)
			.limit(1);

		if (existing.length > 0) {
			categoryCache.set(cacheKey, existing[0].id);
			parentId = existing[0].id;
			finalCategoryId = existing[0].id;
		} else {
			// Create new category
			const baseSlug = generateSlug(name);
			let slug = baseSlug;

			// Ensure unique slug
			const existingSlugs = await db
				.select({ slug: categories.slug })
				.from(categories)
				.where(like(categories.slug, `${baseSlug}%`));

			const existingSlugSet = new Set(existingSlugs.map(s => s.slug));
			let counter = 1;
			while (existingSlugSet.has(slug)) {
				slug = `${baseSlug}-${counter}`;
				counter++;
			}

			const insertResult: { id: number }[] = await db
				.insert(categories)
				.values({
					name: name,
					slug: slug,
					parent_id: parentId,
					position: 0,
					is_active: true
				})
				.returning({ id: categories.id }) as { id: number }[];
			const createdId: number = insertResult[0].id;

			categoryCache.set(cacheKey, createdId);
			parentId = createdId;
			finalCategoryId = createdId;
		}
	}

	return { categoryId: finalCategoryId, categoryName: finalCategoryName };
}

// Helper: Clear category cache (call after import to free memory)
function clearCategoryCache() {
	categoryCache.clear();
}

// Helper: Parse variations from CSV/JSON string
// Supports formats:
// 1. JSON array: '[{"name":"25см","price":250},{"name":"30см","price":350}]'
// 2. Pipe-separated: "25см:250|30см:350" or "25см:250:200|30см:350" (with oldPrice)
// 3. Simple format: "25см:250,30см:350"
function parseVariations(value: string | undefined): ImportVariation[] {
	if (!value || typeof value !== 'string' || value.trim() === '') {
		return [];
	}

	const trimmed = value.trim();

	// Try JSON array first
	if (trimmed.startsWith('[')) {
		try {
			const parsed = JSON.parse(trimmed);
			if (Array.isArray(parsed)) {
				return parsed.map((v: any, idx: number) => ({
					name: String(v.name || '').trim(),
					price: parseNumber(v.price) || 0,
					oldPrice: parseNumber(v.oldPrice ?? v.old_price) || undefined,
					sku: v.sku?.trim() || undefined,
					isDefault: v.isDefault ?? v.is_default ?? (idx === 0)
				})).filter(v => v.name && v.price > 0);
			}
		} catch {
			// Fall through to other formats
		}
	}

	// Try pipe-separated format: "name:price:oldPrice|name2:price2" or "name:price|name2:price2"
	if (trimmed.includes('|') || trimmed.includes(':')) {
		const separator = trimmed.includes('|') ? '|' : ',';
		const parts = trimmed.split(separator);

		return parts.map((part, idx) => {
			const segments = part.trim().split(':');
			const name = segments[0]?.trim() || '';
			const price = parseNumber(segments[1]) || 0;
			const oldPrice = segments[2] ? parseNumber(segments[2]) : undefined;

			return {
				name,
				price,
				oldPrice: oldPrice || undefined,
				isDefault: idx === 0
			};
		}).filter(v => v.name && v.price > 0);
	}

	return [];
}

// Helper: Normalize row keys (support both camelCase and snake_case)
function normalizeRow(row: ImportProductRow) {
	return {
		name: row.name?.trim(),
		description: row.description?.trim() || null,
		price: parseNumber(row.price),
		oldPrice: parseNumber(row.oldPrice ?? row.old_price),
		quantityInfo: (row.quantityInfo ?? row.quantity_info)?.trim() || null,
		image: row.image?.trim() || null,
		category: row.category?.trim() || null,
		categoryId: parseNumber(row.categoryId ?? row.category_id),
		sku: row.sku?.trim() || null,
		position: parseNumber(row.position) ?? 0,
		isActive: parseBoolean(row.isActive ?? row.is_active ?? true),
		showOnHome: parseBoolean(row.showOnHome ?? row.show_on_home ?? false),
		isRecommendation: parseBoolean(row.isRecommendation ?? row.is_recommendation ?? false),
		variationAttribute: (row.variationAttribute ?? row.variation_attribute)?.trim() || null,
		variations: parseVariations(row.variations)
	};
}

/**
 * POST /api/admin/products/import - Import products from CSV/JSON
 * ONLY: super-admin, editor
 *
 * Supports:
 * - CSV format with headers
 * - JSON format (array of objects)
 * - Updates existing products by SKU (if provided)
 * - Creates new products otherwise
 */
router.post('/import', requireRole('super-admin', 'editor'), importUpload.single('file'), async (req, res) => {
	try {
		const file = req.file;
		const { mode = 'create_or_update', defaultCategory, defaultImage } = req.body;

		if (!file) {
			return res.status(400).json({ success: false, error: 'Файл не загружен' });
		}

		const fileContent = file.buffer.toString('utf-8');
		const ext = path.extname(file.originalname).toLowerCase();

		let rows: ImportProductRow[] = [];

		// Parse file based on format
		try {
			if (ext === '.json' || file.mimetype === 'application/json') {
				const parsed = JSON.parse(fileContent);
				rows = Array.isArray(parsed) ? parsed : [parsed];
			} else {
				// CSV parsing
				rows = csvParse(fileContent, {
					columns: true,
					skip_empty_lines: true,
					trim: true,
					bom: true
				});
			}
		} catch (parseError: any) {
			return res.status(400).json({
				success: false,
				error: `Ошибка разбора файла: ${parseError.message}`
			});
		}

		if (rows.length === 0) {
			return res.status(400).json({
				success: false,
				error: 'Файл пустой или не содержит данных'
			});
		}

		const result: ImportResult = {
			created: 0,
			updated: 0,
			skipped: 0,
			errors: []
		};

		// Get existing SKUs for update detection
		const existingProducts = await db
			.select({ id: products.id, sku: products.sku })
			.from(products)
			.where(sql`${products.sku} IS NOT NULL`);

		const skuToId = new Map<string, number>();
		for (const p of existingProducts) {
			if (p.sku) {
				skuToId.set(p.sku.toLowerCase(), p.id);
			}
		}

		// Process each row
		for (let i = 0; i < rows.length; i++) {
			const rowNum = i + 1;
			try {
				const normalized = normalizeRow(rows[i]);

				// Validate required fields
				if (!normalized.name) {
					result.errors.push(`Строка ${rowNum}: отсутствует название товара`);
					result.skipped++;
					continue;
				}

				if (normalized.price === null || normalized.price <= 0) {
					result.errors.push(`Строка ${rowNum}: некорректная цена`);
					result.skipped++;
					continue;
				}

				// Apply defaults and auto-create category
				const categoryPath = normalized.category || defaultCategory || '';
				const { categoryId, categoryName } = await findOrCreateCategoryByPath(categoryPath);
				const image = normalized.image || defaultImage || '/api/uploads/products/placeholder.webp';

				const productData = {
					name: normalized.name,
					description: normalized.description,
					price: normalized.price,
					old_price: normalized.oldPrice,
					quantity_info: normalized.quantityInfo,
					image: image,
					category: categoryName,
					category_id: categoryId,
					sku: normalized.sku,
					position: normalized.position || 0,
					is_active: normalized.isActive,
					show_on_home: normalized.showOnHome,
					is_recommendation: normalized.isRecommendation,
					variation_attribute: normalized.variationAttribute
				};

				// Check if product exists (by SKU)
				const existingId = normalized.sku ? skuToId.get(normalized.sku.toLowerCase()) : null;
				let productId: number | null = null;

				if (existingId && (mode === 'update_only' || mode === 'create_or_update')) {
					// Update existing product
					await db
						.update(products)
						.set(productData)
						.where(eq(products.id, existingId));
					productId = existingId;
					result.updated++;
				} else if (mode === 'update_only' && !existingId) {
					// Skip - update only mode but product doesn't exist
					result.errors.push(`Строка ${rowNum}: товар с SKU "${normalized.sku}" не найден`);
					result.skipped++;
				} else {
					// Create new product
					const [created] = await db.insert(products).values(productData).returning({ id: products.id });
					productId = created.id;
					result.created++;

					// Add new SKU to map to prevent duplicates in same import
					if (normalized.sku) {
						skuToId.set(normalized.sku.toLowerCase(), productId);
					}
				}

				// Create variations if product was created/updated and has variations
				if (productId && normalized.variations.length > 0) {
					// Delete existing variations first (replace mode)
					await db.delete(productVariations).where(eq(productVariations.product_id, productId));

					// Create new variations
					await createVariationsBulk(productId, normalized.variations.map((v, idx) => ({
						name: v.name,
						price: v.price,
						old_price: v.oldPrice ?? null,
						sku: v.sku ?? null,
						position: idx,
						is_default: v.isDefault ?? (idx === 0),
						is_active: true
					})));
				}
			} catch (rowError: any) {
				result.errors.push(`Строка ${rowNum}: ${rowError.message}`);
				result.skipped++;
			}
		}

		// Clear category cache after import
		clearCategoryCache();

		res.json({
			success: true,
			data: {
				total: rows.length,
				created: result.created,
				updated: result.updated,
				skipped: result.skipped,
				errors: result.errors.slice(0, 50) // Limit errors in response
			},
			message: `Импорт завершен: создано ${result.created}, обновлено ${result.updated}, пропущено ${result.skipped}`
		});

	} catch (error: any) {
		clearCategoryCache();
		console.error('Error importing products:', error);
		res.status(500).json({ success: false, error: error.message || 'Internal server error' });
	}
});

/**
 * GET /api/admin/products/import/template - Download import template
 *
 * Variations formats supported:
 * - JSON array: '[{"name":"25см","price":250},{"name":"30см","price":350}]'
 * - Pipe-separated: "25см:250|30см:350" or "25см:250:200|30см:350" (with oldPrice)
 *
 * Category hierarchy:
 * - Use ">" separator for nested categories: "Напитки > Вина > Красные"
 * - Categories are auto-created if they don't exist
 * - Parent categories are created automatically
 */
router.get('/import/template', requireRole('super-admin', 'editor'), (req, res) => {
	const format = req.query.format as string || 'csv';

	if (format === 'json') {
		const template = [
			{
				name: 'Товар без вариаций',
				description: 'Описание товара',
				price: 100.00,
				oldPrice: 120.00,
				quantityInfo: '100г',
				image: '/api/uploads/products/example.webp',
				category: 'Категория',
				sku: 'SKU-001',
				isActive: true,
				showOnHome: false,
				isRecommendation: false
			},
			{
				name: 'Пицца Маргарита',
				description: 'Классическая пицца с томатами и моцареллой',
				price: 450.00,
				image: '/api/uploads/products/pizza.webp',
				category: 'Еда > Пицца',
				sku: 'PIZZA-001',
				isActive: true,
				showOnHome: true,
				isRecommendation: false,
				variationAttribute: 'Размер',
				variations: [
					{ name: '25 см', price: 350, isDefault: true },
					{ name: '30 см', price: 450 },
					{ name: '35 см', price: 550, oldPrice: 600 }
				]
			},
			{
				name: 'Каберне Совиньон',
				description: 'Красное сухое вино',
				price: 1200.00,
				oldPrice: 1500.00,
				category: 'Напитки > Вина > Красные',
				sku: 'WINE-001',
				isActive: true
			}
		];

		res.setHeader('Content-Type', 'application/json');
		res.setHeader('Content-Disposition', 'attachment; filename=import_template.json');
		res.send(JSON.stringify(template, null, 2));
	} else {
		// CSV format with variations and category hierarchy examples
		const csvContent = `name,description,price,oldPrice,quantityInfo,image,category,sku,isActive,showOnHome,isRecommendation,variationAttribute,variations
"Товар без вариаций","Описание товара",100.00,120.00,"100г","/api/uploads/products/example.webp","Категория","SKU-001",true,false,false,,
"Пицца Маргарита","Классическая пицца",450.00,,,"","Еда > Пицца","PIZZA-001",true,true,false,"Размер","25 см:350|30 см:450|35 см:550:600"
"Кофе Латте","Классический латте",200.00,,,,"Напитки > Кофе","COFFEE-001",true,false,false,"Объём","250мл:150|350мл:200|500мл:280"
"Каберне Совиньон","Красное сухое вино",1200.00,1500.00,,,"Напитки > Вина > Красные","WINE-001",true,false,false,,`;

		res.setHeader('Content-Type', 'text/csv; charset=utf-8');
		res.setHeader('Content-Disposition', 'attachment; filename=import_template.csv');
		// Add BOM for Excel compatibility
		res.send('\ufeff' + csvContent);
	}
});

/**
 * POST /api/admin/products/import-zip - Import products from ZIP with images
 * ONLY: super-admin, editor
 *
 * ZIP structure:
 * - products.csv OR products.json (required)
 * - images/ folder with product images (optional)
 *
 * Image matching:
 * - By SKU: images/SKU-001.jpg → product with sku=SKU-001
 * - By row order: images/1.jpg → first product in CSV/JSON
 * - By explicit path in CSV/JSON image field
 */
router.post('/import-zip', requireRole('super-admin', 'editor'), zipImportUpload.single('file'), async (req, res) => {
	try {
		const file = req.file;
		const { mode = 'create_or_update', defaultCategory } = req.body;

		if (!file) {
			return res.status(400).json({ success: false, error: 'ZIP файл не загружен' });
		}

		// Extract ZIP
		const zip = new AdmZip(file.buffer);
		const zipEntries = zip.getEntries();

		// Find data file (CSV or JSON)
		const dataEntry = zipEntries.find(entry => {
			const name = entry.entryName.toLowerCase();
			return (name.endsWith('.csv') || name.endsWith('.json')) &&
				!name.startsWith('__macosx') &&
				!name.includes('/.');
		});

		if (!dataEntry) {
			return res.status(400).json({
				success: false,
				error: 'ZIP архив должен содержать файл products.csv или products.json'
			});
		}

		const dataContent = dataEntry.getData().toString('utf-8');
		const dataExt = path.extname(dataEntry.entryName).toLowerCase();

		// Parse data file
		let rows: ImportProductRow[] = [];
		try {
			if (dataExt === '.json') {
				const parsed = JSON.parse(dataContent);
				rows = Array.isArray(parsed) ? parsed : [parsed];
			} else {
				rows = csvParse(dataContent, {
					columns: true,
					skip_empty_lines: true,
					trim: true,
					bom: true
				});
			}
		} catch (parseError: any) {
			return res.status(400).json({
				success: false,
				error: `Ошибка разбора файла данных: ${parseError.message}`
			});
		}

		if (rows.length === 0) {
			return res.status(400).json({
				success: false,
				error: 'Файл данных пустой'
			});
		}

		// Extract images from ZIP
		const imageEntries = zipEntries.filter(entry => {
			const name = entry.entryName.toLowerCase();
			const isImage = /\.(jpg|jpeg|png|webp|gif)$/i.test(name);
			return isImage && !name.startsWith('__macosx') && !name.includes('/.');
		});

		// Build image map (filename without extension -> entry)
		const imageMap = new Map<string, typeof zipEntries[0]>();
		for (const imgEntry of imageEntries) {
			const basename = path.basename(imgEntry.entryName);
			const nameWithoutExt = basename.replace(/\.(jpg|jpeg|png|webp|gif)$/i, '').toLowerCase();
			imageMap.set(nameWithoutExt, imgEntry);
			// Also map with full basename for exact matches
			imageMap.set(basename.toLowerCase(), imgEntry);
		}

		const result: ImportResult = {
			created: 0,
			updated: 0,
			skipped: 0,
			errors: []
		};

		// Get existing SKUs for update detection
		const existingProducts = await db
			.select({ id: products.id, sku: products.sku })
			.from(products)
			.where(sql`${products.sku} IS NOT NULL`);

		const skuToId = new Map<string, number>();
		for (const p of existingProducts) {
			if (p.sku) {
				skuToId.set(p.sku.toLowerCase(), p.id);
			}
		}

		// Process each row
		for (let i = 0; i < rows.length; i++) {
			const rowNum = i + 1;
			try {
				const normalized = normalizeRow(rows[i]);

				// Validate required fields
				if (!normalized.name) {
					result.errors.push(`Строка ${rowNum}: отсутствует название товара`);
					result.skipped++;
					continue;
				}

				if (normalized.price === null || normalized.price <= 0) {
					result.errors.push(`Строка ${rowNum}: некорректная цена`);
					result.skipped++;
					continue;
				}

				// Try to find image for this product
				let imageUrl = normalized.image;

				if (!imageUrl || imageUrl === '') {
					// Try to find image by SKU
					if (normalized.sku) {
						const imgEntry = imageMap.get(normalized.sku.toLowerCase());
						if (imgEntry) {
							imageUrl = await processAndSaveImage(imgEntry, normalized.sku);
						}
					}

					// Try to find image by row number
					if (!imageUrl) {
						const rowNumEntry = imageMap.get(String(rowNum));
						if (rowNumEntry) {
							imageUrl = await processAndSaveImage(rowNumEntry, `row_${rowNum}`);
						}
					}
				} else if (!imageUrl.startsWith('/') && !imageUrl.startsWith('http')) {
					// Image path is relative - look for it in ZIP
					const imgEntry = imageMap.get(imageUrl.toLowerCase()) ||
						imageMap.get(path.basename(imageUrl).toLowerCase());
					if (imgEntry) {
						imageUrl = await processAndSaveImage(imgEntry, normalized.sku || `row_${rowNum}`);
					}
				}

				// Apply defaults and auto-create category
				const categoryPath = normalized.category || defaultCategory || '';
				const { categoryId, categoryName } = await findOrCreateCategoryByPath(categoryPath);
				const image = imageUrl || '/api/uploads/products/placeholder.webp';

				const productData = {
					name: normalized.name,
					description: normalized.description,
					price: normalized.price,
					old_price: normalized.oldPrice,
					quantity_info: normalized.quantityInfo,
					image: image,
					category: categoryName,
					category_id: categoryId,
					sku: normalized.sku,
					position: normalized.position || 0,
					is_active: normalized.isActive,
					show_on_home: normalized.showOnHome,
					is_recommendation: normalized.isRecommendation,
					variation_attribute: normalized.variationAttribute
				};

				// Check if product exists (by SKU)
				const existingId = normalized.sku ? skuToId.get(normalized.sku.toLowerCase()) : null;
				let productId: number | null = null;

				if (existingId && (mode === 'update_only' || mode === 'create_or_update')) {
					await db
						.update(products)
						.set(productData)
						.where(eq(products.id, existingId));
					productId = existingId;
					result.updated++;
				} else if (mode === 'update_only' && !existingId) {
					result.errors.push(`Строка ${rowNum}: товар с SKU "${normalized.sku}" не найден`);
					result.skipped++;
				} else {
					const [created] = await db.insert(products).values(productData).returning({ id: products.id });
					productId = created.id;
					result.created++;

					if (normalized.sku) {
						skuToId.set(normalized.sku.toLowerCase(), productId);
					}
				}

				// Create variations if product was created/updated and has variations
				if (productId && normalized.variations.length > 0) {
					await db.delete(productVariations).where(eq(productVariations.product_id, productId));
					await createVariationsBulk(productId, normalized.variations.map((v, idx) => ({
						name: v.name,
						price: v.price,
						old_price: v.oldPrice ?? null,
						sku: v.sku ?? null,
						position: idx,
						is_default: v.isDefault ?? (idx === 0),
						is_active: true
					})));
				}
			} catch (rowError: any) {
				result.errors.push(`Строка ${rowNum}: ${rowError.message}`);
				result.skipped++;
			}
		}

		// Clear category cache after import
		clearCategoryCache();

		res.json({
			success: true,
			data: {
				total: rows.length,
				created: result.created,
				updated: result.updated,
				skipped: result.skipped,
				imagesProcessed: imageEntries.length,
				errors: result.errors.slice(0, 50)
			},
			message: `Импорт завершен: создано ${result.created}, обновлено ${result.updated}, пропущено ${result.skipped}`
		});

	} catch (error: any) {
		clearCategoryCache();
		console.error('Error importing ZIP:', error);
		res.status(500).json({ success: false, error: error.message || 'Internal server error' });
	}
});

// Helper: Process image from ZIP and save to uploads
async function processAndSaveImage(entry: AdmZip.IZipEntry, identifier: string): Promise<string> {
	const imageBuffer = entry.getData();

	// Generate unique filename
	const timestamp = Date.now();
	const randomSuffix = Math.random().toString(36).substring(2, 8);
	const filename = `product_${identifier}_${timestamp}_${randomSuffix}.webp`;
	const filepath = path.join(UPLOADS_DIR, filename);

	// Process with sharp: convert to WebP, resize, optimize
	await sharp(imageBuffer)
		.resize(800, 800, {
			fit: 'inside',
			withoutEnlargement: true
		})
		.webp({ quality: 85 })
		.toFile(filepath);

	return `/api/uploads/products/${filename}`;
}

// =====================================================
// PRODUCT VARIATIONS API
// =====================================================

/**
 * GET /api/admin/products/:id/variations - Get all variations for a product
 */
router.get('/:id/variations', async (req, res) => {
	try {
		const productId = parseInt(req.params.id);
		const variations = await getVariationsByProductId(productId);

		res.json({
			success: true,
			data: {
				variations: variations.map(v => ({
					id: v.id,
					name: v.name,
					price: v.price,
					oldPrice: v.old_price,
					sku: v.sku,
					position: v.position,
					isDefault: Boolean(v.is_default),
					isActive: Boolean(v.is_active)
				}))
			}
		});
	} catch (error: any) {
		console.error('Error fetching variations:', error);
		res.status(500).json({ success: false, error: 'Internal server error' });
	}
});

/**
 * POST /api/admin/products/:id/variations - Create a new variation
 * ONLY: super-admin, editor
 */
router.post('/:id/variations', requireRole('super-admin', 'editor'), async (req, res) => {
	try {
		const productId = parseInt(req.params.id);
		const { name, price, oldPrice, sku, position, isDefault, isActive } = req.body;

		if (!name || typeof price !== 'number' || price <= 0) {
			return res.status(400).json({
				success: false,
				error: 'Название и цена обязательны'
			});
		}

		const variation = await createVariation({
			product_id: productId,
			name,
			price,
			old_price: oldPrice ?? null,
			sku: sku ?? null,
			position: position ?? 0,
			is_default: isDefault ?? false,
			is_active: isActive ?? true
		});

		res.status(201).json({
			success: true,
			data: {
				id: variation.id,
				name: variation.name,
				price: variation.price,
				oldPrice: variation.old_price,
				sku: variation.sku,
				position: variation.position,
				isDefault: Boolean(variation.is_default),
				isActive: Boolean(variation.is_active)
			}
		});
	} catch (error: any) {
		console.error('Error creating variation:', error);
		res.status(500).json({ success: false, error: 'Internal server error' });
	}
});

/**
 * PUT /api/admin/products/:id/variations/:variationId - Update a variation
 * ONLY: super-admin, editor
 */
router.put('/:id/variations/:variationId', requireRole('super-admin', 'editor'), async (req, res) => {
	try {
		const variationId = parseInt(req.params.variationId);
		const { name, price, oldPrice, sku, position, isDefault, isActive } = req.body;

		const variation = await updateVariation(variationId, {
			name,
			price,
			old_price: oldPrice,
			sku,
			position,
			is_default: isDefault,
			is_active: isActive
		});

		if (!variation) {
			return res.status(404).json({ success: false, error: 'Вариация не найдена' });
		}

		res.json({
			success: true,
			data: {
				id: variation.id,
				name: variation.name,
				price: variation.price,
				oldPrice: variation.old_price,
				sku: variation.sku,
				position: variation.position,
				isDefault: Boolean(variation.is_default),
				isActive: Boolean(variation.is_active)
			}
		});
	} catch (error: any) {
		console.error('Error updating variation:', error);
		res.status(500).json({ success: false, error: 'Internal server error' });
	}
});

/**
 * DELETE /api/admin/products/:id/variations/:variationId - Delete a variation
 * ONLY: super-admin
 */
router.delete('/:id/variations/:variationId', requireRole('super-admin'), async (req, res) => {
	try {
		const variationId = parseInt(req.params.variationId);

		const deleted = await deleteVariation(variationId);

		if (!deleted) {
			return res.status(404).json({ success: false, error: 'Вариация не найдена' });
		}

		res.json({ success: true, message: 'Вариация удалена' });
	} catch (error: any) {
		console.error('Error deleting variation:', error);
		res.status(500).json({ success: false, error: 'Internal server error' });
	}
});

/**
 * PUT /api/admin/products/:id/variations/reorder - Reorder variations
 * ONLY: super-admin, editor
 */
router.put('/:id/variations/reorder', requireRole('super-admin', 'editor'), async (req, res) => {
	try {
		const productId = parseInt(req.params.id);
		const { orderedIds } = req.body;

		if (!Array.isArray(orderedIds)) {
			return res.status(400).json({
				success: false,
				error: 'orderedIds должен быть массивом'
			});
		}

		await updateVariationsOrder(productId, orderedIds);

		res.json({ success: true, message: 'Порядок обновлен' });
	} catch (error: any) {
		console.error('Error reordering variations:', error);
		res.status(500).json({ success: false, error: 'Internal server error' });
	}
});

export default router;
