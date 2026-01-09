/**
 * Admin API client for delivery locations management
 */

const API_BASE = '/api/admin/delivery-locations';

// Helper for fetch with credentials
async function fetchWithCredentials(url: string, options: RequestInit = {}): Promise<Response> {
	return fetch(url, {
		...options,
		credentials: 'include',
		headers: {
			'Content-Type': 'application/json',
			...options.headers
		}
	});
}

export interface DeliveryLocation {
	id: number;
	name: string;
	price: number; // kopeks
	free_delivery_threshold: number | null; // rubles, null = not participating
	is_enabled: boolean;
	created_at: string;
	updated_at: string;
}

export interface DeliveryLocationsResponse {
	success: boolean;
	data: DeliveryLocation[];
	pagination: {
		page: number;
		limit: number;
		total: number;
		totalPages: number;
	};
}

export interface CreateLocationData {
	name: string;
	price: number; // kopeks
	is_enabled?: boolean;
	free_delivery_threshold?: number | null; // rubles
}

export interface UpdateLocationData {
	name?: string;
	price?: number; // kopeks
	is_enabled?: boolean;
	free_delivery_threshold?: number | null; // rubles
}

export const deliveryLocationsAPI = {
	/**
	 * Get paginated list of delivery locations
	 */
	async list(params?: {
		page?: number;
		limit?: number;
		search?: string;
		enabled?: boolean;
	}): Promise<DeliveryLocationsResponse> {
		const queryParams = new URLSearchParams();

		if (params?.page) queryParams.set('page', params.page.toString());
		if (params?.limit) queryParams.set('limit', params.limit.toString());
		if (params?.search) queryParams.set('search', params.search);
		if (params?.enabled !== undefined) queryParams.set('enabled', params.enabled.toString());

		const url = `${API_BASE}?${queryParams.toString()}`;
		const response = await fetchWithCredentials(url);

		if (!response.ok) {
			const data = await response.json();
			throw new Error(data.error || 'Failed to fetch delivery locations');
		}

		return response.json();
	},

	/**
	 * Create new delivery location
	 */
	async create(data: CreateLocationData): Promise<DeliveryLocation> {
		const response = await fetchWithCredentials(API_BASE, {
			method: 'POST',
			body: JSON.stringify(data)
		});

		const result = await response.json();

		if (!response.ok) {
			throw new Error(result.error || 'Failed to create delivery location');
		}

		return result.data;
	},

	/**
	 * Update delivery location
	 */
	async update(id: number, data: UpdateLocationData): Promise<DeliveryLocation> {
		const response = await fetchWithCredentials(`${API_BASE}/${id}`, {
			method: 'PUT',
			body: JSON.stringify(data)
		});

		const result = await response.json();

		if (!response.ok) {
			throw new Error(result.error || 'Failed to update delivery location');
		}

		return result.data;
	},

	/**
	 * Delete delivery location
	 */
	async delete(id: number): Promise<void> {
		const response = await fetchWithCredentials(`${API_BASE}/${id}`, {
			method: 'DELETE'
		});

		const result = await response.json();

		if (!response.ok) {
			throw new Error(result.error || 'Failed to delete delivery location');
		}
	},

	/**
	 * Toggle enabled status
	 */
	async toggle(id: number): Promise<DeliveryLocation> {
		const response = await fetchWithCredentials(`${API_BASE}/${id}/toggle`, {
			method: 'PATCH'
		});

		const result = await response.json();

		if (!response.ok) {
			throw new Error(result.error || 'Failed to toggle delivery location');
		}

		return result.data;
	}
};
