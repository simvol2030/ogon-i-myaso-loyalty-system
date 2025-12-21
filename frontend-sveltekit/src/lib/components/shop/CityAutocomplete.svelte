<script lang="ts">
	import { onMount } from 'svelte';

	// Props
	interface Props {
		value: string;
		selectedLocationId?: number | null;
		deliveryPrice?: number;
		oninput: (cityName: string, locationId: number | null, price: number) => void;
		placeholder?: string;
		required?: boolean;
	}

	let {
		value = $bindable(''),
		selectedLocationId = $bindable<number | null>(null),
		deliveryPrice = $bindable(0),
		oninput,
		placeholder = 'Выберите город или начните вводить...',
		required = false
	}: Props = $props();

	// Types
	interface DeliveryLocation {
		id: number;
		name: string;
		price: number;
	}

	// State
	let allLocations = $state<DeliveryLocation[]>([]);
	let filteredLocations = $state<DeliveryLocation[]>([]);
	let isOpen = $state(false);
	let isLoading = $state(true);
	let error = $state('');
	let highlightedIndex = $state(0);
	let inputElement: HTMLInputElement;

	// Load all locations on mount
	onMount(async () => {
		try {
			const response = await fetch('/api/shop/delivery-locations?limit=300');
			if (!response.ok) throw new Error('Failed to load delivery locations');

			const data = await response.json();
			allLocations = data.data || [];
			isLoading = false;
		} catch (e: any) {
			error = e.message || 'Ошибка загрузки';
			isLoading = false;
		}
	});

	// Filter locations based on input
	function filterLocations(searchTerm: string) {
		if (!searchTerm.trim()) {
			// Show first 10 locations if no search term
			filteredLocations = allLocations.slice(0, 10);
			return;
		}

		const search = searchTerm.toLowerCase();
		filteredLocations = allLocations
			.filter(loc => loc.name.toLowerCase().includes(search))
			.slice(0, 10); // Limit to 10 results

		highlightedIndex = 0;
	}

	// Handle input change
	function handleInput(e: Event) {
		const target = e.target as HTMLInputElement;
		value = target.value;

		// Clear selection when user types
		selectedLocationId = null;
		deliveryPrice = 0;

		filterLocations(value);
		isOpen = filteredLocations.length > 0;

		// Notify parent of change
		oninput(value, null, 0);
	}

	// Handle location selection
	function selectLocation(location: DeliveryLocation) {
		value = location.name;
		selectedLocationId = location.id;
		deliveryPrice = location.price;
		isOpen = false;
		filteredLocations = [];

		// Notify parent of selection
		oninput(location.name, location.id, location.price);
	}

	// Handle keyboard navigation
	function handleKeyDown(e: KeyboardEvent) {
		if (!isOpen || filteredLocations.length === 0) return;

		switch (e.key) {
			case 'ArrowDown':
				e.preventDefault();
				highlightedIndex = Math.min(highlightedIndex + 1, filteredLocations.length - 1);
				break;
			case 'ArrowUp':
				e.preventDefault();
				highlightedIndex = Math.max(highlightedIndex - 1, 0);
				break;
			case 'Enter':
				e.preventDefault();
				if (filteredLocations[highlightedIndex]) {
					selectLocation(filteredLocations[highlightedIndex]);
				}
				break;
			case 'Escape':
				isOpen = false;
				filteredLocations = [];
				break;
		}
	}

	// Handle focus - show all locations or filtered results
	function handleFocus() {
		if (allLocations.length > 0) {
			filterLocations(value); // Re-filter with current value (or show all if empty)
			isOpen = true;
		}
	}

	// Handle blur (with delay to allow click on dropdown)
	function handleBlur() {
		setTimeout(() => {
			isOpen = false;
		}, 200);
	}

	// Format price for display
	function formatPrice(kopeks: number): string {
		const rubles = kopeks / 100;
		return rubles.toLocaleString('ru-RU');
	}
</script>

<div class="city-autocomplete">
	<div class="input-wrapper">
		<input
			bind:this={inputElement}
			type="text"
			{value}
			oninput={handleInput}
			onkeydown={handleKeyDown}
			onfocus={handleFocus}
			onblur={handleBlur}
			{placeholder}
			{required}
			class="city-input"
			class:has-selection={selectedLocationId !== null}
			autocomplete="off"
			disabled={isLoading}
		/>

		{#if isLoading}
			<span class="input-icon loading">⏳</span>
		{:else if selectedLocationId !== null}
			<span class="input-icon success">✓</span>
		{/if}
	</div>

	{#if error}
		<div class="error-message">{error}</div>
	{/if}

	{#if isOpen && filteredLocations.length > 0}
		<div class="dropdown">
			<ul class="locations-list">
				{#each filteredLocations as location, index (location.id)}
					<li class="location-item" class:highlighted={index === highlightedIndex}>
						<button
							type="button"
							class="location-btn"
							onclick={() => selectLocation(location)}
						>
							<span class="location-name">{location.name}</span>
							<span class="location-price">{formatPrice(location.price)} ₽</span>
						</button>
					</li>
				{/each}
			</ul>
		</div>
	{/if}

	{#if isOpen && filteredLocations.length === 0 && value.trim().length > 0}
		<div class="dropdown">
			<div class="no-results">Населённый пункт не найден</div>
		</div>
	{/if}
</div>

<style>
	.city-autocomplete {
		position: relative;
		width: 100%;
	}

	.input-wrapper {
		position: relative;
		width: 100%;
	}

	.city-input {
		width: 100%;
		padding: 12px 40px 12px 16px;
		border-radius: 12px;
		border: 1px solid var(--border-color);
		background: var(--bg-white);
		font-size: 15px;
		color: var(--text-primary);
		transition: all 0.2s ease;
		box-sizing: border-box;
	}

	.city-input:focus {
		outline: none;
		border-color: var(--primary-orange);
		box-shadow: 0 0 0 3px rgba(255, 107, 0, 0.1);
	}

	.city-input:disabled {
		background: var(--bg-light);
		cursor: not-allowed;
		opacity: 0.7;
	}

	.city-input.has-selection {
		border-color: var(--accent-green, #22c55e);
	}

	.input-icon {
		position: absolute;
		right: 16px;
		top: 50%;
		transform: translateY(-50%);
		font-size: 16px;
		pointer-events: none;
	}

	.input-icon.loading {
		animation: pulse 1.5s ease-in-out infinite;
	}

	.input-icon.success {
		color: var(--accent-green, #22c55e);
	}

	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.5; }
	}

	.dropdown {
		position: absolute;
		top: calc(100% + 4px);
		left: 0;
		right: 0;
		background: var(--card-bg, var(--bg-white));
		border: 1px solid var(--border-color);
		border-radius: 12px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
		max-height: 280px;
		overflow-y: auto;
		z-index: 100;
		animation: slideDown 0.15s ease;
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

	.locations-list {
		list-style: none;
		margin: 0;
		padding: 4px;
	}

	.location-item {
		margin: 0;
	}

	.location-btn {
		width: 100%;
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 12px 16px;
		border: none;
		background: transparent;
		cursor: pointer;
		border-radius: 8px;
		transition: all 0.15s ease;
		text-align: left;
	}

	.location-btn:hover,
	.location-item.highlighted .location-btn {
		background: rgba(255, 107, 0, 0.08);
	}

	.location-name {
		font-size: 14px;
		color: var(--text-primary);
		font-weight: 500;
	}

	.location-price {
		font-size: 13px;
		color: var(--text-secondary);
		font-weight: 600;
		white-space: nowrap;
		margin-left: 12px;
	}

	.no-results {
		padding: 16px;
		text-align: center;
		font-size: 14px;
		color: var(--text-secondary);
	}

	.error-message {
		margin-top: 4px;
		font-size: 12px;
		color: var(--accent-red, #ef4444);
	}

	/* Scrollbar styling */
	.dropdown::-webkit-scrollbar {
		width: 8px;
	}

	.dropdown::-webkit-scrollbar-track {
		background: transparent;
	}

	.dropdown::-webkit-scrollbar-thumb {
		background: var(--border-color);
		border-radius: 4px;
	}

	.dropdown::-webkit-scrollbar-thumb:hover {
		background: var(--text-tertiary);
	}
</style>
