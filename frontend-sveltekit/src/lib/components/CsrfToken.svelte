<script lang="ts">
	/**
	 * CSRF Token Component
	 * Автоматически добавляет скрытое поле с CSRF токеном в формы
	 *
	 * Использование:
	 * <form method="POST">
	 *   <CsrfToken />
	 *   <!-- остальные поля -->
	 * </form>
	 */
	import { page } from '$app/stores';
</script>

{#if $page.data.csrfToken}
	<input type="hidden" name="csrf_token" value={$page.data.csrfToken} />
{/if}
