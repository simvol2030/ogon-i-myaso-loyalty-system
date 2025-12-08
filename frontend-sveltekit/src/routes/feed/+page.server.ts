import { db } from '$lib/server/db/client';
import { feedPosts, feedTags, feedPostImages, feedPostTags } from '$lib/server/db/schema';
import { eq, and, desc, asc, inArray } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const tagSlug = url.searchParams.get('tag');

	// Загружаем активные теги
	const tags = await db
		.select()
		.from(feedTags)
		.where(eq(feedTags.is_active, true))
		.orderBy(asc(feedTags.sort_order));

	// FIX C1: Tag filtering теперь происходит ДО загрузки постов
	let tagFilteredPostIds: number[] | null = null;
	if (tagSlug) {
		const tag = tags.find(t => t.slug === tagSlug);
		if (tag) {
			const taggedPostIds = await db
				.select({ post_id: feedPostTags.post_id })
				.from(feedPostTags)
				.where(eq(feedPostTags.tag_id, tag.id));

			tagFilteredPostIds = taggedPostIds.map(tp => tp.post_id);

			// Если нет постов с этим тегом - возвращаем пустой результат
			if (tagFilteredPostIds.length === 0) {
				return {
					posts: [],
					tags: tags.map(t => ({
						id: t.id,
						name: t.name,
						slug: t.slug,
						color: t.color
					})),
					activeTag: tagSlug
				};
			}
		} else {
			// Тег не найден - возвращаем пустой результат
			return {
				posts: [],
				tags: tags.map(t => ({
					id: t.id,
					name: t.name,
					slug: t.slug,
					color: t.color
				})),
				activeTag: tagSlug
			};
		}
	}

	// FIX C1 + H1: Запрос постов с фильтрацией по тегу в WHERE
	const posts = await db
		.select()
		.from(feedPosts)
		.where(
			and(
				eq(feedPosts.is_active, true),
				eq(feedPosts.is_published, true),
				// FIX C1: Применяем tag filter в WHERE
				tagFilteredPostIds ? inArray(feedPosts.id, tagFilteredPostIds) : undefined
			)
		)
		.orderBy(desc(feedPosts.published_at), desc(feedPosts.created_at))
		.limit(50); // FIX H1: Добавлен лимит для предотвращения загрузки всех постов

	// Получаем изображения для всех постов
	const postIds = posts.map(p => p.id);
	let allImages: any[] = [];
	let allPostTags: any[] = [];

	if (postIds.length > 0) {
		allImages = await db
			.select()
			.from(feedPostImages)
			.where(inArray(feedPostImages.post_id, postIds))
			.orderBy(asc(feedPostImages.sort_order));

		// Получаем теги для постов
		allPostTags = await db
			.select({
				post_id: feedPostTags.post_id,
				tag_id: feedPostTags.tag_id,
				tag_name: feedTags.name,
				tag_slug: feedTags.slug,
				tag_color: feedTags.color
			})
			.from(feedPostTags)
			.innerJoin(feedTags, eq(feedPostTags.tag_id, feedTags.id))
			.where(inArray(feedPostTags.post_id, postIds));
	}

	// Группируем данные
	const imagesByPost = allImages.reduce((acc, img) => {
		if (!acc[img.post_id]) {
			acc[img.post_id] = [];
		}
		acc[img.post_id].push({
			id: img.id,
			url: `/api/uploads/feed/${img.filename}`,
			altText: img.alt_text,
			positionInContent: img.position_in_content
		});
		return acc;
	}, {} as Record<number, any[]>);

	const tagsByPost = allPostTags.reduce((acc, pt) => {
		if (!acc[pt.post_id]) {
			acc[pt.post_id] = [];
		}
		acc[pt.post_id].push({
			id: pt.tag_id,
			name: pt.tag_name,
			slug: pt.tag_slug,
			color: pt.tag_color
		});
		return acc;
	}, {} as Record<number, any[]>);

	// Формируем итоговые данные
	const postsWithData = posts.map(post => ({
		id: post.id,
		type: post.type,
		title: post.title,
		content: post.type === 'article' ? (post.excerpt || post.content.substring(0, 200) + '...') : post.content,
		fullContent: post.content,
		excerpt: post.excerpt,
		authorName: post.author_name,
		publishedAt: post.published_at,
		viewsCount: post.views_count,
		likesCount: post.likes_count,
		dislikesCount: post.dislikes_count,
		images: imagesByPost[post.id] || [],
		tags: tagsByPost[post.id] || []
	}));

	return {
		posts: postsWithData,
		tags: tags.map(t => ({
			id: t.id,
			name: t.name,
			slug: t.slug,
			color: t.color
		})),
		activeTag: tagSlug
	};
};
