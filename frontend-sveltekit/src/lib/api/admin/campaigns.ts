/**
 * API клиент для работы с рассылками (campaigns)
 */

import { API_BASE_URL } from '$lib/config';

export interface Campaign {
	id: number;
	title: string;
	messageText: string;
	messageImage: string | null;
	buttonText: string | null;
	buttonUrl: string | null;
	offerId: number | null;
	targetType: 'all' | 'segment';
	targetFilters: SegmentFilters | null;
	triggerType: 'manual' | 'scheduled' | 'event';
	triggerConfig: Record<string, any> | null;
	status: 'draft' | 'scheduled' | 'sending' | 'completed' | 'cancelled';
	scheduledAt: string | null;
	startedAt: string | null;
	completedAt: string | null;
	totalRecipients: number;
	sentCount: number;
	deliveredCount: number;
	failedCount: number;
	createdAt: string;
	updatedAt: string;
}

export interface SegmentFilters {
	store_ids?: number[];
	balance_min?: number;
	balance_max?: number;
	inactive_days?: number;
	active_last_days?: number;
	registration_after?: string;
	registration_before?: string;
	total_purchases_min?: number;
	total_purchases_max?: number;
	has_birthday?: boolean;
	birthday_month?: number;
	is_active?: boolean;
}

export interface CampaignRecipient {
	id: number;
	userId: number;
	userName: string;
	status: 'pending' | 'sent' | 'delivered' | 'failed';
	sentAt: string | null;
	error: string | null;
}

export interface CreateCampaignData {
	title: string;
	messageText: string;
	messageImage?: string | null;
	buttonText?: string | null;
	buttonUrl?: string | null;
	offerId?: number | null;
	targetType: 'all' | 'segment';
	targetFilters?: SegmentFilters | null;
	triggerType: 'manual' | 'scheduled' | 'event';
	triggerConfig?: Record<string, any> | null;
	scheduledAt?: string | null;
}

async function fetchWithSession(url: string, options: RequestInit = {}) {
	const response = await fetch(url, {
		...options,
		credentials: 'include',
		headers: {
			'Content-Type': 'application/json',
			...options.headers
		}
	});

	const data = await response.json();

	if (!data.success) {
		throw new Error(data.error || 'API request failed');
	}

	return data;
}

export const campaignsAPI = {
	/**
	 * Получить список кампаний
	 */
	async getAll(params?: { status?: string; page?: number; limit?: number }) {
		const query = new URLSearchParams();
		if (params?.status) query.set('status', params.status);
		if (params?.page) query.set('page', String(params.page));
		if (params?.limit) query.set('limit', String(params.limit));

		const data = await fetchWithSession(`${API_BASE_URL}/admin/campaigns?${query}`);
		return data.data as { campaigns: Campaign[]; pagination: { page: number; limit: number; total: number; totalPages: number } };
	},

	/**
	 * Получить кампанию по ID
	 */
	async getById(id: number) {
		const data = await fetchWithSession(`${API_BASE_URL}/admin/campaigns/${id}`);
		return data.data as Campaign & { stats: Record<string, number> };
	},

	/**
	 * Создать кампанию
	 */
	async create(campaignData: CreateCampaignData) {
		const data = await fetchWithSession(`${API_BASE_URL}/admin/campaigns`, {
			method: 'POST',
			body: JSON.stringify(campaignData)
		});
		return data.data;
	},

	/**
	 * Обновить кампанию
	 */
	async update(id: number, campaignData: Partial<CreateCampaignData>) {
		const data = await fetchWithSession(`${API_BASE_URL}/admin/campaigns/${id}`, {
			method: 'PUT',
			body: JSON.stringify(campaignData)
		});
		return data.data;
	},

	/**
	 * Удалить кампанию
	 */
	async delete(id: number) {
		const data = await fetchWithSession(`${API_BASE_URL}/admin/campaigns/${id}`, {
			method: 'DELETE'
		});
		return data;
	},

	/**
	 * Запустить отправку кампании
	 */
	async send(id: number): Promise<{ sent: number; failed: number; total: number }> {
		const data = await fetchWithSession(`${API_BASE_URL}/admin/campaigns/${id}/send`, {
			method: 'POST'
		});
		return data.data as { sent: number; failed: number; total: number };
	},

	/**
	 * Запланировать кампанию
	 */
	async schedule(id: number, scheduledAt: string) {
		const data = await fetchWithSession(`${API_BASE_URL}/admin/campaigns/${id}/schedule`, {
			method: 'POST',
			body: JSON.stringify({ scheduledAt })
		});
		return data;
	},

	/**
	 * Отменить кампанию
	 */
	async cancel(id: number) {
		const data = await fetchWithSession(`${API_BASE_URL}/admin/campaigns/${id}/cancel`, {
			method: 'POST'
		});
		return data;
	},

	/**
	 * Получить получателей кампании
	 */
	async getRecipients(id: number, params?: { status?: string; page?: number; limit?: number }) {
		const query = new URLSearchParams();
		if (params?.status) query.set('status', params.status);
		if (params?.page) query.set('page', String(params.page));
		if (params?.limit) query.set('limit', String(params.limit));

		const data = await fetchWithSession(`${API_BASE_URL}/admin/campaigns/${id}/recipients?${query}`);
		return data.data;
	},

	/**
	 * Превью аудитории по фильтрам
	 */
	async previewAudience(targetType: 'all' | 'segment', targetFilters?: SegmentFilters) {
		const data = await fetchWithSession(`${API_BASE_URL}/admin/campaigns/preview-audience`, {
			method: 'POST',
			body: JSON.stringify({ targetType, targetFilters })
		});
		return data.data as { count: number };
	},

	/**
	 * Загрузить изображение
	 */
	async uploadImage(file: File) {
		const formData = new FormData();
		formData.append('image', file);

		const response = await fetch(`${API_BASE_URL}/admin/campaigns/images/upload`, {
			method: 'POST',
			credentials: 'include',
			body: formData
		});

		const data = await response.json();
		if (!data.success) {
			throw new Error(data.error || 'Failed to upload image');
		}

		return data.data as { id: number; url: string; filename: string };
	}
};
