// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			csrfToken?: string;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}

	interface Window {
		Telegram?: {
			WebApp: {
				ready: () => void;
				expand: () => void;
				enableClosingConfirmation: () => void;
				colorScheme?: 'light' | 'dark';
				initData?: string; // Raw initData for server validation
				initDataUnsafe?: {
					user?: {
						id: number;
						first_name: string;
						last_name?: string;
						username?: string;
						language_code?: string;
					};
					auth_date?: number;
					hash?: string;
				};
			};
		};
	}
}

export {};
