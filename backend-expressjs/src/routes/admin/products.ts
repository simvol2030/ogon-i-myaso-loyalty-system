/**
 * Admin API: Products Management
 * Based on API-CONTRACT-Products.md
 */

import { Router } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { db } from '../../db/client';
import { products, categories } from '../../db/schema';
import { eq, and, desc, like, sql, asc } from 'drizzle-orm';
import { authenticateSession, requireRole } from '../../middleware/session-auth';
import { validateProductData } from '../../utils/validation';
import { parse as csvParse } from 'csv-parse/sync';

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

		const productsData = dbProducts.map((p) => ({
			id: p.id,
			name: p.name,
			description: p.description,
			price: p.price,
			oldPrice: p.old_price,
			quantityInfo: p.quantity_info,
			image: p.image,
			category: p.category,
			categoryId: p.category_id, // Shop extension
			sku: p.sku, // Shop extension
			position: p.position, // Shop extension
			isActive: Boolean(p.is_active),
			showOnHome: Boolean(p.show_on_home),
			isRecommendation: Boolean(p.is_recommendation)
		}));

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
			category, categoryId, sku, // Shop extension
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
				category_id: categoryId || null, // Shop extension
				sku: sku || null, // Shop extension
				is_active: isActive,
				show_on_home: showOnHome,
				is_recommendation: isRecommendation
			})
			.returning();

		const created = result[0];

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
				categoryId: created.category_id, // Shop extension
				sku: created.sku, // Shop extension
				isActive: Boolean(created.is_active),
				showOnHome: Boolean(created.show_on_home),
				isRecommendation: Boolean(created.is_recommendation)
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
			category, categoryId, sku, // Shop extension
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
				category_id: categoryId !== undefined ? categoryId : undefined, // Shop extension
				sku: sku !== undefined ? sku : undefined, // Shop extension
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
				categoryId: updated.category_id, // Shop extension
				sku: updated.sku, // Shop extension
				isActive: Boolean(updated.is_active),
				showOnHome: Boolean(updated.show_on_home),
				isRecommendation: Boolean(updated.is_recommendation)
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
		isRecommendation: parseBoolean(row.isRecommendation ?? row.is_recommendation ?? false)
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

				// Apply defaults
				const category = normalized.category || defaultCategory || 'Без категории';
				const image = normalized.image || defaultImage || '/api/uploads/products/placeholder.webp';

				const productData = {
					name: normalized.name,
					description: normalized.description,
					price: normalized.price,
					old_price: normalized.oldPrice,
					quantity_info: normalized.quantityInfo,
					image: image,
					category: category,
					category_id: normalized.categoryId,
					sku: normalized.sku,
					position: normalized.position || 0,
					is_active: normalized.isActive,
					show_on_home: normalized.showOnHome,
					is_recommendation: normalized.isRecommendation
				};

				// Check if product exists (by SKU)
				const existingId = normalized.sku ? skuToId.get(normalized.sku.toLowerCase()) : null;

				if (existingId && (mode === 'update_only' || mode === 'create_or_update')) {
					// Update existing product
					await db
						.update(products)
						.set(productData)
						.where(eq(products.id, existingId));
					result.updated++;
				} else if (mode === 'update_only' && !existingId) {
					// Skip - update only mode but product doesn't exist
					result.errors.push(`Строка ${rowNum}: товар с SKU "${normalized.sku}" не найден`);
					result.skipped++;
				} else {
					// Create new product
					await db.insert(products).values(productData);
					result.created++;

					// Add new SKU to map to prevent duplicates in same import
					if (normalized.sku) {
						const [newProduct] = await db
							.select({ id: products.id })
							.from(products)
							.where(eq(products.sku, normalized.sku))
							.limit(1);
						if (newProduct) {
							skuToId.set(normalized.sku.toLowerCase(), newProduct.id);
						}
					}
				}
			} catch (rowError: any) {
				result.errors.push(`Строка ${rowNum}: ${rowError.message}`);
				result.skipped++;
			}
		}

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
		console.error('Error importing products:', error);
		res.status(500).json({ success: false, error: error.message || 'Internal server error' });
	}
});

/**
 * GET /api/admin/products/import/template - Download import template
 */
router.get('/import/template', requireRole('super-admin', 'editor'), (req, res) => {
	const format = req.query.format as string || 'csv';

	if (format === 'json') {
		const template = [
			{
				name: 'Пример товара',
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
			}
		];

		res.setHeader('Content-Type', 'application/json');
		res.setHeader('Content-Disposition', 'attachment; filename=import_template.json');
		res.send(JSON.stringify(template, null, 2));
	} else {
		const csvContent = `name,description,price,oldPrice,quantityInfo,image,category,sku,isActive,showOnHome,isRecommendation
"Пример товара","Описание товара",100.00,120.00,"100г","/api/uploads/products/example.webp","Категория","SKU-001",true,false,false`;

		res.setHeader('Content-Type', 'text/csv; charset=utf-8');
		res.setHeader('Content-Disposition', 'attachment; filename=import_template.csv');
		// Add BOM for Excel compatibility
		res.send('\ufeff' + csvContent);
	}
});

export default router;
