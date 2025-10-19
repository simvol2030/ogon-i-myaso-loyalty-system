<script lang="ts">
	import { onMount } from 'svelte';

	interface Post {
		id: number;
		title: string;
		content: string;
		author_name: string;
		author_email: string;
		created_at: string;
	}

	let posts = $state<Post[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

	onMount(async () => {
		try {
			const response = await fetch('/api/posts');
			if (!response.ok) throw new Error('Failed to fetch posts');
			posts = await response.json();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Unknown error';
		} finally {
			loading = false;
		}
	});
</script>

<div class="post-list">
	<h2>Posts from SQLite Database</h2>

	{#if loading}
		<p class="loading">Loading posts...</p>
	{:else if error}
		<p class="error">Error: {error}</p>
	{:else if posts.length === 0}
		<p class="empty">No posts found</p>
	{:else}
		<div class="posts">
			{#each posts as post (post.id)}
				<article>
					<h3>{post.title}</h3>
					<p class="content">{post.content}</p>
					<div class="meta">
						<span class="author">By {post.author_name}</span>
						<span class="date">{new Date(post.created_at).toLocaleDateString()}</span>
					</div>
				</article>
			{/each}
		</div>
	{/if}
</div>

<style>
	.post-list {
		padding: 1rem;
		background: #f9f9f9;
		border-radius: 8px;
		margin: 1rem 0;
	}

	h2 {
		margin-top: 0;
		color: #333;
	}

	.posts {
		display: grid;
		gap: 1rem;
	}

	article {
		background: white;
		padding: 1.5rem;
		border-radius: 4px;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
	}

	h3 {
		margin: 0 0 0.5rem 0;
		color: #222;
	}

	.content {
		color: #555;
		line-height: 1.6;
		margin: 0.5rem 0;
	}

	.meta {
		display: flex;
		justify-content: space-between;
		margin-top: 1rem;
		padding-top: 1rem;
		border-top: 1px solid #eee;
		font-size: 0.85rem;
		color: #666;
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
