/**
 * Categories API (Real Backend)
 */

import type { Category, CategoryFormData } from '$lib/types/admin';
import { API_BASE_URL } from '$lib/config';

const buildQuery = (params: Record<string, any>): string => {
	const filtered = Object.fromEntries(
		Object.entries(params).filter(([_, v]) => v !== undefined && v !== null && v !== '')
	);
	return new URLSearchParams(filtered as any).toString();
};

export interface CategoriesListParams {
	search?: string;
	status?: 'all' | 'active' | 'inactive';
	parent?: 'root' | 'all' | number;
}

export const categoriesAPI = {
	async list(params: CategoriesListParams = {}) {
		const query = buildQuery(params);
		const response = await fetch(`${API_BASE_URL}/admin/categories?${query}`, { credentials: 'include' });
		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`Failed to fetch categories: ${response.status} ${errorText}`);
		}
		const json = await response.json();
		if (!json.success) throw new Error(json.error || 'Unknown error');
		return json.data as { categories: Category[]; total: number };
	},

	async get(id: number) {
		const response = await fetch(`${API_BASE_URL}/admin/categories/${id}`, { credentials: 'include' });
		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`Failed to fetch category: ${response.status} ${errorText}`);
		}
		const json = await response.json();
		if (!json.success) throw new Error(json.error || 'Unknown error');
		return json.data as Category & { productCount: number; subcategories: Category[] };
	},

	async create(data: CategoryFormData) {
		const response = await fetch(`${API_BASE_URL}/admin/categories`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(data),
			credentials: 'include'
		});
		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`Failed to create category: ${response.status} ${errorText}`);
		}
		const json = await response.json();
		if (!json.success) throw new Error(json.error || 'Unknown error');
		return json.data as Category;
	},

	async update(id: number, data: CategoryFormData) {
		const response = await fetch(`${API_BASE_URL}/admin/categories/${id}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(data),
			credentials: 'include'
		});
		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`Failed to update category: ${response.status} ${errorText}`);
		}
		const json = await response.json();
		if (!json.success) throw new Error(json.error || 'Unknown error');
		return json.data as Category;
	},

	async delete(id: number, soft = true) {
		const response = await fetch(`${API_BASE_URL}/admin/categories/${id}?soft=${soft}`, {
			method: 'DELETE',
			credentials: 'include'
		});
		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`Failed to delete category: ${response.status} ${errorText}`);
		}
		const json = await response.json();
		if (!json.success) throw new Error(json.error || 'Unknown error');
	},

	async toggleActive(id: number, isActive: boolean) {
		const response = await fetch(`${API_BASE_URL}/admin/categories/${id}/toggle-active`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ isActive }),
			credentials: 'include'
		});
		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`Failed to toggle category: ${response.status} ${errorText}`);
		}
		const json = await response.json();
		if (!json.success) throw new Error(json.error || 'Unknown error');
	},

	async reorder(items: { id: number; position: number }[]) {
		const response = await fetch(`${API_BASE_URL}/admin/categories/reorder`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ items }),
			credentials: 'include'
		});
		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`Failed to reorder categories: ${response.status} ${errorText}`);
		}
		const json = await response.json();
		if (!json.success) throw new Error(json.error || 'Unknown error');
	},

	async uploadImage(file: File) {
		const formData = new FormData();
		formData.append('image', file);

		const response = await fetch(`${API_BASE_URL}/admin/categories/upload`, {
			method: 'POST',
			body: formData,
			credentials: 'include'
		});
		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`Failed to upload image: ${response.status} ${errorText}`);
		}
		const json = await response.json();
		if (!json.success) throw new Error(json.error || 'Unknown error');
		return json.data as { url: string; filename: string };
	}
};
