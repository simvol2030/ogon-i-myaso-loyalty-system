<script lang="ts">
	import ImageSlider from '$lib/components/ImageSlider.svelte';
	import { browser } from '$app/environment';

	let { data } = $props();

	// Telegram user ID
	let telegramUserId = $state<string | null>(null);

	// Локальное состояние реакций
	let localReaction = $state<{ likes: number; dislikes: number; userReaction: 'like' | 'dislike' | null }>({
		likes: data.post.likesCount,
		dislikes: data.post.dislikesCount,
		userReaction: null
	});

	$effect(() => {
		if (browser && typeof window !== 'undefined') {
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
		return date.toLocaleDateString('ru-RU', {
			day: 'numeric',
			month: 'long',
			year: 'numeric'
		});
	}

	/**
	 * Обработка markdown (простой)
	 * FIX H3: Санитизация HTML для защиты от XSS
	 */
	function renderMarkdown(text: string): string {
		if (!text) return '';

		// FIX H3: Экранируем HTML перед обработкой markdown
		let html = text
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#039;');

		// Теперь безопасно обрабатываем markdown
		html = html
			// Заголовки
			.replace(/^### (.*$)/gim, '<h3>$1</h3>')
			.replace(/^## (.*$)/gim, '<h2>$1</h2>')
			.replace(/^# (.*$)/gim, '<h1>$1</h1>')
			// Жирный текст
			.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
			// Курсив
			.replace(/\*(.*?)\*/g, '<em>$1</em>')
			// Ссылки - FIX H3: валидируем URL (только http/https)
			.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
			// Списки
			.replace(/^\- (.*$)/gim, '<li>$1</li>')
			// Параграфы
			.replace(/\n\n/g, '</p><p>')
			// Переносы строк
			.replace(/\n/g, '<br>');

		// Оборачиваем списки
		html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');

		return `<p>${html}</p>`;
	}

	// Вставка изображений в контент
	function getContentWithImages(): { html: string; sliderImages: any[] } {
		const post = data.post;
		const sliderImages = post.images.filter((img: any) => img.positionInContent === null);
		const inlineImages = post.images.filter((img: any) => img.positionInContent !== null);

		let content = renderMarkdown(post.content);

		// Вставляем inline изображения по позициям (пока простая логика)
		// TODO: более сложная логика с маркерами [image:1]

		return {
			html: content,
			sliderImages
		};
	}

	// Обработка реакций
	async function handleReaction(type: 'like' | 'dislike') {
		if (!telegramUserId) return;

		const current = localReaction;
		let newReaction: 'like' | 'dislike' | null = type;
		if (current.userReaction === type) {
			newReaction = null;
		}

		// Оптимистичное обновление
		let newLikes = data.post.likesCount;
		let newDislikes = data.post.dislikesCount;

		if (current.userReaction === 'like') newLikes--;
		if (current.userReaction === 'dislike') newDislikes--;
		if (newReaction === 'like') newLikes++;
		if (newReaction === 'dislike') newDislikes++;

		localReaction = {
			likes: newLikes,
			dislikes: newDislikes,
			userReaction: newReaction
		};

		try {
			const response = await fetch(`/api/feed/${data.post.id}/reaction`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					telegramUserId,
					type: newReaction
				})
			});

			if (response.ok) {
				const result = await response.json();
				localReaction = {
					likes: result.likesCount,
					dislikes: result.dislikesCount,
					userReaction: result.userReaction
				};
			}
		} catch (error) {
			console.error('Failed to set reaction:', error);
		}
	}

	const { html: contentHtml, sliderImages } = $derived(getContentWithImages());
</script>

<svelte:head>
	<title>{data.post.title || 'Публикация'} - Мурзико</title>
</svelte:head>

<div class="post-detail-page">
	<!-- Навигация назад -->
	<a href="/feed" class="back-link">
		<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
			<path d="M19 12H5M12 19l-7-7 7-7" />
		</svg>
		Назад к ленте
	</a>

	<article class="post-detail">
		<!-- Слайдер изображений (только для постов или если нет inline изображений) -->
		{#if sliderImages.length > 0}
			<div class="post-images">
				<ImageSlider images={sliderImages} />
			</div>
		{/if}

		<div class="post-content">
			<!-- Заголовок -->
			{#if data.post.title}
				<h1 class="post-title">{data.post.title}</h1>
			{/if}

			<!-- Мета информация -->
			<div class="post-meta">
				{#if data.post.authorName}
					<span class="author">✍️ {data.post.authorName}</span>
				{/if}
				<span class="date">📅 {formatDate(data.post.publishedAt)}</span>
				<span class="views">👁️ {data.post.viewsCount} просм.</span>
			</div>

			<!-- Контент -->
			<div class="post-body">
				{@html contentHtml}
			</div>

			<!-- Inline изображения для статей -->
			{#if data.post.type === 'article'}
				{#each data.post.images.filter((img: any) => img.positionInContent !== null) as image}
					<figure class="inline-image">
						<img src={image.url} alt={image.altText || 'Изображение'} />
						{#if image.altText}
							<figcaption>{image.altText}</figcaption>
						{/if}
					</figure>
				{/each}
			{/if}

			<!-- Теги -->
			{#if data.post.tags && data.post.tags.length > 0}
				<div class="post-tags">
					{#each data.post.tags as tag}
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

			<!-- Реакции -->
			<div class="post-reactions">
				<button
					class="reaction-btn"
					class:active={localReaction.userReaction === 'like'}
					onclick={() => handleReaction('like')}
					disabled={!telegramUserId}
				>
					<span class="reaction-icon">👍</span>
					<span class="reaction-count">{localReaction.likes}</span>
				</button>
				<button
					class="reaction-btn"
					class:active={localReaction.userReaction === 'dislike'}
					onclick={() => handleReaction('dislike')}
					disabled={!telegramUserId}
				>
					<span class="reaction-icon">👎</span>
					<span class="reaction-count">{localReaction.dislikes}</span>
				</button>
			</div>
		</div>
	</article>
</div>

<style>
	.post-detail-page {
		padding: 0 16px 100px;
		max-width: 640px;
		margin: 0 auto;
	}

	.back-link {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 12px 0;
		color: var(--primary-orange);
		text-decoration: none;
		font-weight: 600;
		font-size: 15px;
		transition: all 0.2s ease;
	}

	.back-link:hover {
		gap: 12px;
	}

	.post-detail {
		background: var(--card-bg);
		border-radius: 16px;
		overflow: hidden;
		box-shadow: var(--shadow);
	}

	.post-images {
		margin-bottom: 0;
	}

	.post-content {
		padding: 20px 24px 24px;
	}

	.post-title {
		font-size: 24px;
		font-weight: bold;
		color: var(--text-primary);
		margin: 0 0 16px 0;
		line-height: 1.3;
		letter-spacing: -0.025em;
	}

	.post-meta {
		display: flex;
		flex-wrap: wrap;
		gap: 16px;
		margin-bottom: 20px;
		padding-bottom: 16px;
		border-bottom: 1px solid var(--border-color);
	}

	.post-meta span {
		font-size: 14px;
		color: var(--text-secondary);
	}

	.post-body {
		font-size: 16px;
		line-height: 1.7;
		color: var(--text-primary);
	}

	.post-body :global(h1),
	.post-body :global(h2),
	.post-body :global(h3) {
		margin: 24px 0 12px;
		color: var(--text-primary);
		font-weight: bold;
	}

	.post-body :global(h1) { font-size: 22px; }
	.post-body :global(h2) { font-size: 20px; }
	.post-body :global(h3) { font-size: 18px; }

	.post-body :global(p) {
		margin: 0 0 16px;
	}

	.post-body :global(a) {
		color: var(--primary-orange);
		text-decoration: none;
	}

	.post-body :global(a:hover) {
		text-decoration: underline;
	}

	.post-body :global(ul) {
		margin: 16px 0;
		padding-left: 24px;
	}

	.post-body :global(li) {
		margin-bottom: 8px;
	}

	.post-body :global(strong) {
		font-weight: 600;
	}

	.inline-image {
		margin: 24px 0;
	}

	.inline-image img {
		width: 100%;
		border-radius: 12px;
	}

	.inline-image figcaption {
		margin-top: 8px;
		font-size: 14px;
		color: var(--text-tertiary);
		text-align: center;
	}

	.post-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin: 24px 0;
		padding-top: 16px;
		border-top: 1px solid var(--border-color);
	}

	.post-tag {
		padding: 6px 12px;
		border-radius: 16px;
		font-size: 13px;
		font-weight: 500;
		text-decoration: none;
		transition: all 0.2s ease;
	}

	.post-tag:hover {
		filter: brightness(0.9);
	}

	.post-reactions {
		display: flex;
		gap: 12px;
		margin-top: 24px;
		padding-top: 20px;
		border-top: 1px solid var(--border-color);
	}

	.reaction-btn {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 10px 20px;
		border-radius: 24px;
		border: 1px solid var(--border-color);
		background: var(--bg-light);
		cursor: pointer;
		transition: all 0.2s ease;
		font-size: 16px;
		color: var(--text-secondary);
	}

	.reaction-btn:hover:not(:disabled) {
		background: var(--bg-tertiary);
		transform: scale(1.02);
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
		font-size: 20px;
	}

	.reaction-count {
		font-weight: 600;
	}

	@media (max-width: 480px) {
		.post-content {
			padding: 16px 20px 20px;
		}

		.post-title {
			font-size: 20px;
		}

		.post-meta {
			gap: 12px;
		}

		.post-body {
			font-size: 15px;
		}
	}
</style>
