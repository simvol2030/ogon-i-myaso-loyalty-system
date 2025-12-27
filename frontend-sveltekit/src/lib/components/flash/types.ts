/**
 * Flash Screen Types
 * TV-меню слайды для кафе
 */

export interface ProductItem {
	id: number;
	name: string;
	price: number;
	oldPrice: number | null;
	image: string;
	quantityInfo: string | null;
	description: string | null;
}

export interface Slide {
	type: 'products' | 'sets';
	title: string;           // Объединённый заголовок ("САЛАТЫ • СУПЫ")
	items: ProductItem[];
}

export interface FlashConfig {
	interval: number;
	transition: string;
	screen: number;
}

export interface FlashResponse {
	slides: Slide[];
	config: FlashConfig;
}
