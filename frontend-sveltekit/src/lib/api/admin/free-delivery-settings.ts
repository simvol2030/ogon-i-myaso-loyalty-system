/**
 * Admin API client for free delivery settings management
 */

const API_BASE = '/api/admin/free-delivery-settings';

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

export interface LocationWithThreshold {
	id: number;
	name: string;
	price: number;
	free_delivery_threshold: number | null;
	is_enabled: boolean;
}

export interface FreeDeliverySettings {
	id: number;
	is_enabled: boolean;
	default_threshold: number;
	widget_enabled: boolean;
	widget_title: string;
	widget_text: string;
	widget_icon: string;
	toast_enabled: boolean;
	toast_text: string;
	toast_show_threshold: number;
	updated_at: string;
	locations_with_threshold: LocationWithThreshold[];
}

export interface UpdateFreeDeliverySettingsData {
	is_enabled?: boolean;
	default_threshold?: number;
	widget_enabled?: boolean;
	widget_title?: string;
	widget_text?: string;
	widget_icon?: string;
	toast_enabled?: boolean;
	toast_text?: string;
	toast_show_threshold?: number;
}

export const freeDeliverySettingsAPI = {
	/**
	 * Get free delivery settings
	 */
	async get(): Promise<FreeDeliverySettings> {
		const response = await fetchWithCredentials(API_BASE);

		if (!response.ok) {
			const data = await response.json();
			throw new Error(data.error || 'Failed to fetch free delivery settings');
		}

		const result = await response.json();
		return result.data;
	},

	/**
	 * Update free delivery settings
	 */
	async update(data: UpdateFreeDeliverySettingsData): Promise<FreeDeliverySettings> {
		const response = await fetchWithCredentials(API_BASE, {
			method: 'PUT',
			body: JSON.stringify(data)
		});

		const result = await response.json();

		if (!response.ok) {
			throw new Error(result.error || 'Failed to update free delivery settings');
		}

		return result.data;
	}
};
