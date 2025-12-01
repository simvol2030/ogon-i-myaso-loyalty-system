<script lang="ts">
	import ImageSlider from '$lib/components/ImageSlider.svelte';

	let { data } = $props();

	// Safe JSON parse for features field
	function parseFeatures(features: string | string[]): string[] {
		if (Array.isArray(features)) return features;
		if (!features || typeof features !== 'string') return [];
		try {
			const parsed = JSON.parse(features);
			return Array.isArray(parsed) ? parsed : [];
		} catch {
			// If not valid JSON, try splitting by comma
			return features.split(',').map(f => f.trim()).filter(Boolean);
		}
	}
</script>

<svelte:head>
	<title>Магазины - Мурзико</title>
</svelte:head>

<div class="stores-page">
	<header class="page-header">
		<h1>🏪 Наши магазины</h1>
		<p class="subtitle">Найдите ближайший к вам</p>
	</header>

	<div class="stores-list">
		{#each data.stores as store}
			<article class="store-card" class:closed={store.closed}>
				<!-- Image Slider -->
				{#if store.images && store.images.length > 0}
					<ImageSlider images={store.images} />
				{/if}

				<div class="store-content">
					<div class="store-header">
						<div class="store-title-row">
							<div class="store-icon" style="background: {store.icon_color}">
								<span class="icon-emoji">🏪</span>
							</div>
							<div>
								<h2 class="store-name">{store.name}</h2>
								{#if store.city}
									<span class="store-city">{store.city}</span>
								{/if}
							</div>
						</div>
					</div>

					<div class="store-info">
						<div class="info-row">
							<span class="info-icon">📍</span>
							<span class="info-text">{store.address}</span>
						</div>

						<div class="info-row">
							<span class="info-icon">📞</span>
							<a href="tel:{store.phone}" class="info-link">{store.phone}</a>
						</div>

						<div class="info-row">
							<span class="info-icon">🕐</span>
							<span class="info-text">{store.hours}</span>
						</div>
					</div>

					<div class="store-features">
						{#each parseFeatures(store.features) as feature}
							<span class="feature-badge">{feature}</span>
						{/each}
					</div>

					<a
						href="yandexnavi://build_route_on_map?lat_to={store.coords_lat}&lon_to={store.coords_lng}"
						target="_blank"
						rel="noopener noreferrer"
						class="map-link"
					>
						<span>🗺️</span>
						<span>Проложить маршрут</span>
					</a>
				</div>
			</article>
		{/each}
	</div>

	{#if data.stores.length === 0}
		<div class="empty-state">
			<span class="empty-icon">🏪</span>
			<h2>Магазины не найдены</h2>
			<p>Попробуйте позже</p>
		</div>
	{/if}
</div>

<style>
	.stores-page {
		padding: 0 16px 24px;
		max-width: 480px;
		margin: 0 auto;
	}

	.page-header {
		text-align: center;
		padding: 24px 0;
	}

	.page-header h1 {
		font-size: 28px;
		font-weight: bold;
		color: var(--text-primary);
		margin: 0 0 8px 0;
		letter-spacing: -0.025em;
	}

	.subtitle {
		font-size: 15px;
		color: var(--text-secondary);
		margin: 0;
	}

	.stores-list {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.store-card {
		background: var(--card-bg);
		border-radius: 16px;
		overflow: hidden;
		box-shadow: var(--shadow);
		transition: all 0.3s ease;
	}

	.store-card:hover {
		box-shadow: var(--shadow-lg);
		transform: translateY(-2px);
	}

	.store-card.closed {
		opacity: 0.7;
	}

	.store-content {
		padding: 16px 20px 20px;
	}

	.store-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 12px;
		margin-bottom: 12px;
	}

	.store-title-row {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.store-icon {
		width: 48px;
		height: 48px;
		border-radius: 10px;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.icon-emoji {
		font-size: 24px;
	}

	.store-name {
		font-size: 18px;
		font-weight: bold;
		color: var(--text-primary);
		margin: 0;
		letter-spacing: -0.025em;
	}

	.store-city {
		font-size: 13px;
		color: var(--text-secondary);
	}

	.status-badge {
		padding: 4px 10px;
		border-radius: 8px;
		font-size: 12px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		white-space: nowrap;
		flex-shrink: 0;
	}

	.status-badge.open {
		background: rgba(16, 185, 129, 0.1);
		color: var(--secondary-green);
	}

	.status-badge.closed {
		background: rgba(107, 114, 128, 0.1);
		color: var(--text-secondary);
	}

	.store-info {
		display: flex;
		flex-direction: column;
		gap: 8px;
		margin-bottom: 12px;
	}

	.info-row {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 14px;
	}

	.info-icon {
		font-size: 16px;
		flex-shrink: 0;
	}

	.info-text {
		color: var(--text-primary);
		line-height: 1.5;
	}

	.info-text.distance {
		color: var(--primary-orange);
		font-weight: 600;
	}

	.info-link {
		color: var(--primary-orange);
		text-decoration: none;
		font-weight: 500;
		transition: all 0.2s ease;
	}

	.info-link:hover {
		text-decoration: underline;
	}

	.store-features {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-bottom: 12px;
	}

	.feature-badge {
		padding: 4px 10px;
		border-radius: 6px;
		font-size: 12px;
		font-weight: 500;
		background: var(--bg-light);
		color: var(--text-secondary);
	}

	.map-link {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 10px 16px;
		border-radius: 10px;
		background: var(--primary-orange);
		color: white;
		text-decoration: none;
		font-size: 14px;
		font-weight: 600;
		transition: all 0.2s ease;
		width: 100%;
		justify-content: center;
	}

	.map-link:hover {
		background: var(--primary-orange-dark);
		transform: scale(1.02);
	}

	.map-link:active {
		transform: scale(0.98);
	}

	.empty-state {
		text-align: center;
		padding: 64px 20px;
	}

	.empty-icon {
		font-size: 64px;
		display: block;
		margin-bottom: 16px;
		opacity: 0.5;
	}

	.empty-state h2 {
		font-size: 20px;
		font-weight: bold;
		color: var(--text-primary);
		margin: 0 0 8px 0;
	}

	.empty-state p {
		font-size: 15px;
		color: var(--text-secondary);
		margin: 0;
	}

	@media (max-width: 480px) {
		.store-header {
			flex-direction: column;
			align-items: flex-start;
		}

		.status-badge {
			align-self: flex-start;
		}
	}
</style>
