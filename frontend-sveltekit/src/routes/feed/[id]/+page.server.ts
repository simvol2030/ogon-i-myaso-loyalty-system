import { db } from '$lib/server/db/client';
import { feedPosts, feedTags, feedPostImages, feedPostTags } from '$lib/server/db/schema';
import { eq, and, asc, sql } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const postId = parseInt(params.id);

	if (isNaN(postId)) {
		throw error(404, 'Пост не найден');
	}

	// Загружаем пост
	const posts = await db
		.select()
		.from(feedPosts)
		.where(
			and(
				eq(feedPosts.id, postId),
				eq(feedPosts.is_active, true),
				eq(feedPosts.is_published, true)
			)
		)
		.limit(1);

	if (posts.length === 0) {
		throw error(404, 'Пост не найден');
	}

	const post = posts[0];

	// Увеличиваем счётчик просмотров
	await db
		.update(feedPosts)
		.set({ views_count: sql`${feedPosts.views_count} + 1` })
		.where(eq(feedPosts.id, postId));

	// Загружаем изображения
	const images = await db
		.select()
		.from(feedPostImages)
		.where(eq(feedPostImages.post_id, postId))
		.orderBy(asc(feedPostImages.sort_order));

	// Загружаем теги
	const postTags = await db
		.select({
			id: feedTags.id,
			name: feedTags.name,
			slug: feedTags.slug,
			color: feedTags.color
		})
		.from(feedPostTags)
		.innerJoin(feedTags, eq(feedPostTags.tag_id, feedTags.id))
		.where(eq(feedPostTags.post_id, postId));

	return {
		post: {
			id: post.id,
			type: post.type,
			title: post.title,
			content: post.content,
			excerpt: post.excerpt,
			authorName: post.author_name,
			publishedAt: post.published_at,
			viewsCount: post.views_count + 1, // +1 за текущий просмотр
			likesCount: post.likes_count,
			dislikesCount: post.dislikes_count,
			images: images.map(img => ({
				id: img.id,
				url: `/api/uploads/feed/${img.filename}`,
				altText: img.alt_text,
				positionInContent: img.position_in_content,
				sortOrder: img.sort_order
			})),
			tags: postTags
		}
	};
};
