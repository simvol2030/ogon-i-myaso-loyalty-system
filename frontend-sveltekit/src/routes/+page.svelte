<script lang="ts">
	import UserList from '$lib/components/UserList.svelte';
	import PostList from '$lib/components/PostList.svelte';
	import FeatureList from '$lib/components/FeatureList.svelte';
</script>

<main>
	<h1>Welcome to Project Box</h1>
	<p class="subtitle">SvelteKit + SQLite + Express.js Starter Template</p>

	<section>
		<FeatureList />
	</section>

	<section>
		<UserList />
	</section>

	<section>
		<PostList />
	</section>
</main>

<style>
	main {
		max-width: 1200px;
		margin: 0 auto;
		padding: 2rem;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell,
			sans-serif;
	}

	h1 {
		text-align: center;
		color: #333;
		margin-bottom: 0.5rem;
	}

	.subtitle {
		text-align: center;
		color: #666;
		font-size: 1.1rem;
		margin-bottom: 2rem;
	}

	section {
		margin: 2rem 0;
	}
</style>
