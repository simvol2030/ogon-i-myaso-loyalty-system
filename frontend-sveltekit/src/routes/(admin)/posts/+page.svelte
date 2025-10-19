<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData, ActionData } from './$types';
	import CsrfToken from '$lib/components/CsrfToken.svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let showCreateModal = $state(false);
	let showEditModal = $state(false);
	let deleteId = $state<number | null>(null);

	let editPost = $state<any>(null);
</script>

<svelte:head>
	<title>Posts - Admin Panel</title>
</svelte:head>

<div class="page">
	<div class="page-header">
		<div>
			<h1>Posts</h1>
			<p class="text-muted">Manage your content posts</p>
		</div>
		<button class="btn-primary" onclick={() => (showCreateModal = true)}>
			+ Create Post
		</button>
	</div>

	{#if form?.error}
		<div class="alert alert-error">{form.error}</div>
	{/if}

	{#if form?.success}
		<div class="alert alert-success">Operation successful!</div>
	{/if}

	<div class="card">
		<div class="table-container">
			<table>
				<thead>
					<tr>
						<th>ID</th>
						<th>Title</th>
						<th>Author</th>
						<th>Status</th>
						<th>Created</th>
						<th>Actions</th>
					</tr>
				</thead>
				<tbody>
					{#each data.posts as post}
						<tr>
							<td>{post.id}</td>
							<td>
								<div class="post-title">{post.title}</div>
								{#if post.content}
									<div class="post-excerpt">{post.content.substring(0, 60)}...</div>
								{/if}
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
							<td>
								<div class="actions">
									<button
										class="btn-edit"
										onclick={() => {
											editPost = post;
											showEditModal = true;
										}}
									>
										Edit
									</button>
									<button
										class="btn-delete"
										onclick={() => (deleteId = post.id)}
									>
										Delete
									</button>
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
</div>

<!-- Create Modal -->
{#if showCreateModal}
	<div class="modal-overlay" onclick={() => (showCreateModal = false)}>
		<div class="modal modal-lg" onclick={(e) => e.stopPropagation()}>
			<h2>Create New Post</h2>
			<form method="POST" action="?/create" use:enhance={() => {
				return async ({ update }) => {
					await update();
					if (!form?.error) {
						showCreateModal = false;
					}
				};
			}}>
				<CsrfToken />
				<div class="form-group">
					<label for="user_id">Author</label>
					<select id="user_id" name="user_id" required>
						<option value="">Select author...</option>
						{#each data.users as user}
							<option value={user.id}>{user.name} ({user.email})</option>
						{/each}
					</select>
				</div>

				<div class="form-group">
					<label for="title">Title</label>
					<input type="text" id="title" name="title" required />
				</div>

				<div class="form-group">
					<label for="content">Content</label>
					<textarea id="content" name="content" rows="6"></textarea>
				</div>

				<div class="form-group checkbox-group">
					<label>
						<input type="checkbox" name="published" />
						<span>Publish immediately</span>
					</label>
				</div>

				<div class="modal-actions">
					<button type="button" class="btn-secondary" onclick={() => (showCreateModal = false)}>
						Cancel
					</button>
					<button type="submit" class="btn-primary">Create Post</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- Edit Modal -->
{#if showEditModal && editPost}
	<div class="modal-overlay" onclick={() => (showEditModal = false)}>
		<div class="modal modal-lg" onclick={(e) => e.stopPropagation()}>
			<h2>Edit Post</h2>
			<form method="POST" action="?/update" use:enhance={() => {
				return async ({ update }) => {
					await update();
					if (!form?.error) {
						showEditModal = false;
						editPost = null;
					}
				};
			}}>
				<CsrfToken />
				<input type="hidden" name="id" value={editPost.id} />

				<div class="form-group">
					<label for="edit_user_id">Author</label>
					<select id="edit_user_id" name="user_id" required>
						{#each data.users as user}
							<option value={user.id} selected={user.id === editPost.user_id}>
								{user.name} ({user.email})
							</option>
						{/each}
					</select>
				</div>

				<div class="form-group">
					<label for="edit_title">Title</label>
					<input type="text" id="edit_title" name="title" value={editPost.title} required />
				</div>

				<div class="form-group">
					<label for="edit_content">Content</label>
					<textarea id="edit_content" name="content" rows="6">{editPost.content || ''}</textarea>
				</div>

				<div class="form-group checkbox-group">
					<label>
						<input type="checkbox" name="published" checked={editPost.published === 1} />
						<span>Published</span>
					</label>
				</div>

				<div class="modal-actions">
					<button type="button" class="btn-secondary" onclick={() => {
						showEditModal = false;
						editPost = null;
					}}>
						Cancel
					</button>
					<button type="submit" class="btn-primary">Update Post</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- Delete Confirm Modal -->
{#if deleteId !== null}
	<div class="modal-overlay" onclick={() => (deleteId = null)}>
		<div class="modal" onclick={(e) => e.stopPropagation()}>
			<h2>Delete Post</h2>
			<p>Are you sure you want to delete this post? This action cannot be undone.</p>

			<form method="POST" action="?/delete" use:enhance={() => {
				return async ({ update }) => {
					await update();
					deleteId = null;
				};
			}}>
				<CsrfToken />
				<input type="hidden" name="id" value={deleteId} />
				<div class="modal-actions">
					<button type="button" class="btn-secondary" onclick={() => (deleteId = null)}>
						Cancel
					</button>
					<button type="submit" class="btn-danger">Delete</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<style>
	.page {
		max-width: 1200px;
	}

	.page-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
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
		font-size: 0.875rem;
	}

	.btn-primary, .btn-secondary, .btn-danger, .btn-edit, .btn-delete {
		padding: 0.625rem 1.25rem;
		border: none;
		border-radius: 0.5rem;
		font-weight: 600;
		font-size: 0.875rem;
		cursor: pointer;
		transition: all 0.2s;
	}

	.btn-primary {
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		color: white;
	}

	.btn-primary:hover {
		transform: translateY(-2px);
		box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
	}

	.btn-secondary {
		background-color: #e5e7eb;
		color: #374151;
	}

	.btn-secondary:hover {
		background-color: #d1d5db;
	}

	.btn-danger {
		background-color: #ef4444;
		color: white;
	}

	.btn-danger:hover {
		background-color: #dc2626;
	}

	.btn-edit, .btn-delete {
		padding: 0.375rem 0.75rem;
		font-size: 0.75rem;
	}

	.btn-edit {
		background-color: #dbeafe;
		color: #1e40af;
	}

	.btn-edit:hover {
		background-color: #bfdbfe;
	}

	.btn-delete {
		background-color: #fee2e2;
		color: #991b1b;
	}

	.btn-delete:hover {
		background-color: #fecaca;
	}

	.actions {
		display: flex;
		gap: 0.5rem;
	}

	.card {
		background: white;
		border-radius: 0.75rem;
		box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1);
		overflow: hidden;
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

	.post-title {
		font-weight: 600;
		color: #111827;
		margin-bottom: 0.25rem;
	}

	.post-excerpt {
		font-size: 0.75rem;
		color: #6b7280;
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

	.alert {
		padding: 1rem;
		border-radius: 0.5rem;
		margin-bottom: 1.5rem;
		font-size: 0.875rem;
	}

	.alert-error {
		background-color: #fee2e2;
		color: #991b1b;
		border: 1px solid #fca5a5;
	}

	.alert-success {
		background-color: #d1fae5;
		color: #065f46;
		border: 1px solid #6ee7b7;
	}

	.modal-overlay {
		position: fixed;
		inset: 0;
		background-color: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
	}

	.modal {
		background: white;
		border-radius: 0.75rem;
		padding: 2rem;
		width: 90%;
		max-width: 500px;
		box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1);
		max-height: 90vh;
		overflow-y: auto;
	}

	.modal-lg {
		max-width: 700px;
	}

	.modal h2 {
		margin: 0 0 1.5rem 0;
		font-size: 1.5rem;
		font-weight: 700;
		color: #111827;
	}

	.form-group {
		margin-bottom: 1.25rem;
	}

	.form-group label {
		display: block;
		font-weight: 500;
		color: #374151;
		margin-bottom: 0.5rem;
		font-size: 0.875rem;
	}

	.form-group input:not([type="checkbox"]),
	.form-group select,
	.form-group textarea {
		width: 100%;
		padding: 0.625rem 0.875rem;
		border: 1px solid #d1d5db;
		border-radius: 0.5rem;
		font-size: 0.875rem;
	}

	.form-group textarea {
		resize: vertical;
		font-family: inherit;
	}

	.form-group input:focus,
	.form-group select:focus,
	.form-group textarea:focus {
		outline: none;
		border-color: #667eea;
		box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
	}

	.checkbox-group label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
	}

	.checkbox-group input[type="checkbox"] {
		width: auto;
		cursor: pointer;
	}

	.modal-actions {
		display: flex;
		gap: 0.75rem;
		justify-content: flex-end;
		margin-top: 1.5rem;
	}
</style>
