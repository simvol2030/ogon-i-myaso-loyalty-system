<script lang="ts">
	import { onMount } from 'svelte';

	interface User {
		id: number;
		name: string;
		email: string;
		created_at: string;
	}

	let users = $state<User[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

	onMount(async () => {
		try {
			const response = await fetch('/api/users');
			if (!response.ok) throw new Error('Failed to fetch users');
			users = await response.json();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Unknown error';
		} finally {
			loading = false;
		}
	});
</script>

<div class="user-list">
	<h2>Users from SQLite Database</h2>

	{#if loading}
		<p class="loading">Loading users...</p>
	{:else if error}
		<p class="error">Error: {error}</p>
	{:else if users.length === 0}
		<p class="empty">No users found</p>
	{:else}
		<ul>
			{#each users as user (user.id)}
				<li>
					<strong>{user.name}</strong>
					<span class="email">{user.email}</span>
					<span class="date">{new Date(user.created_at).toLocaleDateString()}</span>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.user-list {
		padding: 1rem;
		background: #f5f5f5;
		border-radius: 8px;
		margin: 1rem 0;
	}

	h2 {
		margin-top: 0;
		color: #333;
	}

	ul {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	li {
		background: white;
		padding: 1rem;
		margin: 0.5rem 0;
		border-radius: 4px;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.email {
		color: #666;
		font-size: 0.9rem;
	}

	.date {
		color: #999;
		font-size: 0.8rem;
	}

	.loading,
	.error,
	.empty {
		padding: 1rem;
		text-align: center;
	}

	.error {
		color: #d32f2f;
	}
</style>
