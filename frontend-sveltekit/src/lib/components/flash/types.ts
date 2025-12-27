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
	type: 'products' | 'sets' | 'combo';
	category: string;
	categoryId: number;
	items: ProductItem[];
	setItem?: ProductItem; // Для combo layout
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
