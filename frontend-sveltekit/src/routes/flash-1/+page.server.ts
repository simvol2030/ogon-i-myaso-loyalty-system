import { API_BASE_URL } from '$lib/config';
import type { PageServerLoad } from './$types';
import type { FlashResponse } from '$lib/components/flash/types';

export const load: PageServerLoad = async ({ fetch }) => {
	try {
		const response = await fetch(`${API_BASE_URL}/flash/1`);

		if (!response.ok) {
			console.error('[Flash-1] API error:', response.status, response.statusText);
			return {
				slides: [],
				config: {
					interval: 15000,
					transition: 'fade',
					screen: 1
				}
			};
		}

		const data: FlashResponse = await response.json();
		return data;
	} catch (error) {
		console.error('[Flash-1] Load error:', error);
		return {
			slides: [],
			config: {
				interval: 15000,
				transition: 'fade',
				screen: 1
			}
		};
	}
};
