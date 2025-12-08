<script lang="ts">
	import ImageSlider from '$lib/components/ImageSlider.svelte';
	import { browser } from '$app/environment';

	let { data } = $props();

	// Telegram user ID для реакций
	let telegramUserId = $state<string | null>(null);

	// Локальное состояние реакций (для оптимистичного обновления)
	let localReactions = $state<Record<number, { likes: number; dislikes: number; userReaction: 'like' | 'dislike' | null }>>({});

	$effect(() => {
		if (browser && typeof window !== 'undefined') {
			// Получаем Telegram user ID
			const tgUser = (window as any).Telegram?.WebApp?.initDataUnsafe?.user;
			if (tgUser?.id) {
				telegramUserId = tgUser.id.toString();
			}
		}
	});

	// Форматирование даты
	function formatDate(dateStr: string | null): string {
		if (!dateStr) return '';
		const date = new Date(dateStr);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

		if (diffDays === 0) return 'Сегодня';
		if (diffDays === 1) return 'Вчера';
		if (diffDays < 7) return `${diffDays} дн. назад`;

		return date.toLocaleDateString('ru-RU', {
			day: 'numeric',
			month: 'short'
		});
	}

	// Обработка лайков/дизлайков
	async function handleReaction(postId: number, type: 'like' | 'dislike') {
		if (!telegramUserId) {
			// Показать подсказку что нужен Telegram
			return;
		}

		const post = data.posts.find(p => p.id === postId);
		if (!post) return;

		const current = localReactions[postId] || {
			likes: post.likesCount,
			dislikes: post.dislikesCount,
			userReaction: null
		};

		// Определяем новую реакцию
		let newReaction: 'like' | 'dislike' | null = type;
		if (current.userReaction === type) {
			newReaction = null; // Убираем реакцию
		}

		// Оптимистичное обновление
		let newLikes = post.likesCount;
		let newDislikes = post.dislikesCount;

		if (current.userReaction === 'like') newLikes--;
		if (current.userReaction === 'dislike') newDislikes--;
		if (newReaction === 'like') newLikes++;
		if (newReaction === 'dislike') newDislikes++;

		localReactions[postId] = {
			likes: newLikes,
			dislikes: newDislikes,
			userReaction: newReaction
		};

		// Отправляем на сервер
		try {
			const response = await fetch(`/api/feed/${postId}/reaction`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					telegramUserId,
					type: newReaction
				})
			});

			if (response.ok) {
				const result = await response.json();
				localReactions[postId] = {
					likes: result.likesCount,
					dislikes: result.dislikesCount,
					userReaction: result.userReaction
				};
			}
		} catch (error) {
			console.error('Failed to set reaction:', error);
		}
	}

	// Получаем данные о реакциях с учётом локального состояния
	function getPostReactions(post: any) {
		return localReactions[post.id] || {
			likes: post.likesCount,
			dislikes: post.dislikesCount,
			userReaction: null
		};
	}
</script>

<svelte:head>
	<title>Лента - Мурзико</title>
</svelte:head>

<div class="feed-page">
	<header class="page-header">
		<!-- FIX M4: Убран emoji из заголовка -->
		<h1>Лента</h1>
		<p class="subtitle">Новости и полезные материалы</p>
	</header>

	<!-- Теги/Фильтры -->
	{#if data.tags.length > 0}
		<div class="tags-filter">
			<a
				href="/feed"
				class="tag-btn"
				class:active={!data.activeTag}
			>
				Все
			</a>
			{#each data.tags as tag}
				<a
					href="/feed?tag={tag.slug}"
					class="tag-btn"
					class:active={data.activeTag === tag.slug}
					style="--tag-color: {tag.color}"
				>
					{tag.name}
				</a>
			{/each}
		</div>
	{/if}

	<!-- Список постов -->
	<div class="posts-list">
		{#each data.posts as post (post.id)}
			{@const reactions = getPostReactions(post)}
			<article class="post-card" class:is-article={post.type === 'article'}>
				<!-- Слайдер изображений -->
				{#if post.images && post.images.length > 0}
					<ImageSlider images={post.images} />
				{/if}

				<div class="post-content">
					<!-- Заголовок (для статей) -->
					{#if post.type === 'article' && post.title}
						<h2 class="post-title">
							<a href="/feed/{post.id}">{post.title}</a>
						</h2>
					{/if}

					<!-- Текст -->
					<div class="post-text">
						{#if post.type === 'article'}
							<p>{post.content}</p>
							<a href="/feed/{post.id}" class="read-more">Читать далее →</a>
						{:else}
							<p>{post.content}</p>
						{/if}
					</div>

					<!-- Теги поста -->
					{#if post.tags && post.tags.length > 0}
						<div class="post-tags">
							{#each post.tags as tag}
								<a
									href="/feed?tag={tag.slug}"
									class="post-tag"
									style="background: {tag.color}20; color: {tag.color}"
								>
									#{tag.name}
								</a>
							{/each}
						</div>
					{/if}

					<!-- Футер поста -->
					<div class="post-footer">
						<div class="reactions">
							<button
								class="reaction-btn"
								class:active={reactions.userReaction === 'like'}
								onclick={() => handleReaction(post.id, 'like')}
								disabled={!telegramUserId}
								title={telegramUserId ? 'Нравится' : 'Войдите через Telegram'}
							>
								<span class="reaction-icon">👍</span>
								<span class="reaction-count">{reactions.likes}</span>
							</button>
							<button
								class="reaction-btn"
								class:active={reactions.userReaction === 'dislike'}
								onclick={() => handleReaction(post.id, 'dislike')}
								disabled={!telegramUserId}
								title={telegramUserId ? 'Не нравится' : 'Войдите через Telegram'}
							>
								<span class="reaction-icon">👎</span>
								<span class="reaction-count">{reactions.dislikes}</span>
							</button>
						</div>
						<span class="post-date">
							📅 {formatDate(post.publishedAt)}
						</span>
					</div>
				</div>
			</article>
		{/each}
	</div>

	<!-- Пустое состояние -->
	{#if data.posts.length === 0}
		<div class="empty-state">
			<span class="empty-icon">📭</span>
			<h2>Пока нет публикаций</h2>
			<p>Скоро здесь появятся интересные новости</p>
			{#if data.activeTag}
				<a href="/feed" class="btn-reset-filter">Показать все</a>
			{/if}
		</div>
	{/if}
</div>

<style>
	.feed-page {
		padding: 0 16px 100px;
		max-width: 520px;
		margin: 0 auto;
	}

	.page-header {
		text-align: center;
		padding: 24px 0 16px;
	}

	.page-header h1 {
		font-size: 28px;
		font-weight: bold;
		color: var(--text-primary);
		margin: 0 0 8px 0;
		letter-spacing: -0.025em;
	}

	.subtitle {
		font-size: 15px;
		color: var(--text-secondary);
		margin: 0;
	}

	/* Tags Filter */
	.tags-filter {
		display: flex;
		gap: 8px;
		overflow-x: auto;
		padding: 0 4px 16px;
		scrollbar-width: none;
		-ms-overflow-style: none;
	}

	.tags-filter::-webkit-scrollbar {
		display: none;
	}

	.tag-btn {
		flex-shrink: 0;
		padding: 8px 16px;
		border-radius: 20px;
		font-size: 14px;
		font-weight: 600;
		text-decoration: none;
		transition: all 0.2s ease;
		background: var(--bg-tertiary);
		color: var(--text-secondary);
		border: 1px solid transparent;
	}

	.tag-btn:hover {
		background: var(--bg-light);
		color: var(--text-primary);
	}

	.tag-btn.active {
		background: var(--primary-orange);
		color: white;
	}

	/* Posts List */
	.posts-list {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.post-card {
		background: var(--card-bg);
		border-radius: 16px;
		overflow: hidden;
		box-shadow: var(--shadow);
		transition: all 0.3s ease;
	}

	.post-card:hover {
		box-shadow: var(--shadow-lg);
		transform: translateY(-2px);
	}

	.post-content {
		padding: 16px 20px 20px;
	}

	.post-title {
		font-size: 18px;
		font-weight: bold;
		color: var(--text-primary);
		margin: 0 0 12px 0;
		line-height: 1.4;
	}

	.post-title a {
		color: inherit;
		text-decoration: none;
	}

	.post-title a:hover {
		color: var(--primary-orange);
	}

	.post-text {
		font-size: 15px;
		line-height: 1.6;
		color: var(--text-primary);
		margin-bottom: 12px;
	}

	.post-text p {
		margin: 0;
		white-space: pre-line;
	}

	.read-more {
		display: inline-block;
		margin-top: 8px;
		color: var(--primary-orange);
		font-weight: 600;
		text-decoration: none;
		font-size: 14px;
	}

	.read-more:hover {
		text-decoration: underline;
	}

	/* Post Tags */
	.post-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-bottom: 12px;
	}

	.post-tag {
		padding: 4px 10px;
		border-radius: 12px;
		font-size: 12px;
		font-weight: 500;
		text-decoration: none;
		transition: all 0.2s ease;
	}

	.post-tag:hover {
		filter: brightness(0.9);
	}

	/* Post Footer */
	.post-footer {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding-top: 12px;
		border-top: 1px solid var(--border-color);
	}

	.reactions {
		display: flex;
		gap: 8px;
	}

	.reaction-btn {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 6px 12px;
		border-radius: 20px;
		border: 1px solid var(--border-color);
		background: var(--bg-light);
		cursor: pointer;
		transition: all 0.2s ease;
		font-size: 14px;
		color: var(--text-secondary);
	}

	.reaction-btn:hover:not(:disabled) {
		background: var(--bg-tertiary);
		border-color: var(--text-tertiary);
	}

	.reaction-btn.active {
		background: var(--primary-orange);
		color: white;
		border-color: var(--primary-orange);
	}

	.reaction-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.reaction-icon {
		font-size: 16px;
	}

	.reaction-count {
		font-weight: 600;
	}

	.post-date {
		font-size: 13px;
		color: var(--text-tertiary);
	}

	/* Empty State */
	.empty-state {
		text-align: center;
		padding: 64px 20px;
	}

	.empty-icon {
		font-size: 64px;
		display: block;
		margin-bottom: 16px;
		opacity: 0.5;
	}

	.empty-state h2 {
		font-size: 20px;
		font-weight: bold;
		color: var(--text-primary);
		margin: 0 0 8px 0;
	}

	.empty-state p {
		font-size: 15px;
		color: var(--text-secondary);
		margin: 0 0 16px 0;
	}

	.btn-reset-filter {
		display: inline-block;
		padding: 10px 20px;
		background: var(--primary-orange);
		color: white;
		border-radius: 10px;
		text-decoration: none;
		font-weight: 600;
		transition: all 0.2s ease;
	}

	.btn-reset-filter:hover {
		background: var(--primary-orange-dark);
	}

	/* Telegram theme adaptations */
	:global([data-theme="dark"]) .post-card {
		background: var(--card-bg);
	}

	:global([data-theme="dark"]) .tag-btn:not(.active) {
		background: var(--bg-tertiary);
		color: var(--text-secondary);
	}

	:global([data-theme="dark"]) .reaction-btn:not(.active) {
		background: var(--bg-tertiary);
		border-color: var(--border-color);
	}
</style>
