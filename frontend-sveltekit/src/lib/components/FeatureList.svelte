<script lang="ts">
	import { onMount } from 'svelte';

	interface Feature {
		id: number;
		title: string;
		description: string;
	}

	let features = $state<Feature[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

	onMount(async () => {
		try {
			const response = await fetch('/data/sample.json');
			if (!response.ok) throw new Error('Failed to fetch features');
			const data = await response.json();
			features = data.features;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Unknown error';
		} finally {
			loading = false;
		}
	});
</script>

<div class="feature-list">
	<h2>Features from JSON (Pseudo API)</h2>

	{#if loading}
		<p class="loading">Loading features...</p>
	{:else if error}
		<p class="error">Error: {error}</p>
	{:else if features.length === 0}
		<p class="empty">No features found</p>
	{:else}
		<div class="features">
			{#each features as feature (feature.id)}
				<div class="feature-card">
					<h3>{feature.title}</h3>
					<p>{feature.description}</p>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.feature-list {
		padding: 1rem;
		background: #e8f5e9;
		border-radius: 8px;
		margin: 1rem 0;
	}

	h2 {
		margin-top: 0;
		color: #2e7d32;
	}

	.features {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
		gap: 1rem;
	}

	.feature-card {
		background: white;
		padding: 1.5rem;
		border-radius: 4px;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
		border-left: 4px solid #4caf50;
	}

	h3 {
		margin: 0 0 0.5rem 0;
		color: #1b5e20;
	}

	p {
		color: #555;
		margin: 0;
		line-height: 1.5;
	}

	.loading,
	.error,
	.empty {
		padding: 1rem;
		text-align: center;
	}

	.error {
		color: #c62828;
	}
</style>
