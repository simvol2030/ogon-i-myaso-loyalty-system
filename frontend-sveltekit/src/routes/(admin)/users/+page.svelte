<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData, ActionData } from './$types';
	import CsrfToken from '$lib/components/CsrfToken.svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	let showCreateModal = $state(false);
	let showEditModal = $state(false);
	let editUser = $state<any>(null);
	let deleteId = $state<number | null>(null);
</script>

<svelte:head>
	<title>Users - Admin Panel</title>
</svelte:head>

<div class="page">
	<div class="page-header">
		<div>
			<h1>Users</h1>
			<p class="text-muted">Manage your application users</p>
		</div>
		<button class="btn-primary" onclick={() => (showCreateModal = true)}>
			+ Add User
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
						<th>Name</th>
						<th>Email</th>
						<th>Created</th>
						<th>Actions</th>
					</tr>
				</thead>
				<tbody>
					{#each data.users as user}
						<tr>
							<td>{user.id}</td>
							<td>{user.name}</td>
							<td>{user.email}</td>
							<td class="text-muted">
								{new Date(user.created_at).toLocaleDateString()}
							</td>
							<td>
								<div class="actions">
									<button
										class="btn-edit"
										onclick={() => {
											editUser = user;
											showEditModal = true;
										}}
									>
										Edit
									</button>
									<button
										class="btn-delete"
										onclick={() => (deleteId = user.id)}
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
		<div class="modal" onclick={(e) => e.stopPropagation()}>
			<h2>Create New User</h2>
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
					<label for="name">Name</label>
					<input type="text" id="name" name="name" required />
				</div>

				<div class="form-group">
					<label for="email">Email</label>
					<input type="email" id="email" name="email" required />
				</div>

				<div class="modal-actions">
					<button type="button" class="btn-secondary" onclick={() => (showCreateModal = false)}>
						Cancel
					</button>
					<button type="submit" class="btn-primary">Create User</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- Edit Modal -->
{#if showEditModal && editUser}
	<div class="modal-overlay" onclick={() => (showEditModal = false)}>
		<div class="modal" onclick={(e) => e.stopPropagation()}>
			<h2>Edit User</h2>
			<form method="POST" action="?/update" use:enhance={() => {
				return async ({ update }) => {
					await update();
					if (!form?.error) {
						showEditModal = false;
						editUser = null;
					}
				};
			}}>
				<CsrfToken />
				<input type="hidden" name="id" value={editUser.id} />

				<div class="form-group">
					<label for="edit_name">Name</label>
					<input type="text" id="edit_name" name="name" value={editUser.name} required />
				</div>

				<div class="form-group">
					<label for="edit_email">Email</label>
					<input type="email" id="edit_email" name="email" value={editUser.email} required />
				</div>

				<div class="modal-actions">
					<button type="button" class="btn-secondary" onclick={() => {
						showEditModal = false;
						editUser = null;
					}}>
						Cancel
					</button>
					<button type="submit" class="btn-primary">Update User</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- Delete Confirm Modal -->
{#if deleteId !== null}
	<div class="modal-overlay" onclick={() => (deleteId = null)}>
		<div class="modal" onclick={(e) => e.stopPropagation()}>
			<h2>Delete User</h2>
			<p>Are you sure you want to delete this user? This action cannot be undone.</p>

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

	.form-group input {
		width: 100%;
		padding: 0.625rem 0.875rem;
		border: 1px solid #d1d5db;
		border-radius: 0.5rem;
		font-size: 0.875rem;
	}

	.form-group input:focus {
		outline: none;
		border-color: #667eea;
		box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
	}

	.modal-actions {
		display: flex;
		gap: 0.75rem;
		justify-content: flex-end;
		margin-top: 1.5rem;
	}
</style>
