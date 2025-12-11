/**
 * Stories Admin API Client
 * Клиент для управления Web Stories в админке
 */

import type {
	StoriesHighlight,
	StoriesHighlightFormData,
	StoriesHighlightWithItems,
	StoryItem,
	StoryItemFormData,
	StoriesSettings,
	StoriesAnalytics,
	HighlightAnalytics,
	StoriesListResponse,
	UploadMediaResponse,
	BulkStatusUpdate,
	ReorderItem
} from '$lib/types/stories';

// Use relative URL for client-side requests (proxied via SvelteKit)
const API_BASE_URL = '';

// =====================================================
// HELPERS
// =====================================================

async function handleResponse<T>(response: Response): Promise<T> {
	const json = await response.json();

	if (!response.ok || !json.success) {
		throw new Error(json.error || `HTTP error: ${response.status}`);
	}

	return json.data;
}

// =====================================================
// HIGHLIGHTS API
// =====================================================

export const highlightsAPI = {
	/**
	 * Get list of highlights
	 */
	async list(params: { page?: number; limit?: number; includeInactive?: boolean } = {}): Promise<StoriesListResponse> {
		const query = new URLSearchParams();
		if (params.page) query.set('page', params.page.toString());
		if (params.limit) query.set('limit', params.limit.toString());
		if (params.includeInactive) query.set('includeInactive', 'true');

		const response = await fetch(`${API_BASE_URL}/api/admin/stories/highlights?${query}`, {
			credentials: 'include'
		});

		return handleResponse(response);
	},

	/**
	 * Get single highlight with items
	 */
	async getById(id: number): Promise<StoriesHighlightWithItems> {
		const response = await fetch(`${API_BASE_URL}/api/admin/stories/highlights/${id}`, {
			credentials: 'include'
		});

		return handleResponse(response);
	},

	/**
	 * Create new highlight
	 */
	async create(data: StoriesHighlightFormData): Promise<StoriesHighlight> {
		const response = await fetch(`${API_BASE_URL}/api/admin/stories/highlights`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			credentials: 'include',
			body: JSON.stringify(data)
		});

		return handleResponse(response);
	},

	/**
	 * Update highlight
	 */
	async update(id: number, data: Partial<StoriesHighlightFormData>): Promise<StoriesHighlight> {
		const response = await fetch(`${API_BASE_URL}/api/admin/stories/highlights/${id}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			credentials: 'include',
			body: JSON.stringify(data)
		});

		return handleResponse(response);
	},

	/**
	 * Delete highlight
	 */
	async delete(id: number): Promise<void> {
		const response = await fetch(`${API_BASE_URL}/api/admin/stories/highlights/${id}`, {
			method: 'DELETE',
			credentials: 'include'
		});

		await handleResponse(response);
	},

	/**
	 * Duplicate highlight with all items
	 */
	async duplicate(id: number): Promise<StoriesHighlight> {
		const response = await fetch(`${API_BASE_URL}/api/admin/stories/highlights/${id}/duplicate`, {
			method: 'POST',
			credentials: 'include'
		});

		return handleResponse(response);
	},

	/**
	 * Reorder highlights
	 */
	async reorder(items: ReorderItem[]): Promise<void> {
		const response = await fetch(`${API_BASE_URL}/api/admin/stories/highlights/reorder`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			credentials: 'include',
			body: JSON.stringify({ items })
		});

		await handleResponse(response);
	},

	/**
	 * Bulk enable/disable highlights
	 */
	async bulkStatus(data: BulkStatusUpdate): Promise<{ updated: number }> {
		const response = await fetch(`${API_BASE_URL}/api/admin/stories/highlights/bulk-status`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			credentials: 'include',
			body: JSON.stringify(data)
		});

		return handleResponse(response);
	}
};

// =====================================================
// STORY ITEMS API
// =====================================================

export const itemsAPI = {
	/**
	 * Get items for highlight
	 */
	async listByHighlight(highlightId: number): Promise<StoryItem[]> {
		const response = await fetch(`${API_BASE_URL}/api/admin/stories/highlights/${highlightId}/items`, {
			credentials: 'include'
		});

		return handleResponse(response);
	},

	/**
	 * Create new item
	 */
	async create(data: StoryItemFormData): Promise<StoryItem> {
		const response = await fetch(`${API_BASE_URL}/api/admin/stories/items`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			credentials: 'include',
			body: JSON.stringify(data)
		});

		return handleResponse(response);
	},

	/**
	 * Update item
	 */
	async update(id: number, data: Partial<StoryItemFormData>): Promise<StoryItem> {
		const response = await fetch(`${API_BASE_URL}/api/admin/stories/items/${id}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			credentials: 'include',
			body: JSON.stringify(data)
		});

		return handleResponse(response);
	},

	/**
	 * Delete item
	 */
	async delete(id: number): Promise<void> {
		const response = await fetch(`${API_BASE_URL}/api/admin/stories/items/${id}`, {
			method: 'DELETE',
			credentials: 'include'
		});

		await handleResponse(response);
	},

	/**
	 * Reorder items within highlight
	 */
	async reorder(items: ReorderItem[]): Promise<void> {
		const response = await fetch(`${API_BASE_URL}/api/admin/stories/items/reorder`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			credentials: 'include',
			body: JSON.stringify({ items })
		});

		await handleResponse(response);
	}
};

// =====================================================
// MEDIA UPLOAD API
// =====================================================

export const uploadAPI = {
	/**
	 * Upload media file (image or video) with progress tracking
	 */
	uploadMedia(file: File, onProgress?: (percent: number) => void): Promise<UploadMediaResponse> {
		return new Promise((resolve, reject) => {
			const formData = new FormData();
			formData.append('file', file);

			const xhr = new XMLHttpRequest();

			// Track upload progress
			xhr.upload.onprogress = (event) => {
				if (event.lengthComputable && onProgress) {
					const percent = Math.round((event.loaded / event.total) * 100);
					onProgress(percent);
				}
			};

			xhr.onload = () => {
				if (xhr.status >= 200 && xhr.status < 300) {
					try {
						const response = JSON.parse(xhr.responseText);
						if (response.success && response.data) {
							resolve(response.data);
						} else {
							reject(new Error(response.error || 'Ошибка загрузки'));
						}
					} catch {
						reject(new Error('Ошибка парсинга ответа сервера'));
					}
				} else {
					try {
						const errorData = JSON.parse(xhr.responseText);
						reject(new Error(errorData.error || `Ошибка загрузки: ${xhr.status}`));
					} catch {
						reject(new Error(`Ошибка загрузки: ${xhr.status}`));
					}
				}
			};

			xhr.onerror = () => {
				reject(new Error('Ошибка сети при загрузке файла'));
			};

			xhr.ontimeout = () => {
				reject(new Error('Превышено время ожидания загрузки'));
			};

			xhr.open('POST', `${API_BASE_URL}/api/admin/stories/upload`);
			xhr.withCredentials = true;
			xhr.timeout = 300000; // 5 minutes timeout for large files
			xhr.send(formData);
		});
	},

	/**
	 * Validate video file before upload
	 */
	validateVideo(file: File, maxDuration: number, maxSizeMb: number): Promise<{ valid: boolean; error?: string; duration?: number }> {
		return new Promise((resolve) => {
			// Supported video MIME types
			const supportedTypes = [
				'video/mp4',
				'video/webm',
				'video/quicktime', // MOV files (iPhone)
				'video/x-m4v'      // M4V files
			];

			// Check MIME type
			if (!supportedTypes.includes(file.type) && !file.type.startsWith('video/')) {
				resolve({
					valid: false,
					error: `Неподдерживаемый формат: ${file.type || 'неизвестный'}. Поддерживаются: MP4, WebM, MOV`
				});
				return;
			}

			// Check file size
			const sizeMb = file.size / (1024 * 1024);
			if (sizeMb > maxSizeMb) {
				resolve({ valid: false, error: `Файл слишком большой (${sizeMb.toFixed(1)} MB). Максимум: ${maxSizeMb} MB` });
				return;
			}

			// Check duration using video element
			const video = document.createElement('video');
			video.preload = 'metadata';

			// Timeout for slow loading or unsupported codecs
			const timeout = setTimeout(() => {
				cleanup();
				// If video is loading but metadata not available, try to proceed without duration check
				// This can happen with some codec/container combinations
				console.warn('Video metadata loading timeout, proceeding without duration validation');
				resolve({
					valid: true,
					error: undefined,
					duration: undefined // Duration will be detected server-side or during upload
				});
			}, 10000); // 10 second timeout

			const cleanup = () => {
				clearTimeout(timeout);
				URL.revokeObjectURL(video.src);
				video.onloadedmetadata = null;
				video.onerror = null;
			};

			video.onloadedmetadata = () => {
				cleanup();

				// Check for invalid duration (NaN or Infinity can occur with some formats)
				if (!isFinite(video.duration) || video.duration <= 0) {
					console.warn('Could not determine video duration, proceeding without validation');
					resolve({ valid: true, duration: undefined });
					return;
				}

				if (video.duration > maxDuration) {
					resolve({
						valid: false,
						error: `Видео слишком длинное (${Math.round(video.duration)} сек). Максимум: ${maxDuration} секунд`,
						duration: video.duration
					});
				} else {
					resolve({ valid: true, duration: video.duration });
				}
			};

			video.onerror = (e) => {
				cleanup();

				// Try to get more specific error information
				const mediaError = video.error;

				// For codec/format issues, allow upload anyway - video might still work on server
				// or can be transcoded later. Only block on clear errors.
				if (mediaError) {
					switch (mediaError.code) {
						case MediaError.MEDIA_ERR_ABORTED:
							resolve({ valid: false, error: 'Загрузка видео была прервана' });
							return;
						case MediaError.MEDIA_ERR_NETWORK:
							resolve({ valid: false, error: 'Ошибка сети при загрузке видео' });
							return;
						case MediaError.MEDIA_ERR_DECODE:
						case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
							// These errors often occur with valid videos that use codecs
							// not supported by browser (VP9, AV1, HEVC) but work fine on server
							console.warn('Browser cannot decode video, but allowing upload:', {
								type: file.type,
								size: sizeMb.toFixed(2) + ' MB',
								code: mediaError?.code
							});
							// Allow upload without duration validation
							resolve({
								valid: true,
								duration: undefined,
								error: undefined
							});
							return;
					}
				}

				console.error('Video validation error:', {
					type: file.type,
					size: sizeMb.toFixed(2) + ' MB',
					error: mediaError?.message,
					code: mediaError?.code
				});

				// For unknown errors, also allow upload
				resolve({ valid: true, duration: undefined });
			};

			video.src = URL.createObjectURL(file);
		});
	}
};

// =====================================================
// SETTINGS API
// =====================================================

export const settingsAPI = {
	/**
	 * Get stories settings
	 */
	async get(): Promise<StoriesSettings> {
		const response = await fetch(`${API_BASE_URL}/api/admin/stories/settings`, {
			credentials: 'include'
		});

		return handleResponse(response);
	},

	/**
	 * Update stories settings
	 */
	async update(data: Partial<StoriesSettings>): Promise<StoriesSettings> {
		const response = await fetch(`${API_BASE_URL}/api/admin/stories/settings`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			credentials: 'include',
			body: JSON.stringify(data)
		});

		return handleResponse(response);
	}
};

// =====================================================
// ANALYTICS API
// =====================================================

export const analyticsAPI = {
	/**
	 * Get overall analytics
	 */
	async getOverall(days: number = 30): Promise<StoriesAnalytics> {
		const response = await fetch(`${API_BASE_URL}/api/admin/stories/analytics?days=${days}`, {
			credentials: 'include'
		});

		return handleResponse(response);
	},

	/**
	 * Get analytics for specific highlight
	 */
	async getByHighlight(highlightId: number, days: number = 30): Promise<HighlightAnalytics> {
		const response = await fetch(`${API_BASE_URL}/api/admin/stories/analytics/${highlightId}?days=${days}`, {
			credentials: 'include'
		});

		return handleResponse(response);
	}
};

// =====================================================
// COMBINED EXPORT
// =====================================================

export const storiesAPI = {
	highlights: highlightsAPI,
	items: itemsAPI,
	upload: uploadAPI,
	settings: settingsAPI,
	analytics: analyticsAPI
};

export default storiesAPI;
