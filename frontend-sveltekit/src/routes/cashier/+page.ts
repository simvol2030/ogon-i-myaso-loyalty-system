import { getStoreConfig } from '$lib/api/cashier';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ url }) => {
	// Получаем storeId из URL параметра или fallback на 1
	const storeId = parseInt(url.searchParams.get('storeId') || '1');

	// Загружаем конфигурацию магазина из API
	const config = await getStoreConfig(storeId);

	// Правила одинаковые для всех магазинов
	const storeConfig = {
		storeName: config.storeName,
		location: config.location || 'Разработка',
		cashbackPercent: 4,
		maxDiscountPercent: 20,
	};

	return {
		storeId,
		storeConfig,
	};
};
