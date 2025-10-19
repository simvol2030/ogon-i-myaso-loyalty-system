<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Dashboard - Admin Panel</title>
</svelte:head>

<div class="dashboard">
	<div class="page-header">
		<h1>Dashboard</h1>
		<p class="text-muted">Welcome back! Here's what's happening with your content.</p>
	</div>

	<div class="stats-grid">
		<div class="stat-card">
			<div class="stat-icon">👥</div>
			<div class="stat-content">
				<p class="stat-label">Total Users</p>
				<p class="stat-value">{data.stats.users}</p>
			</div>
		</div>

		<div class="stat-card">
			<div class="stat-icon">📝</div>
			<div class="stat-content">
				<p class="stat-label">Total Posts</p>
				<p class="stat-value">{data.stats.posts}</p>
			</div>
		</div>

		<div class="stat-card">
			<div class="stat-icon">✅</div>
			<div class="stat-content">
				<p class="stat-label">Published</p>
				<p class="stat-value">{data.stats.published}</p>
			</div>
		</div>

		<div class="stat-card">
			<div class="stat-icon">📄</div>
			<div class="stat-content">
				<p class="stat-label">Drafts</p>
				<p class="stat-value">{data.stats.drafts}</p>
			</div>
		</div>
	</div>

	<div class="section">
		<h2>Recent Posts</h2>
		<div class="table-container">
			<table>
				<thead>
					<tr>
						<th>Title</th>
						<th>Author</th>
						<th>Status</th>
						<th>Date</th>
					</tr>
				</thead>
				<tbody>
					{#each data.recentPosts as post}
						<tr>
							<td>
								<a href="/posts/{post.id}" class="link">{post.title}</a>
							</td>
							<td>{post.author_name}</td>
							<td>
								<span class="badge" class:published={post.published === 1}>
									{post.published === 1 ? 'Published' : 'Draft'}
								</span>
							</td>
							<td class="text-muted">
								{new Date(post.created_at).toLocaleDateString()}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
</div>

<style>
	.dashboard {
		max-width: 1200px;
	}

	.page-header {
		margin-bottom: 2rem;
	}

	.page-header h1 {
		margin: 0 0 0.5rem 0;
		font-size: 2rem;
		font-weight: 700;
		color: #111827;
	}

	.text-muted {
		color: #6b7280;
		margin: 0;
	}

	.stats-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
		gap: 1.5rem;
		margin-bottom: 2rem;
	}

	.stat-card {
		background: white;
		padding: 1.5rem;
		border-radius: 0.75rem;
		box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1);
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.stat-icon {
		font-size: 2.5rem;
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		width: 60px;
		height: 60px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 0.75rem;
	}

	.stat-content {
		flex: 1;
	}

	.stat-label {
		margin: 0 0 0.25rem 0;
		font-size: 0.875rem;
		color: #6b7280;
		font-weight: 500;
	}

	.stat-value {
		margin: 0;
		font-size: 1.875rem;
		font-weight: 700;
		color: #111827;
	}

	.section {
		background: white;
		padding: 1.5rem;
		border-radius: 0.75rem;
		box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1);
	}

	.section h2 {
		margin: 0 0 1.5rem 0;
		font-size: 1.25rem;
		font-weight: 600;
		color: #111827;
	}

	.table-container {
		overflow-x: auto;
	}

	table {
		width: 100%;
		border-collapse: collapse;
	}

	thead {
		background-color: #f9fafb;
	}

	th {
		padding: 0.75rem 1rem;
		text-align: left;
		font-size: 0.75rem;
		font-weight: 600;
		color: #6b7280;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	td {
		padding: 1rem;
		border-top: 1px solid #e5e7eb;
		font-size: 0.875rem;
	}

	.link {
		color: #667eea;
		text-decoration: none;
		font-weight: 500;
	}

	.link:hover {
		text-decoration: underline;
	}

	.badge {
		display: inline-block;
		padding: 0.25rem 0.75rem;
		border-radius: 9999px;
		font-size: 0.75rem;
		font-weight: 600;
		background-color: #fef3c7;
		color: #92400e;
	}

	.badge.published {
		background-color: #d1fae5;
		color: #065f46;
	}
</style>
