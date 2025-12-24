<script lang="ts">
	import type { PageData } from './$types';
	import { API_BASE_URL } from '$lib/config';
	import { loadCustomization } from '$lib/stores/customization';

	let { data }: { data: PageData } = $props();

	type Tab = 'general' | 'loyalty' | 'notifications' | 'appearance';
	let activeTab = $state<Tab>('general');

	// Form states (initialized from data.settings)
	let generalForm = $state({
		appName: data.settings.general.appName,
		supportEmail: data.settings.general.supportEmail,
		supportPhone: data.settings.general.supportPhone
	});

	let loyaltyForm = $state({
		earnRate: data.settings.loyalty.earnRate,
		maxRedeemPercent: data.settings.loyalty.maxRedeemPercent,
		pointsExpiryDays: data.settings.loyalty.pointsExpiryDays,
		welcomeBonus: data.settings.loyalty.welcomeBonus,
		birthdayBonus: data.settings.loyalty.birthdayBonus,
		minRedemptionAmount: data.settings.loyalty.minRedemptionAmount,
		pointsName: data.settings.loyalty.pointsName
	});

	let saving = $state(false);
	let saveMessage = $state('');

	let notificationsForm = $state({
		emailEnabled: data.settings.notifications.emailEnabled,
		smsEnabled: data.settings.notifications.smsEnabled,
		pushEnabled: data.settings.notifications.pushEnabled,
		notifyOnEarn: data.settings.notifications.notifyOnEarn,
		notifyOnRedeem: data.settings.notifications.notifyOnRedeem,
		notifyOnExpiry: data.settings.notifications.notifyOnExpiry
	});

	// Appearance form state
	interface NavItem {
		id: string;
		href: string;
		label: string;
		icon: string;
		visible: boolean;
		isExternal?: boolean;
	}

	let appearanceForm = $state({
		// Branding
		appName: data.settings.appearance.appName,
		appSlogan: data.settings.appearance.appSlogan,
		logoUrl: data.settings.appearance.logoUrl,

		// Light theme colors
		primaryColor: data.settings.appearance.primaryColor,
		primaryColorDark: data.settings.appearance.primaryColorDark,
		primaryColorLight: data.settings.appearance.primaryColorLight,
		secondaryColor: data.settings.appearance.secondaryColor,
		secondaryColorDark: data.settings.appearance.secondaryColorDark,
		accentColor: data.settings.appearance.accentColor,

		// Dark theme colors
		darkBgPrimary: data.settings.appearance.darkBgPrimary,
		darkBgSecondary: data.settings.appearance.darkBgSecondary,
		darkBgTertiary: data.settings.appearance.darkBgTertiary,
		darkPrimaryColor: data.settings.appearance.darkPrimaryColor,
		darkTextPrimary: data.settings.appearance.darkTextPrimary,
		darkTextSecondary: data.settings.appearance.darkTextSecondary,
		darkBorderColor: data.settings.appearance.darkBorderColor,

		// Navigation
		bottomNavItems: [...data.settings.appearance.bottomNavItems] as NavItem[],
		sidebarMenuItems: [...data.settings.appearance.sidebarMenuItems] as NavItem[],

		// Loyalty Card Widget
		loyaltyCardGradientStart: data.settings.appearance.loyaltyCardGradientStart || '#ff6b00',
		loyaltyCardGradientEnd: data.settings.appearance.loyaltyCardGradientEnd || '#dc2626',
		loyaltyCardTextColor: data.settings.appearance.loyaltyCardTextColor || '#ffffff',
		loyaltyCardAccentColor: data.settings.appearance.loyaltyCardAccentColor || '#ffffff',
		loyaltyCardBadgeBg: data.settings.appearance.loyaltyCardBadgeBg || 'rgba(255,255,255,0.95)',
		loyaltyCardBadgeText: data.settings.appearance.loyaltyCardBadgeText || '#e55d00',
		loyaltyCardBorderRadius: data.settings.appearance.loyaltyCardBorderRadius ?? 24,
		loyaltyCardShowShimmer: data.settings.appearance.loyaltyCardShowShimmer ?? true,

		// Customizable Labels
		productsLabel: data.settings.appearance.productsLabel || 'Товары',
		productsIcon: data.settings.appearance.productsIcon || 'cart'
	});

	// Preset icons for bottom nav
	const bottomNavIconPresets = [
		{ id: 'home', label: 'Home', path: 'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z' },
		{ id: 'tag', label: 'Tag', path: 'M21.41 11.58l-9-9C12.05 2.22 11.55 2 11 2H4c-1.1 0-2 .9-2 2v7c0 .55.22 1.05.59 1.42l9 9c.36.36.86.58 1.41.58.55 0 1.05-.22 1.41-.59l7-7c.37-.36.59-.86.59-1.41 0-.55-.23-1.06-.59-1.42zM5.5 7C4.67 7 4 6.33 4 5.5S4.67 4 5.5 4 7 4.67 7 5.5 6.33 7 5.5 7z' },
		{ id: 'location', label: 'Location', path: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z' },
		{ id: 'coins', label: 'Coins', path: 'M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z' },
		{ id: 'user', label: 'User', path: 'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z' },
		{ id: 'cart', label: 'Cart', path: 'M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z' },
		{ id: 'heart', label: 'Heart', path: 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z' },
		{ id: 'star', label: 'Star', path: 'M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z' },
		{ id: 'settings', label: 'Settings', path: 'M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z' }
	];

	// Icon options for Products section
	const productsIconOptions = [
		{ id: 'cart', label: 'Корзина' },
		{ id: 'shopping-bag', label: 'Сумка покупок' },
		{ id: 'heart', label: 'Сердце' },
		{ id: 'star', label: 'Звезда' }
	];

	// Sidebar emoji presets
	const sidebarIconPresets = ['📊', '🛍️', '🎁', '🏪', '📰', '📜', '👤', '🏠', '⭐', '❤️', '🔔', '📦', '🎯', '💰', '📱', '🌐', '📧', '🔗', '⚙️'];

	let uploadingLogo = $state(false);

	function switchToGeneral() { activeTab = 'general'; }
	function switchToLoyalty() { activeTab = 'loyalty'; }
	function switchToNotifications() { activeTab = 'notifications'; }
	function switchToAppearance() { activeTab = 'appearance'; }

	function resetGeneral() {
		generalForm = {
			appName: data.settings.general.appName,
			supportEmail: data.settings.general.supportEmail,
			supportPhone: data.settings.general.supportPhone
		};
	}

	function resetLoyalty() {
		loyaltyForm = {
			earnRate: data.settings.loyalty.earnRate,
			maxRedeemPercent: data.settings.loyalty.maxRedeemPercent,
			pointsExpiryDays: data.settings.loyalty.pointsExpiryDays,
			welcomeBonus: data.settings.loyalty.welcomeBonus,
			birthdayBonus: data.settings.loyalty.birthdayBonus,
			minRedemptionAmount: data.settings.loyalty.minRedemptionAmount,
			pointsName: data.settings.loyalty.pointsName
		};
	}

	function resetNotifications() {
		notificationsForm = {
			emailEnabled: data.settings.notifications.emailEnabled,
			smsEnabled: data.settings.notifications.smsEnabled,
			pushEnabled: data.settings.notifications.pushEnabled,
			notifyOnEarn: data.settings.notifications.notifyOnEarn,
			notifyOnRedeem: data.settings.notifications.notifyOnRedeem,
			notifyOnExpiry: data.settings.notifications.notifyOnExpiry
		};
	}

	function resetAppearance() {
		appearanceForm = {
			appName: data.settings.appearance.appName,
			appSlogan: data.settings.appearance.appSlogan,
			logoUrl: data.settings.appearance.logoUrl,
			primaryColor: data.settings.appearance.primaryColor,
			primaryColorDark: data.settings.appearance.primaryColorDark,
			primaryColorLight: data.settings.appearance.primaryColorLight,
			secondaryColor: data.settings.appearance.secondaryColor,
			secondaryColorDark: data.settings.appearance.secondaryColorDark,
			accentColor: data.settings.appearance.accentColor,
			darkBgPrimary: data.settings.appearance.darkBgPrimary,
			darkBgSecondary: data.settings.appearance.darkBgSecondary,
			darkBgTertiary: data.settings.appearance.darkBgTertiary,
			darkPrimaryColor: data.settings.appearance.darkPrimaryColor,
			darkTextPrimary: data.settings.appearance.darkTextPrimary,
			darkTextSecondary: data.settings.appearance.darkTextSecondary,
			darkBorderColor: data.settings.appearance.darkBorderColor,
			bottomNavItems: [...data.settings.appearance.bottomNavItems],
			sidebarMenuItems: [...data.settings.appearance.sidebarMenuItems],
			loyaltyCardGradientStart: data.settings.appearance.loyaltyCardGradientStart || '#ff6b00',
			loyaltyCardGradientEnd: data.settings.appearance.loyaltyCardGradientEnd || '#dc2626',
			loyaltyCardTextColor: data.settings.appearance.loyaltyCardTextColor || '#ffffff',
			loyaltyCardAccentColor: data.settings.appearance.loyaltyCardAccentColor || '#ffffff',
			loyaltyCardBadgeBg: data.settings.appearance.loyaltyCardBadgeBg || 'rgba(255,255,255,0.95)',
			loyaltyCardBadgeText: data.settings.appearance.loyaltyCardBadgeText || '#e55d00',
			loyaltyCardBorderRadius: data.settings.appearance.loyaltyCardBorderRadius ?? 24,
			loyaltyCardShowShimmer: data.settings.appearance.loyaltyCardShowShimmer ?? true
		};
	}

	// Navigation item management
	function toggleNavItemVisibility(type: 'bottom' | 'sidebar', index: number) {
		if (type === 'bottom') {
			appearanceForm.bottomNavItems[index].visible = !appearanceForm.bottomNavItems[index].visible;
		} else {
			appearanceForm.sidebarMenuItems[index].visible = !appearanceForm.sidebarMenuItems[index].visible;
		}
	}

	function addSidebarItem() {
		appearanceForm.sidebarMenuItems = [...appearanceForm.sidebarMenuItems, {
			id: `custom-${Date.now()}`,
			href: '/',
			label: 'Новый пункт',
			icon: '🔗',
			visible: true,
			isExternal: false
		}];
	}

	function removeSidebarItem(index: number) {
		appearanceForm.sidebarMenuItems = appearanceForm.sidebarMenuItems.filter((_, i) => i !== index);
	}

	async function uploadLogo(event: Event) {
		const input = event.target as HTMLInputElement;
		if (!input.files || input.files.length === 0) return;

		const file = input.files[0];
		if (file.size > 5 * 1024 * 1024) {
			saveMessage = 'Файл слишком большой (максимум 5MB)';
			return;
		}

		uploadingLogo = true;
		saveMessage = '';

		try {
			const formData = new FormData();
			formData.append('logo', file);

			const response = await fetch(`${API_BASE_URL}/admin/settings/appearance/logo`, {
				method: 'POST',
				body: formData,
				credentials: 'include'
			});

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}`);
			}

			const result = await response.json();

			if (result.success) {
				appearanceForm.logoUrl = result.data.logoUrl;
				saveMessage = 'Логотип успешно загружен!';
				setTimeout(() => saveMessage = '', 3000);
			} else {
				saveMessage = 'Ошибка: ' + result.error;
			}
		} catch (error) {
			saveMessage = 'Ошибка загрузки логотипа';
		} finally {
			uploadingLogo = false;
		}
	}

	async function resetLogo() {
		try {
			const response = await fetch(`${API_BASE_URL}/admin/settings/appearance/logo`, {
				method: 'DELETE',
				credentials: 'include'
			});

			const result = await response.json();

			if (result.success) {
				appearanceForm.logoUrl = '/logo.png';
				saveMessage = 'Логотип сброшен на стандартный';
				setTimeout(() => saveMessage = '', 3000);
			}
		} catch (error) {
			saveMessage = 'Ошибка сброса логотипа';
		}
	}

	async function saveSettings() {
		if (saving) return;

		saving = true;
		saveMessage = '';

		try {
			if (activeTab === 'loyalty') {
				const response = await fetch(`${API_BASE_URL}/admin/settings/loyalty`, {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						earningPercent: loyaltyForm.earnRate,
						maxDiscountPercent: loyaltyForm.maxRedeemPercent,
						expiryDays: loyaltyForm.pointsExpiryDays,
						welcomeBonus: loyaltyForm.welcomeBonus,
						birthdayBonus: loyaltyForm.birthdayBonus,
						minRedemptionAmount: loyaltyForm.minRedemptionAmount,
						pointsName: loyaltyForm.pointsName,
						supportEmail: generalForm.supportEmail,
						supportPhone: generalForm.supportPhone
					}),
					credentials: 'include'
				});

				if (!response.ok) {
					if (response.status === 401) {
						saveMessage = 'Сессия истекла. Войдите заново.';
						setTimeout(() => window.location.href = '/login', 2000);
						return;
					}
					throw new Error(`HTTP ${response.status}: ${response.statusText}`);
				}

				const contentType = response.headers.get('content-type');
				if (!contentType?.includes('application/json')) {
					throw new Error('Сервер вернул некорректный ответ');
				}

				const result = await response.json();

				if (result.success) {
					saveMessage = 'Настройки успешно сохранены!';
					setTimeout(() => saveMessage = '', 3000);
				} else {
					saveMessage = 'Ошибка: ' + result.error;
				}
			} else if (activeTab === 'appearance') {
				const response = await fetch(`${API_BASE_URL}/admin/settings/appearance`, {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						appName: appearanceForm.appName,
						appSlogan: appearanceForm.appSlogan,
						logoUrl: appearanceForm.logoUrl,
						primaryColor: appearanceForm.primaryColor,
						primaryColorDark: appearanceForm.primaryColorDark,
						primaryColorLight: appearanceForm.primaryColorLight,
						secondaryColor: appearanceForm.secondaryColor,
						secondaryColorDark: appearanceForm.secondaryColorDark,
						accentColor: appearanceForm.accentColor,
						darkBgPrimary: appearanceForm.darkBgPrimary,
						darkBgSecondary: appearanceForm.darkBgSecondary,
						darkBgTertiary: appearanceForm.darkBgTertiary,
						darkPrimaryColor: appearanceForm.darkPrimaryColor,
						darkTextPrimary: appearanceForm.darkTextPrimary,
						darkTextSecondary: appearanceForm.darkTextSecondary,
						darkBorderColor: appearanceForm.darkBorderColor,
						bottomNavItems: appearanceForm.bottomNavItems,
						sidebarMenuItems: appearanceForm.sidebarMenuItems,
						loyaltyCardGradientStart: appearanceForm.loyaltyCardGradientStart,
						loyaltyCardGradientEnd: appearanceForm.loyaltyCardGradientEnd,
						loyaltyCardTextColor: appearanceForm.loyaltyCardTextColor,
						loyaltyCardAccentColor: appearanceForm.loyaltyCardAccentColor,
						loyaltyCardBadgeBg: appearanceForm.loyaltyCardBadgeBg,
						loyaltyCardBadgeText: appearanceForm.loyaltyCardBadgeText,
						loyaltyCardBorderRadius: appearanceForm.loyaltyCardBorderRadius,
						loyaltyCardShowShimmer: appearanceForm.loyaltyCardShowShimmer,
						productsLabel: appearanceForm.productsLabel,
						productsIcon: appearanceForm.productsIcon
					}),
					credentials: 'include'
				});

				if (!response.ok) {
					if (response.status === 401) {
						saveMessage = 'Сессия истекла. Войдите заново.';
						setTimeout(() => window.location.href = '/login', 2000);
						return;
					}
					throw new Error(`HTTP ${response.status}: ${response.statusText}`);
				}

				const result = await response.json();

				if (result.success) {
					saveMessage = 'Настройки внешнего вида сохранены!';

					// Reload customization to update all components with new settings
					await loadCustomization(API_BASE_URL);

					setTimeout(() => saveMessage = '', 3000);
				} else {
					saveMessage = 'Ошибка: ' + result.error;
				}
			} else {
				saveMessage = 'Сохранение этого раздела пока не реализовано';
			}
		} catch (error) {
			console.error('Save settings error:', error);
			if (error instanceof TypeError && error.message.includes('fetch')) {
				saveMessage = 'Ошибка сети. Проверьте подключение к интернету.';
			} else {
				saveMessage = 'Ошибка сохранения: ' + (error as Error).message;
			}
		} finally {
			saving = false;
		}
	}
</script>

<svelte:head>
	<title>Настройки - Loyalty Admin</title>
</svelte:head>

<div class="page">
	<div class="page-header">
		<h1>Настройки</h1>
		<p class="text-muted">Управление параметрами программы лояльности</p>
	</div>

	<!-- Tabs -->
	<div class="tabs">
		<button class="tab" class:active={activeTab === 'general'} onclick={switchToGeneral}>
			Общие
		</button>
		<button class="tab" class:active={activeTab === 'loyalty'} onclick={switchToLoyalty}>
			Программа лояльности
		</button>
		<button class="tab" class:active={activeTab === 'notifications'} onclick={switchToNotifications}>
			Уведомления
		</button>
		<button class="tab" class:active={activeTab === 'appearance'} onclick={switchToAppearance}>
			Внешний вид
		</button>
	</div>

	<!-- Tab Content -->
	<div class="section">
		{#if activeTab === 'general'}
			<h2>Общие настройки</h2>
			<form class="settings-form">
				<div class="form-group">
					<label for="appName">Название приложения</label>
					<input type="text" id="appName" bind:value={generalForm.appName} />
				</div>

				<div class="form-group">
					<label for="supportEmail">Email поддержки</label>
					<input type="email" id="supportEmail" bind:value={generalForm.supportEmail} />
				</div>

				<div class="form-group">
					<label for="supportPhone">Телефон поддержки</label>
					<input type="tel" id="supportPhone" bind:value={generalForm.supportPhone} />
				</div>

				<div class="button-group">
					<button type="button" class="btn btn-primary" onclick={saveSettings}>
						Сохранить изменения
					</button>
					<button type="button" class="btn btn-secondary" onclick={resetGeneral}>Сбросить</button>
				</div>
			</form>

		{:else if activeTab === 'loyalty'}
			<h2>Программа лояльности</h2>
			<form class="settings-form">
				<div class="form-group">
					<label for="earnRate">Процент начисления (%)</label>
					<input type="number" id="earnRate" bind:value={loyaltyForm.earnRate} min="0.1" max="20" step="0.1" />
					<small>Текущее значение: {loyaltyForm.earnRate}% (максимум 20%)</small>
				</div>

				<div class="form-group">
					<label for="maxRedeemPercent">Максимальная скидка (%)</label>
					<input type="number" id="maxRedeemPercent" bind:value={loyaltyForm.maxRedeemPercent} min="1" max="50" step="1" />
					<small>Текущее значение: {loyaltyForm.maxRedeemPercent}% (максимум 50%)</small>
				</div>

				<div class="form-group">
					<label for="pointsExpiryDays">Срок действия баллов (дней)</label>
					<input type="number" id="pointsExpiryDays" bind:value={loyaltyForm.pointsExpiryDays} min="0" />
					<small>Текущее значение: {loyaltyForm.pointsExpiryDays} дней</small>
				</div>

				<div class="form-group">
					<label for="welcomeBonus">Приветственный бонус (баллы)</label>
					<input type="number" id="welcomeBonus" bind:value={loyaltyForm.welcomeBonus} min="0" />
					<small>Текущее значение: {loyaltyForm.welcomeBonus} баллов</small>
				</div>

				<div class="form-group">
					<label for="birthdayBonus">Бонус в день рождения (баллы)</label>
					<input type="number" id="birthdayBonus" bind:value={loyaltyForm.birthdayBonus} min="0" />
					<small>Текущее значение: {loyaltyForm.birthdayBonus} баллов</small>
				</div>

				<div class="form-group">
					<label for="minRedemptionAmount">Минимальная сумма для списания (баллы)</label>
					<input type="number" id="minRedemptionAmount" bind:value={loyaltyForm.minRedemptionAmount} min="0" />
					<small>Текущее значение: {loyaltyForm.minRedemptionAmount} баллов</small>
				</div>

				<div class="form-group">
					<label for="pointsName">Название баллов</label>
					<input type="text" id="pointsName" bind:value={loyaltyForm.pointsName} maxlength="50" />
					<small>Отображается в TWA (например: "Мурзи-коины", "Бонусы")</small>
				</div>

				{#if saveMessage}
					<div class="alert" class:success={saveMessage.includes('успешно') || saveMessage.includes('сохранены')} class:error={saveMessage.includes('Ошибка')}>
						{saveMessage}
					</div>
				{/if}

				<div class="button-group">
					<button type="button" class="btn btn-primary" onclick={saveSettings} disabled={saving}>
						{saving ? 'Сохранение...' : 'Сохранить изменения'}
					</button>
					<button type="button" class="btn btn-secondary" onclick={resetLoyalty}>Сбросить</button>
				</div>
			</form>

		{:else if activeTab === 'notifications'}
			<h2>Уведомления</h2>
			<form class="settings-form">
				<div class="settings-section">
					<h3>Каналы уведомлений</h3>
					<div class="checkbox-group">
						<label>
							<input type="checkbox" bind:checked={notificationsForm.emailEnabled} />
							Email уведомления
						</label>
					</div>
					<div class="checkbox-group">
						<label>
							<input type="checkbox" bind:checked={notificationsForm.smsEnabled} />
							SMS уведомления
						</label>
					</div>
					<div class="checkbox-group">
						<label>
							<input type="checkbox" bind:checked={notificationsForm.pushEnabled} />
							Push уведомления
						</label>
					</div>
				</div>

				<div class="settings-section">
					<h3>События для уведомлений</h3>
					<div class="checkbox-group">
						<label>
							<input type="checkbox" bind:checked={notificationsForm.notifyOnEarn} />
							При начислении баллов
						</label>
					</div>
					<div class="checkbox-group">
						<label>
							<input type="checkbox" bind:checked={notificationsForm.notifyOnRedeem} />
							При списании баллов
						</label>
					</div>
					<div class="checkbox-group">
						<label>
							<input type="checkbox" bind:checked={notificationsForm.notifyOnExpiry} />
							Перед сгоранием баллов
						</label>
					</div>
				</div>

				<div class="button-group">
					<button type="button" class="btn btn-primary" onclick={saveSettings}>
						Сохранить изменения
					</button>
					<button type="button" class="btn btn-secondary" onclick={resetNotifications}>
						Сбросить
					</button>
				</div>
			</form>

		{:else if activeTab === 'appearance'}
			<h2>Внешний вид приложения</h2>

			{#if saveMessage}
				<div class="alert" class:success={saveMessage.includes('успешно') || saveMessage.includes('сохранены') || saveMessage.includes('загружен') || saveMessage.includes('сброшен')} class:error={saveMessage.includes('Ошибка')}>
					{saveMessage}
				</div>
			{/if}

			<form class="settings-form appearance-form">
				<!-- Branding Section -->
				<div class="appearance-section">
					<h3>Брендинг</h3>

					<div class="logo-upload-section">
						<div class="logo-preview">
							<img src={appearanceForm.logoUrl} alt="Logo" class="logo-image" />
						</div>
						<div class="logo-controls">
							<label class="btn btn-secondary upload-btn">
								{uploadingLogo ? 'Загрузка...' : 'Загрузить логотип'}
								<input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onchange={uploadLogo} hidden disabled={uploadingLogo} />
							</label>
							<button type="button" class="btn btn-outline" onclick={resetLogo}>
								Сбросить
							</button>
							<small>PNG, JPEG, WebP или SVG. Максимум 5MB.</small>
						</div>
					</div>

					<div class="form-row">
						<div class="form-group">
							<label for="brandName">Название</label>
							<input type="text" id="brandName" bind:value={appearanceForm.appName} maxlength="50" />
						</div>
						<div class="form-group">
							<label for="brandSlogan">Слоган</label>
							<input type="text" id="brandSlogan" bind:value={appearanceForm.appSlogan} maxlength="50" />
						</div>
					</div>

					<div class="form-row">
						<div class="form-group">
							<label for="productsLabel">Название раздела Товары</label>
							<input type="text" id="productsLabel" bind:value={appearanceForm.productsLabel} maxlength="20" placeholder="Товары, Меню, Магазин..." />
							<small>Как называть раздел товаров в навигации</small>
						</div>
						<div class="form-group">
							<label for="productsIcon">Иконка для раздела</label>
							<select id="productsIcon" bind:value={appearanceForm.productsIcon}>
								{#each productsIconOptions as option}
									<option value={option.id}>{option.label}</option>
								{/each}
							</select>
							<small>Иконка отображается в нижней панели</small>
						</div>
					</div>
				</div>

				<!-- Light Theme Colors -->
				<div class="appearance-section">
					<h3>Цветовая схема (Светлая тема)</h3>
					<div class="color-grid">
						<div class="color-picker-group">
							<label>Основной цвет</label>
							<div class="color-input-wrapper">
								<input type="color" bind:value={appearanceForm.primaryColor} />
								<input type="text" bind:value={appearanceForm.primaryColor} class="color-text" />
							</div>
						</div>
						<div class="color-picker-group">
							<label>Основной (тёмный)</label>
							<div class="color-input-wrapper">
								<input type="color" bind:value={appearanceForm.primaryColorDark} />
								<input type="text" bind:value={appearanceForm.primaryColorDark} class="color-text" />
							</div>
						</div>
						<div class="color-picker-group">
							<label>Основной (светлый)</label>
							<div class="color-input-wrapper">
								<input type="color" bind:value={appearanceForm.primaryColorLight} />
								<input type="text" bind:value={appearanceForm.primaryColorLight} class="color-text" />
							</div>
						</div>
						<div class="color-picker-group">
							<label>Вторичный (успех)</label>
							<div class="color-input-wrapper">
								<input type="color" bind:value={appearanceForm.secondaryColor} />
								<input type="text" bind:value={appearanceForm.secondaryColor} class="color-text" />
							</div>
						</div>
						<div class="color-picker-group">
							<label>Вторичный (тёмный)</label>
							<div class="color-input-wrapper">
								<input type="color" bind:value={appearanceForm.secondaryColorDark} />
								<input type="text" bind:value={appearanceForm.secondaryColorDark} class="color-text" />
							</div>
						</div>
						<div class="color-picker-group">
							<label>Акцент (ошибки)</label>
							<div class="color-input-wrapper">
								<input type="color" bind:value={appearanceForm.accentColor} />
								<input type="text" bind:value={appearanceForm.accentColor} class="color-text" />
							</div>
						</div>
					</div>
				</div>

				<!-- Dark Theme Colors -->
				<div class="appearance-section">
					<h3>Цветовая схема (Тёмная тема)</h3>
					<div class="color-grid">
						<div class="color-picker-group">
							<label>Фон основной</label>
							<div class="color-input-wrapper">
								<input type="color" bind:value={appearanceForm.darkBgPrimary} />
								<input type="text" bind:value={appearanceForm.darkBgPrimary} class="color-text" />
							</div>
						</div>
						<div class="color-picker-group">
							<label>Фон вторичный</label>
							<div class="color-input-wrapper">
								<input type="color" bind:value={appearanceForm.darkBgSecondary} />
								<input type="text" bind:value={appearanceForm.darkBgSecondary} class="color-text" />
							</div>
						</div>
						<div class="color-picker-group">
							<label>Фон третичный</label>
							<div class="color-input-wrapper">
								<input type="color" bind:value={appearanceForm.darkBgTertiary} />
								<input type="text" bind:value={appearanceForm.darkBgTertiary} class="color-text" />
							</div>
						</div>
						<div class="color-picker-group">
							<label>Основной цвет</label>
							<div class="color-input-wrapper">
								<input type="color" bind:value={appearanceForm.darkPrimaryColor} />
								<input type="text" bind:value={appearanceForm.darkPrimaryColor} class="color-text" />
							</div>
						</div>
						<div class="color-picker-group">
							<label>Текст основной</label>
							<div class="color-input-wrapper">
								<input type="color" bind:value={appearanceForm.darkTextPrimary} />
								<input type="text" bind:value={appearanceForm.darkTextPrimary} class="color-text" />
							</div>
						</div>
						<div class="color-picker-group">
							<label>Текст вторичный</label>
							<div class="color-input-wrapper">
								<input type="color" bind:value={appearanceForm.darkTextSecondary} />
								<input type="text" bind:value={appearanceForm.darkTextSecondary} class="color-text" />
							</div>
						</div>
						<div class="color-picker-group">
							<label>Цвет границ</label>
							<div class="color-input-wrapper">
								<input type="color" bind:value={appearanceForm.darkBorderColor} />
								<input type="text" bind:value={appearanceForm.darkBorderColor} class="color-text" />
							</div>
						</div>
					</div>
				</div>

				<!-- Bottom Navigation -->
				<div class="appearance-section">
					<h3>Нижняя навигация (5 кнопок)</h3>
					<div class="nav-items-list">
						{#each appearanceForm.bottomNavItems as item, index}
							<div class="nav-item-row">
								<div class="nav-item-visibility">
									<input type="checkbox" checked={item.visible} onchange={() => toggleNavItemVisibility('bottom', index)} />
								</div>
								<div class="nav-item-icon">
									<select bind:value={item.icon}>
										{#each bottomNavIconPresets as preset}
											<option value={preset.id}>{preset.label}</option>
										{/each}
									</select>
								</div>
								<div class="nav-item-label">
									<input type="text" bind:value={item.label} placeholder="Название" />
								</div>
								<div class="nav-item-href">
									<input type="text" bind:value={item.href} placeholder="URL" />
								</div>
							</div>
						{/each}
					</div>
				</div>

				<!-- Sidebar Menu -->
				<div class="appearance-section">
					<h3>Боковое меню</h3>
					<div class="nav-items-list">
						{#each appearanceForm.sidebarMenuItems as item, index}
							<div class="nav-item-row">
								<div class="nav-item-visibility">
									<input type="checkbox" checked={item.visible} onchange={() => toggleNavItemVisibility('sidebar', index)} />
								</div>
								<div class="nav-item-icon sidebar-icon">
									<select bind:value={item.icon}>
										{#each sidebarIconPresets as emoji}
											<option value={emoji}>{emoji}</option>
										{/each}
									</select>
								</div>
								<div class="nav-item-label">
									<input type="text" bind:value={item.label} placeholder="Название" />
								</div>
								<div class="nav-item-href">
									<input type="text" bind:value={item.href} placeholder="URL" />
								</div>
								<div class="nav-item-external">
									<label title="Внешняя ссылка">
										<input type="checkbox" bind:checked={item.isExternal} />
										Внешняя
									</label>
								</div>
								<button type="button" class="btn-icon delete" onclick={() => removeSidebarItem(index)} title="Удалить">
									&times;
								</button>
							</div>
						{/each}
					</div>
					<button type="button" class="btn btn-outline add-item-btn" onclick={addSidebarItem}>
						+ Добавить пункт меню
					</button>
				</div>

				<!-- Loyalty Card Widget -->
				<div class="appearance-section">
					<h3>Карточка баланса (виджет лояльности)</h3>
					<p class="section-description">Настройте внешний вид карточки баланса на главной странице и в профиле</p>

					<!-- Card Preview -->
					<div class="loyalty-card-preview" style="
						background: linear-gradient(135deg, {appearanceForm.loyaltyCardGradientStart}, {appearanceForm.loyaltyCardGradientEnd});
						border-radius: {appearanceForm.loyaltyCardBorderRadius}px;
						color: {appearanceForm.loyaltyCardTextColor};
					">
						<div class="preview-header">
							<span class="preview-label" style="color: {appearanceForm.loyaltyCardAccentColor}">Баланс</span>
							<span class="preview-badge" style="background: {appearanceForm.loyaltyCardBadgeBg}; color: {appearanceForm.loyaltyCardBadgeText}">+5%</span>
						</div>
						<div class="preview-balance">1,234</div>
						<div class="preview-currency" style="color: {appearanceForm.loyaltyCardAccentColor}">бонусов</div>
						{#if appearanceForm.loyaltyCardShowShimmer}
							<div class="preview-shimmer"></div>
						{/if}
					</div>

					<div class="color-grid">
						<div class="color-picker-group">
							<label>Градиент (начало)</label>
							<div class="color-input-wrapper">
								<input type="color" bind:value={appearanceForm.loyaltyCardGradientStart} />
								<input type="text" bind:value={appearanceForm.loyaltyCardGradientStart} class="color-text" />
							</div>
						</div>
						<div class="color-picker-group">
							<label>Градиент (конец)</label>
							<div class="color-input-wrapper">
								<input type="color" bind:value={appearanceForm.loyaltyCardGradientEnd} />
								<input type="text" bind:value={appearanceForm.loyaltyCardGradientEnd} class="color-text" />
							</div>
						</div>
						<div class="color-picker-group">
							<label>Цвет текста</label>
							<div class="color-input-wrapper">
								<input type="color" bind:value={appearanceForm.loyaltyCardTextColor} />
								<input type="text" bind:value={appearanceForm.loyaltyCardTextColor} class="color-text" />
							</div>
						</div>
						<div class="color-picker-group">
							<label>Цвет акцентов</label>
							<div class="color-input-wrapper">
								<input type="color" bind:value={appearanceForm.loyaltyCardAccentColor} />
								<input type="text" bind:value={appearanceForm.loyaltyCardAccentColor} class="color-text" />
							</div>
						</div>
						<div class="color-picker-group">
							<label>Фон бейджа</label>
							<div class="color-input-wrapper">
								<input type="text" bind:value={appearanceForm.loyaltyCardBadgeBg} class="color-text full-width" placeholder="rgba(255,255,255,0.95)" />
							</div>
							<small>HEX или RGBA формат</small>
						</div>
						<div class="color-picker-group">
							<label>Текст бейджа</label>
							<div class="color-input-wrapper">
								<input type="color" bind:value={appearanceForm.loyaltyCardBadgeText} />
								<input type="text" bind:value={appearanceForm.loyaltyCardBadgeText} class="color-text" />
							</div>
						</div>
					</div>

					<div class="form-row loyalty-options">
						<div class="form-group">
							<label for="cardRadius">Скругление углов (px)</label>
							<input type="number" id="cardRadius" bind:value={appearanceForm.loyaltyCardBorderRadius} min="0" max="50" />
						</div>
						<div class="form-group checkbox-inline">
							<label>
								<input type="checkbox" bind:checked={appearanceForm.loyaltyCardShowShimmer} />
								Анимация блеска (shimmer)
							</label>
						</div>
					</div>
				</div>

				<div class="button-group">
					<button type="button" class="btn btn-primary" onclick={saveSettings} disabled={saving}>
						{saving ? 'Сохранение...' : 'Сохранить изменения'}
					</button>
					<button type="button" class="btn btn-secondary" onclick={resetAppearance}>Сбросить</button>
				</div>
			</form>
		{/if}
	</div>
</div>

<style>
	.page {
		max-width: 1200px;
	}

	.page-header {
		margin-bottom: 2rem;
	}

	.page-header h1 {
		margin: 0 0 0.5rem 0;
		font-size: 2rem;
		font-weight: 700;
	}

	.text-muted {
		color: #6b7280;
		margin: 0;
	}

	/* Tabs */
	.tabs {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 1.5rem;
		border-bottom: 2px solid #e5e7eb;
		overflow-x: auto;
	}

	.tab {
		padding: 0.75rem 1.5rem;
		background: transparent;
		border: none;
		border-bottom: 2px solid transparent;
		cursor: pointer;
		font-size: 0.875rem;
		font-weight: 500;
		color: #6b7280;
		transition: all 0.2s;
		margin-bottom: -2px;
		white-space: nowrap;
	}

	.tab:hover {
		color: #111827;
		background: #f9fafb;
	}

	.tab.active {
		color: #667eea;
		border-bottom-color: #667eea;
	}

	/* Section */
	.section {
		background: white;
		padding: 2rem;
		border-radius: 0.75rem;
		box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1);
	}

	.section h2 {
		margin: 0 0 1.5rem 0;
		font-size: 1.5rem;
		font-weight: 600;
	}

	/* Form */
	.settings-form {
		max-width: 800px;
	}

	.appearance-form {
		max-width: 100%;
	}

	.form-group {
		margin-bottom: 1.5rem;
	}

	.form-group label {
		display: block;
		margin-bottom: 0.5rem;
		font-weight: 500;
		font-size: 0.875rem;
		color: #374151;
	}

	.form-group input[type='text'],
	.form-group input[type='email'],
	.form-group input[type='tel'],
	.form-group input[type='number'] {
		width: 100%;
		padding: 0.75rem;
		border: 1px solid #d1d5db;
		border-radius: 0.5rem;
		font-size: 0.875rem;
		transition: border-color 0.2s;
	}

	.form-group input:focus {
		outline: none;
		border-color: #667eea;
		box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
	}

	.form-group small {
		display: block;
		margin-top: 0.5rem;
		font-size: 0.75rem;
		color: #6b7280;
	}

	.form-row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
	}

	/* Settings sections */
	.settings-section {
		margin-bottom: 2rem;
	}

	.settings-section h3 {
		margin: 0 0 1rem 0;
		font-size: 1.125rem;
		font-weight: 600;
		color: #374151;
	}

	.checkbox-group {
		margin-bottom: 1rem;
	}

	.checkbox-group label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-weight: 400;
		cursor: pointer;
	}

	.checkbox-group input[type='checkbox'] {
		width: 1.25rem;
		height: 1.25rem;
		cursor: pointer;
	}

	/* Appearance Sections */
	.appearance-section {
		margin-bottom: 2.5rem;
		padding-bottom: 2rem;
		border-bottom: 1px solid #e5e7eb;
	}

	.appearance-section:last-of-type {
		border-bottom: none;
	}

	.appearance-section h3 {
		margin: 0 0 1.5rem 0;
		font-size: 1.125rem;
		font-weight: 600;
		color: #374151;
	}

	/* Logo Upload */
	.logo-upload-section {
		display: flex;
		gap: 2rem;
		align-items: flex-start;
		margin-bottom: 1.5rem;
	}

	.logo-preview {
		width: 100px;
		height: 100px;
		border: 2px dashed #d1d5db;
		border-radius: 12px;
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
		background: #f9fafb;
	}

	.logo-image {
		max-width: 80px;
		max-height: 80px;
		object-fit: contain;
	}

	.logo-controls {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.logo-controls small {
		color: #6b7280;
		font-size: 0.75rem;
	}

	.upload-btn {
		cursor: pointer;
	}

	/* Color Pickers */
	.color-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
		gap: 1rem;
	}

	.color-picker-group {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.color-picker-group label {
		font-size: 0.875rem;
		font-weight: 500;
		color: #374151;
	}

	.color-input-wrapper {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

	.color-input-wrapper input[type='color'] {
		width: 40px;
		height: 40px;
		border: none;
		border-radius: 8px;
		cursor: pointer;
		padding: 0;
	}

	.color-text {
		flex: 1;
		padding: 0.5rem;
		border: 1px solid #d1d5db;
		border-radius: 6px;
		font-size: 0.875rem;
		font-family: monospace;
		text-transform: uppercase;
	}

	/* Navigation Items */
	.nav-items-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.nav-item-row {
		display: flex;
		gap: 0.75rem;
		align-items: center;
		padding: 0.75rem;
		background: #f9fafb;
		border-radius: 8px;
		border: 1px solid #e5e7eb;
	}

	.nav-item-visibility {
		flex-shrink: 0;
	}

	.nav-item-visibility input {
		width: 1.25rem;
		height: 1.25rem;
		cursor: pointer;
	}

	.nav-item-icon select,
	.sidebar-icon select {
		padding: 0.5rem;
		border: 1px solid #d1d5db;
		border-radius: 6px;
		background: white;
		font-size: 0.875rem;
	}

	.sidebar-icon select {
		font-size: 1.25rem;
	}

	.nav-item-label {
		flex: 1;
		min-width: 120px;
	}

	.nav-item-label input {
		width: 100%;
		padding: 0.5rem;
		border: 1px solid #d1d5db;
		border-radius: 6px;
		font-size: 0.875rem;
	}

	.nav-item-href {
		flex: 1.5;
		min-width: 150px;
	}

	.nav-item-href input {
		width: 100%;
		padding: 0.5rem;
		border: 1px solid #d1d5db;
		border-radius: 6px;
		font-size: 0.875rem;
		font-family: monospace;
	}

	.nav-item-external {
		flex-shrink: 0;
	}

	.nav-item-external label {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		font-size: 0.75rem;
		color: #6b7280;
		cursor: pointer;
	}

	.nav-item-external input {
		width: 1rem;
		height: 1rem;
	}

	.btn-icon {
		width: 32px;
		height: 32px;
		border: none;
		border-radius: 6px;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.25rem;
		transition: all 0.2s;
	}

	.btn-icon.delete {
		background: #fef2f2;
		color: #dc2626;
	}

	.btn-icon.delete:hover {
		background: #fee2e2;
	}

	.add-item-btn {
		margin-top: 1rem;
	}

	/* Buttons */
	.button-group {
		display: flex;
		gap: 1rem;
		margin-top: 2rem;
	}

	.btn {
		padding: 0.75rem 1.5rem;
		border: none;
		border-radius: 0.5rem;
		font-size: 0.875rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s;
	}

	.btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.btn-primary {
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		color: white;
	}

	.btn-primary:hover:not(:disabled) {
		transform: translateY(-1px);
		box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
	}

	.btn-secondary {
		background: #f3f4f6;
		color: #374151;
	}

	.btn-secondary:hover {
		background: #e5e7eb;
	}

	.btn-outline {
		background: transparent;
		color: #667eea;
		border: 1px solid #667eea;
	}

	.btn-outline:hover {
		background: rgba(102, 126, 234, 0.1);
	}

	.alert {
		padding: 12px 16px;
		border-radius: 8px;
		margin-bottom: 16px;
		font-size: 14px;
		font-weight: 500;
	}

	.alert.success {
		background: rgba(16, 185, 129, 0.1);
		color: #059669;
		border: 1px solid rgba(16, 185, 129, 0.3);
	}

	.alert.error {
		background: rgba(239, 68, 68, 0.1);
		color: #dc2626;
		border: 1px solid rgba(239, 68, 68, 0.3);
	}

	/* Loyalty Card Preview */
	.section-description {
		color: #6b7280;
		font-size: 0.875rem;
		margin: -1rem 0 1.5rem 0;
	}

	.loyalty-card-preview {
		position: relative;
		padding: 1.5rem;
		margin-bottom: 1.5rem;
		max-width: 320px;
		overflow: hidden;
		box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.3);
	}

	.preview-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.5rem;
	}

	.preview-label {
		font-size: 0.875rem;
		font-weight: 500;
		opacity: 0.9;
	}

	.preview-badge {
		font-size: 0.75rem;
		font-weight: 700;
		padding: 0.25rem 0.5rem;
		border-radius: 9999px;
	}

	.preview-balance {
		font-size: 2.5rem;
		font-weight: 800;
		line-height: 1;
	}

	.preview-currency {
		font-size: 0.875rem;
		font-weight: 500;
		opacity: 0.9;
		margin-top: 0.25rem;
	}

	.preview-shimmer {
		position: absolute;
		top: 0;
		left: -100%;
		width: 50%;
		height: 100%;
		background: linear-gradient(
			90deg,
			transparent,
			rgba(255, 255, 255, 0.2),
			transparent
		);
		animation: shimmer 2s infinite;
	}

	@keyframes shimmer {
		0% { left: -100%; }
		100% { left: 200%; }
	}

	.color-text.full-width {
		flex: 1;
		width: 100%;
	}

	.loyalty-options {
		margin-top: 1.5rem;
		align-items: flex-end;
	}

	.checkbox-inline {
		display: flex;
		align-items: center;
	}

	.checkbox-inline label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
		font-weight: 500;
	}

	.checkbox-inline input[type="checkbox"] {
		width: 1.25rem;
		height: 1.25rem;
	}

	@media (max-width: 768px) {
		.section {
			padding: 1.5rem;
		}

		.button-group {
			flex-direction: column;
		}

		.btn {
			width: 100%;
		}

		.form-row {
			grid-template-columns: 1fr;
		}

		.color-grid {
			grid-template-columns: 1fr;
		}

		.logo-upload-section {
			flex-direction: column;
		}

		.nav-item-row {
			flex-wrap: wrap;
		}

		.nav-item-label,
		.nav-item-href {
			min-width: 100%;
		}

		.loyalty-card-preview {
			max-width: 100%;
		}
	}
</style>
