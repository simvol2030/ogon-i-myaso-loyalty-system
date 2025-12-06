/**
 * API клиент для работы с триггерами рассылок
 */

import { API_BASE_URL } from '$lib/config';

export interface TriggerTemplate {
	id: number;
	name: string;
	description: string | null;
	eventType: string;
	eventTypeName: string;
	eventConfig: Record<string, any> | null;
	messageTemplate: string;
	imageUrl: string | null;
	buttonText: string | null;
	buttonUrl: string | null;
	isActive: boolean;
	autoSend: boolean;
	createdAt: string;
	updatedAt: string;
}

export interface EventTypeInfo {
	type: string;
	name: string;
	description: string;
	configFields: string[];
}

export interface TriggerLog {
	id: number;
	triggerId: number;
	campaignId: number | null;
	userId: number | null;
	userName: string | null;
	eventData: Record<string, any> | null;
	status: 'triggered' | 'campaign_created' | 'skipped' | 'error';
	error: string | null;
	createdAt: string;
}

export interface CreateTriggerData {
	name: string;
	description?: string | null;
	eventType: string;
	eventConfig?: Record<string, any> | null;
	messageTemplate: string;
	imageUrl?: string | null;
	buttonText?: string | null;
	buttonUrl?: string | null;
	isActive?: boolean;
	autoSend?: boolean;
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

export const triggersAPI = {
	/**
	 * Получить типы событий
	 */
	async getEventTypes() {
		const data = await fetchWithSession(`${API_BASE_URL}/admin/triggers/event-types`);
		return data.data as EventTypeInfo[];
	},

	/**
	 * Получить список триггеров
	 */
	async getAll(params?: { isActive?: boolean }) {
		const query = new URLSearchParams();
		if (params?.isActive !== undefined) query.set('isActive', String(params.isActive));

		const data = await fetchWithSession(`${API_BASE_URL}/admin/triggers?${query}`);
		return data.data as { triggers: TriggerTemplate[] };
	},

	/**
	 * Получить триггер по ID
	 */
	async getById(id: number) {
		const data = await fetchWithSession(`${API_BASE_URL}/admin/triggers/${id}`);
		return data.data as TriggerTemplate & { stats: Record<string, number> };
	},

	/**
	 * Создать триггер
	 */
	async create(triggerData: CreateTriggerData) {
		const data = await fetchWithSession(`${API_BASE_URL}/admin/triggers`, {
			method: 'POST',
			body: JSON.stringify(triggerData)
		});
		return data.data;
	},

	/**
	 * Обновить триггер
	 */
	async update(id: number, triggerData: Partial<CreateTriggerData>) {
		const data = await fetchWithSession(`${API_BASE_URL}/admin/triggers/${id}`, {
			method: 'PUT',
			body: JSON.stringify(triggerData)
		});
		return data.data;
	},

	/**
	 * Удалить триггер
	 */
	async delete(id: number) {
		const data = await fetchWithSession(`${API_BASE_URL}/admin/triggers/${id}`, {
			method: 'DELETE'
		});
		return data;
	},

	/**
	 * Включить/выключить триггер
	 */
	async toggle(id: number, isActive: boolean) {
		const data = await fetchWithSession(`${API_BASE_URL}/admin/triggers/${id}/toggle`, {
			method: 'PATCH',
			body: JSON.stringify({ isActive })
		});
		return data.data;
	},

	/**
	 * Получить логи триггера
	 */
	async getLogs(id: number, params?: { page?: number; limit?: number }) {
		const query = new URLSearchParams();
		if (params?.page) query.set('page', String(params.page));
		if (params?.limit) query.set('limit', String(params.limit));

		const data = await fetchWithSession(`${API_BASE_URL}/admin/triggers/${id}/logs?${query}`);
		return data.data;
	}
};
