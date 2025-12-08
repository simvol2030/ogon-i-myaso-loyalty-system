import { db } from '$lib/server/db/client';
import { feedPosts, feedTags, feedPostImages, feedPostTags } from '$lib/server/db/schema';
import { eq, desc, asc, inArray, sql } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const typeFilter = url.searchParams.get('type') as 'post' | 'article' | null;
	const statusFilter = url.searchParams.get('status') as 'published' | 'draft' | null;

	// Загружаем все посты (включая неопубликованные)
	let postsQuery = db.select().from(feedPosts).where(eq(feedPosts.is_active, true));

	// Применяем фильтры
	const posts = await postsQuery.orderBy(desc(feedPosts.created_at));

	let filteredPosts = posts;

	if (typeFilter) {
		filteredPosts = filteredPosts.filter(p => p.type === typeFilter);
	}

	if (statusFilter) {
		if (statusFilter === 'published') {
			filteredPosts = filteredPosts.filter(p => p.is_published);
		} else {
			filteredPosts = filteredPosts.filter(p => !p.is_published);
		}
	}

	// Загружаем теги
	const tags = await db
		.select()
		.from(feedTags)
		.orderBy(asc(feedTags.sort_order));

	// Получаем количество изображений для каждого поста
	const postIds = filteredPosts.map(p => p.id);
	let imageCounts: Record<number, number> = {};
	let postTagsData: Record<number, any[]> = {};

	if (postIds.length > 0) {
		const imageCountsRaw = await db
			.select({
				post_id: feedPostImages.post_id,
				count: sql<number>`count(*)`
			})
			.from(feedPostImages)
			.where(inArray(feedPostImages.post_id, postIds))
			.groupBy(feedPostImages.post_id);

		imageCounts = imageCountsRaw.reduce((acc, ic) => {
			acc[ic.post_id] = ic.count;
			return acc;
		}, {} as Record<number, number>);

		// Загружаем теги постов
		const allPostTags = await db
			.select({
				post_id: feedPostTags.post_id,
				tag_id: feedTags.id,
				tag_name: feedTags.name,
				tag_color: feedTags.color
			})
			.from(feedPostTags)
			.innerJoin(feedTags, eq(feedPostTags.tag_id, feedTags.id))
			.where(inArray(feedPostTags.post_id, postIds));

		postTagsData = allPostTags.reduce((acc, pt) => {
			if (!acc[pt.post_id]) acc[pt.post_id] = [];
			acc[pt.post_id].push({
				id: pt.tag_id,
				name: pt.tag_name,
				color: pt.tag_color
			});
			return acc;
		}, {} as Record<number, any[]>);
	}

	// Формируем данные
	const postsWithMeta = filteredPosts.map(post => ({
		id: post.id,
		type: post.type,
		title: post.title,
		excerpt: post.excerpt || (post.content ? post.content.substring(0, 100) + '...' : ''),
		isPublished: post.is_published,
		publishedAt: post.published_at,
		viewsCount: post.views_count,
		likesCount: post.likes_count,
		dislikesCount: post.dislikes_count,
		imagesCount: imageCounts[post.id] || 0,
		tags: postTagsData[post.id] || [],
		createdAt: post.created_at,
		updatedAt: post.updated_at
	}));

	const publishedCount = posts.filter(p => p.is_published).length;
	const draftCount = posts.filter(p => !p.is_published).length;

	return {
		posts: postsWithMeta,
		tags,
		filters: {
			type: typeFilter,
			status: statusFilter
		},
		stats: {
			total: posts.length,
			published: publishedCount,
			draft: draftCount
		}
	};
};
