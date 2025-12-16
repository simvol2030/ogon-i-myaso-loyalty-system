/**
 * Products API (Real Backend)
 */

import type { Product, ProductFormData, ProductsListParams, ProductCategory, Pagination } from '$lib/types/admin';
import { API_BASE_URL } from '$lib/config';

const buildQuery = (params: Record<string, any>): string => {
	const filtered = Object.fromEntries(
		Object.entries(params).filter(([_, v]) => v !== undefined && v !== null && v !== '')
	);
	return new URLSearchParams(filtered as any).toString();
};

export const productsAPI = {
	async list(params: ProductsListParams = {}) {
		const query = buildQuery(params);
		const response = await fetch(`${API_BASE_URL}/admin/products?${query}`, { credentials: 'include' });
		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`Failed to fetch products: ${response.status} ${errorText}`);
		}
		const json = await response.json();
		if (!json.success) throw new Error(json.error || 'Unknown error');
		return json.data as { products: Product[]; pagination: Pagination };
	},

	async getCategories() {
		const response = await fetch(`${API_BASE_URL}/admin/products/categories`, { credentials: 'include' });
		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`Failed to fetch categories: ${response.status} ${errorText}`);
		}
		const json = await response.json();
		if (!json.success) throw new Error(json.error || 'Unknown error');
		return json.data.categories as ProductCategory[];
	},

	async create(data: ProductFormData) {
		const response = await fetch(`${API_BASE_URL}/admin/products`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(data),
			credentials: 'include'
		});
		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`Failed to create product: ${response.status} ${errorText}`);
		}
		const json = await response.json();
		if (!json.success) throw new Error(json.error || 'Unknown error');
		return json.data as Product;
	},

	async update(id: number, data: ProductFormData) {
		const response = await fetch(`${API_BASE_URL}/admin/products/${id}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(data),
			credentials: 'include'
		});
		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`Failed to update product: ${response.status} ${errorText}`);
		}
		const json = await response.json();
		if (!json.success) throw new Error(json.error || 'Unknown error');
		return json.data as Product;
	},

	async delete(id: number, soft = true) {
		const response = await fetch(`${API_BASE_URL}/admin/products/${id}?soft=${soft}`, {
			method: 'DELETE',
			credentials: 'include'
		});
		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`Failed to delete product: ${response.status} ${errorText}`);
		}
		const json = await response.json();
		if (!json.success) throw new Error(json.error || 'Unknown error');
	},

	async toggleActive(id: number, isActive: boolean) {
		const response = await fetch(`${API_BASE_URL}/admin/products/${id}/toggle-active`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ isActive }),
			credentials: 'include'
		});
		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`Failed to toggle product active status: ${response.status} ${errorText}`);
		}
		const json = await response.json();
		if (!json.success) throw new Error(json.error || 'Unknown error');
	},

	/**
	 * Import products from CSV/JSON file
	 */
	async importProducts(
		file: File,
		options: {
			mode?: 'create_only' | 'update_only' | 'create_or_update';
			defaultCategory?: string;
			defaultImage?: string;
		} = {}
	): Promise<ImportResult> {
		const formData = new FormData();
		formData.append('file', file);

		if (options.mode) formData.append('mode', options.mode);
		if (options.defaultCategory) formData.append('defaultCategory', options.defaultCategory);
		if (options.defaultImage) formData.append('defaultImage', options.defaultImage);

		const response = await fetch(`${API_BASE_URL}/admin/products/import`, {
			method: 'POST',
			body: formData,
			credentials: 'include'
		});

		if (!response.ok) {
			const errorText = await response.text();
			try {
				const json = JSON.parse(errorText);
				throw new Error(json.error || 'Import failed');
			} catch {
				throw new Error(`Import failed: ${response.status}`);
			}
		}

		const json = await response.json();
		if (!json.success) throw new Error(json.error || 'Unknown error');
		return json.data as ImportResult;
	},

	/**
	 * Download import template
	 */
	getTemplateUrl(format: 'csv' | 'json' = 'csv'): string {
		return `${API_BASE_URL}/admin/products/import/template?format=${format}`;
	},

	/**
	 * Upload ZIP archive with images
	 * Returns mapping of filenames to URLs
	 */
	async uploadImagesZip(file: File): Promise<ZipUploadResult> {
		const formData = new FormData();
		formData.append('file', file);

		const response = await fetch(`${API_BASE_URL}/admin/products/import-zip`, {
			method: 'POST',
			body: formData,
			credentials: 'include'
		});

		if (!response.ok) {
			const errorText = await response.text();
			try {
				const json = JSON.parse(errorText);
				throw new Error(json.error || 'ZIP upload failed');
			} catch {
				throw new Error(`ZIP upload failed: ${response.status}`);
			}
		}

		const json = await response.json();
		if (!json.success) throw new Error(json.error || 'Unknown error');
		return json.data as ZipUploadResult;
	}
};

export interface ImportResult {
	total: number;
	created: number;
	updated: number;
	skipped: number;
	errors: string[];
}

export interface ZipUploadResult {
	total: number;
	processed: number;
	images: { filename: string; url: string }[];
	errors: string[];
}
