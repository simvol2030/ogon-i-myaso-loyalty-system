<script lang="ts">
	interface Location {
		id: number;
		name: string;
		threshold: number | null;
	}

	interface Props {
		threshold: number;
		title: string;
		text: string;
		icon: string;
		locations?: Location[];
	}

	let { threshold, title, text, icon, locations = [] }: Props = $props();

	// State for expanded locations list
	let expanded = $state(false);

	// Replace {threshold} placeholder in text
	const displayText = $derived(text.replace('{threshold}', threshold.toLocaleString('ru-RU')));

	// Preview shows first 2 locations
	const previewLocations = $derived(locations.slice(0, 2));
	const hasMore = $derived(locations.length > 2);
	const previewText = $derived(
		previewLocations.map(l => l.name).join(', ') + (hasMore && !expanded ? '...' : '')
	);
</script>

<section class="free-delivery-widget">
	<div class="widget-icon">{icon}</div>
	<div class="widget-content">
		<h3 class="widget-title">{title}</h3>
		<p class="widget-text">{displayText}</p>

		{#if locations.length > 0}
			<div class="locations-preview">
				<span class="locations-label">Действует в:</span>
				<span class="locations-names">{previewText}</span>

				{#if hasMore}
					<button
						class="btn-more"
						onclick={() => expanded = !expanded}
						type="button"
					>
						{expanded ? 'Свернуть' : 'Подробнее'}
					</button>
				{/if}
			</div>

			{#if expanded}
				<div class="locations-full">
					{#each locations as location (location.id)}
						<div class="location-item">
							<span class="location-name">{location.name}</span>
							<span class="location-threshold">
								от {location.threshold?.toLocaleString('ru-RU')}₽
							</span>
						</div>
					{/each}
				</div>
			{/if}
		{/if}
	</div>
</section>

<style>
	.free-delivery-widget {
		display: flex;
		align-items: flex-start;
		gap: 12px;
		margin: 16px;
		padding: 16px;
		background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
		border-radius: 16px;
		box-shadow: 0 2px 8px rgba(251, 191, 36, 0.2);
	}

	/* Dark theme support */
	:global(.dark) .free-delivery-widget {
		background: linear-gradient(135deg, #78350f 0%, #92400e 100%);
	}

	.widget-icon {
		font-size: 32px;
		flex-shrink: 0;
		padding-top: 2px;
	}

	.widget-content {
		flex: 1;
		min-width: 0;
	}

	.widget-title {
		font-size: 16px;
		font-weight: 700;
		color: #78350f;
		margin: 0 0 4px 0;
		line-height: 1.2;
	}

	:global(.dark) .widget-title {
		color: #fef3c7;
	}

	.widget-text {
		font-size: 13px;
		color: #92400e;
		margin: 0;
		line-height: 1.4;
		opacity: 0.9;
	}

	:global(.dark) .widget-text {
		color: #fde68a;
	}

	/* Locations preview */
	.locations-preview {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px 8px;
		margin-top: 10px;
		padding-top: 10px;
		border-top: 1px solid rgba(120, 53, 15, 0.15);
	}

	:global(.dark) .locations-preview {
		border-top-color: rgba(254, 243, 199, 0.15);
	}

	.locations-label {
		font-size: 12px;
		font-weight: 600;
		color: #78350f;
	}

	:global(.dark) .locations-label {
		color: #fef3c7;
	}

	.locations-names {
		font-size: 12px;
		color: #92400e;
		flex: 1;
		min-width: 0;
	}

	:global(.dark) .locations-names {
		color: #fde68a;
	}

	.btn-more {
		font-size: 12px;
		font-weight: 600;
		color: #78350f;
		background: transparent;
		border: none;
		cursor: pointer;
		padding: 2px 0;
		text-decoration: underline;
		opacity: 0.8;
		transition: opacity 0.2s ease;
	}

	.btn-more:hover {
		opacity: 1;
	}

	:global(.dark) .btn-more {
		color: #fef3c7;
	}

	/* Full locations list */
	.locations-full {
		margin-top: 10px;
		background: rgba(255, 255, 255, 0.5);
		border-radius: 10px;
		padding: 8px;
		animation: slideDown 0.2s ease;
	}

	:global(.dark) .locations-full {
		background: rgba(0, 0, 0, 0.2);
	}

	@keyframes slideDown {
		from {
			opacity: 0;
			transform: translateY(-8px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.location-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 6px 8px;
		border-radius: 6px;
	}

	.location-item:nth-child(odd) {
		background: rgba(255, 255, 255, 0.4);
	}

	:global(.dark) .location-item:nth-child(odd) {
		background: rgba(0, 0, 0, 0.15);
	}

	.location-name {
		font-size: 13px;
		font-weight: 500;
		color: #78350f;
	}

	:global(.dark) .location-name {
		color: #fef3c7;
	}

	.location-threshold {
		font-size: 12px;
		color: #92400e;
		font-weight: 600;
		white-space: nowrap;
	}

	:global(.dark) .location-threshold {
		color: #fde68a;
	}

	@media (max-width: 480px) {
		.free-delivery-widget {
			margin: 12px;
			padding: 14px;
		}

		.widget-icon {
			font-size: 28px;
		}

		.widget-title {
			font-size: 15px;
		}

		.widget-text {
			font-size: 12px;
		}

		.locations-preview {
			margin-top: 8px;
			padding-top: 8px;
		}

		.locations-label,
		.locations-names,
		.btn-more {
			font-size: 11px;
		}

		.location-name {
			font-size: 12px;
		}

		.location-threshold {
			font-size: 11px;
		}
	}
</style>
