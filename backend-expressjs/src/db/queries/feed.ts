import { db } from '../client';
import {
	feedTags,
	feedPosts,
	feedPostImages,
	feedPostTags,
	feedPostReactions
} from '../schema';
import { eq, desc, and, asc, sql, inArray } from 'drizzle-orm';
import type {
	NewFeedTag,
	NewFeedPost,
	NewFeedPostImage,
	FeedPost,
	FeedTag,
	FeedPostImage
} from '../schema';

// ============================================================
// TAGS
// ============================================================

/**
 * Получить все активные теги (для фильтра в ленте)
 */
export async function getActiveTags() {
	return await db
		.select()
		.from(feedTags)
		.where(eq(feedTags.is_active, true))
		.orderBy(asc(feedTags.sort_order));
}

/**
 * Получить все теги (для админки)
 */
export async function getAllTags() {
	return await db.select().from(feedTags).orderBy(asc(feedTags.sort_order));
}

/**
 * Получить тег по ID
 */
export async function getTagById(id: number) {
	const result = await db.select().from(feedTags).where(eq(feedTags.id, id)).limit(1);
	return result[0] || null;
}

/**
 * Получить тег по slug
 */
export async function getTagBySlug(slug: string) {
	const result = await db.select().from(feedTags).where(eq(feedTags.slug, slug)).limit(1);
	return result[0] || null;
}

/**
 * Создать тег
 */
export async function createTag(data: NewFeedTag) {
	const result = await db.insert(feedTags).values(data).returning();
	return result[0];
}

/**
 * Обновить тег
 */
export async function updateTag(id: number, data: Partial<NewFeedTag>) {
	const result = await db.update(feedTags).set(data).where(eq(feedTags.id, id)).returning();
	return result[0] || null;
}

/**
 * Удалить тег
 */
export async function deleteTag(id: number) {
	await db.delete(feedTags).where(eq(feedTags.id, id));
	return true;
}

// ============================================================
// POSTS
// ============================================================

export interface GetFeedPostsOptions {
	page?: number;
	limit?: number;
	type?: 'post' | 'article';
	tagSlug?: string;
	includeUnpublished?: boolean; // Для админки
}

export interface FeedPostWithDetails extends FeedPost {
	images: FeedPostImage[];
	tags: FeedTag[];
	userReaction?: 'like' | 'dislike' | null;
}

/**
 * Получить посты для ленты с пагинацией и фильтрами
 * FIX B1: Tag filtering теперь происходит ДО пагинации
 * FIX M1: Total count теперь учитывает tag filter
 */
export async function getFeedPosts(
	options: GetFeedPostsOptions = {},
	telegramUserId?: string
): Promise<{ posts: FeedPostWithDetails[]; total: number }> {
	const { page = 1, limit = 20, type, tagSlug, includeUnpublished = false } = options;
	const offset = (page - 1) * limit;

	// Если нужна фильтрация по тегу - получаем ID постов с этим тегом
	let tagFilteredPostIds: number[] | null = null;
	if (tagSlug) {
		const tag = await getTagBySlug(tagSlug);
		if (tag) {
			const taggedPosts = await db
				.select({ post_id: feedPostTags.post_id })
				.from(feedPostTags)
				.where(eq(feedPostTags.tag_id, tag.id));
			tagFilteredPostIds = taggedPosts.map((tp) => tp.post_id);

			if (tagFilteredPostIds.length === 0) {
				return { posts: [], total: 0 };
			}
		} else {
			// Тег не найден - возвращаем пустой результат
			return { posts: [], total: 0 };
		}
	}

	// Базовые условия фильтрации
	const baseConditions = and(
		eq(feedPosts.is_active, true),
		includeUnpublished ? undefined : eq(feedPosts.is_published, true),
		type ? eq(feedPosts.type, type) : undefined,
		// FIX B1: Применяем tag filter в WHERE, а не после запроса
		tagFilteredPostIds ? inArray(feedPosts.id, tagFilteredPostIds) : undefined
	);

	// Запрос постов с пагинацией
	const postsResult = await db
		.select()
		.from(feedPosts)
		.where(baseConditions)
		.orderBy(desc(feedPosts.published_at), desc(feedPosts.created_at))
		.limit(limit)
		.offset(offset);

	// FIX M1: Total count теперь учитывает tag filter
	const countResult = await db
		.select({ count: sql<number>`count(*)` })
		.from(feedPosts)
		.where(baseConditions);
	const total = countResult[0]?.count || 0;

	// Если нет постов - возвращаем пустой массив
	if (postsResult.length === 0) {
		return { posts: [], total };
	}

	// Получаем изображения для всех постов
	const allPostIds = postsResult.map((p) => p.id);
	const images = await db
		.select()
		.from(feedPostImages)
		.where(inArray(feedPostImages.post_id, allPostIds))
		.orderBy(asc(feedPostImages.sort_order));

	// Получаем теги для всех постов
	const postTagsJoin = await db
		.select({
			post_id: feedPostTags.post_id,
			tag: feedTags
		})
		.from(feedPostTags)
		.innerJoin(feedTags, eq(feedPostTags.tag_id, feedTags.id))
		.where(inArray(feedPostTags.post_id, allPostIds));

	// Получаем реакции пользователя если есть telegramUserId
	let userReactions: { post_id: number; reaction_type: string }[] = [];
	if (telegramUserId) {
		userReactions = await db
			.select({
				post_id: feedPostReactions.post_id,
				reaction_type: feedPostReactions.reaction_type
			})
			.from(feedPostReactions)
			.where(
				and(
					inArray(feedPostReactions.post_id, allPostIds),
					eq(feedPostReactions.telegram_user_id, telegramUserId)
				)
			);
	}

	// Собираем результат
	const postsWithDetails: FeedPostWithDetails[] = postsResult.map((post) => ({
		...post,
		images: images.filter((img) => img.post_id === post.id),
		tags: postTagsJoin.filter((pt) => pt.post_id === post.id).map((pt) => pt.tag),
		userReaction: userReactions.find((r) => r.post_id === post.id)?.reaction_type as
			| 'like'
			| 'dislike'
			| undefined
	}));

	return { posts: postsWithDetails, total };
}

/**
 * Получить один пост по ID со всеми деталями
 */
export async function getFeedPostById(
	id: number,
	telegramUserId?: string
): Promise<FeedPostWithDetails | null> {
	const postResult = await db.select().from(feedPosts).where(eq(feedPosts.id, id)).limit(1);

	if (!postResult[0]) {
		return null;
	}

	const post = postResult[0];

	// Получаем изображения
	const images = await db
		.select()
		.from(feedPostImages)
		.where(eq(feedPostImages.post_id, id))
		.orderBy(asc(feedPostImages.sort_order));

	// Получаем теги
	const postTagsJoin = await db
		.select({
			tag: feedTags
		})
		.from(feedPostTags)
		.innerJoin(feedTags, eq(feedPostTags.tag_id, feedTags.id))
		.where(eq(feedPostTags.post_id, id));

	// Получаем реакцию пользователя
	let userReaction: 'like' | 'dislike' | undefined;
	if (telegramUserId) {
		const reaction = await db
			.select({ reaction_type: feedPostReactions.reaction_type })
			.from(feedPostReactions)
			.where(
				and(
					eq(feedPostReactions.post_id, id),
					eq(feedPostReactions.telegram_user_id, telegramUserId)
				)
			)
			.limit(1);
		userReaction = reaction[0]?.reaction_type as 'like' | 'dislike' | undefined;
	}

	return {
		...post,
		images,
		tags: postTagsJoin.map((pt) => pt.tag),
		userReaction
	};
}

/**
 * Создать пост
 */
export async function createFeedPost(data: NewFeedPost) {
	const result = await db.insert(feedPosts).values(data).returning();
	return result[0];
}

/**
 * Обновить пост
 */
export async function updateFeedPost(id: number, data: Partial<NewFeedPost>) {
	const result = await db
		.update(feedPosts)
		.set({ ...data, updated_at: new Date().toISOString() })
		.where(eq(feedPosts.id, id))
		.returning();
	return result[0] || null;
}

/**
 * Удалить пост (soft delete)
 */
export async function deleteFeedPost(id: number) {
	await db.update(feedPosts).set({ is_active: false }).where(eq(feedPosts.id, id));
	return true;
}

/**
 * Полностью удалить пост (hard delete)
 */
export async function hardDeleteFeedPost(id: number) {
	await db.delete(feedPosts).where(eq(feedPosts.id, id));
	return true;
}

/**
 * Опубликовать/снять с публикации пост
 */
export async function togglePublishFeedPost(id: number, isPublished: boolean) {
	const result = await db
		.update(feedPosts)
		.set({
			is_published: isPublished,
			published_at: isPublished ? new Date().toISOString() : null,
			updated_at: new Date().toISOString()
		})
		.where(eq(feedPosts.id, id))
		.returning();
	return result[0] || null;
}

/**
 * Увеличить счётчик просмотров
 */
export async function incrementViewsCount(id: number) {
	await db
		.update(feedPosts)
		.set({ views_count: sql`${feedPosts.views_count} + 1` })
		.where(eq(feedPosts.id, id));
}

// ============================================================
// POST IMAGES
// ============================================================

/**
 * Получить изображения поста
 */
export async function getPostImages(postId: number) {
	return await db
		.select()
		.from(feedPostImages)
		.where(eq(feedPostImages.post_id, postId))
		.orderBy(asc(feedPostImages.sort_order));
}

/**
 * Добавить изображение к посту
 */
export async function addPostImage(data: NewFeedPostImage) {
	const result = await db.insert(feedPostImages).values(data).returning();
	return result[0];
}

/**
 * Удалить изображение
 */
export async function deletePostImage(id: number) {
	const result = await db
		.select()
		.from(feedPostImages)
		.where(eq(feedPostImages.id, id))
		.limit(1);
	if (result[0]) {
		await db.delete(feedPostImages).where(eq(feedPostImages.id, id));
		return result[0];
	}
	return null;
}

/**
 * Переупорядочить изображения
 */
export async function reorderPostImages(postId: number, imageIds: number[]) {
	for (let i = 0; i < imageIds.length; i++) {
		await db
			.update(feedPostImages)
			.set({ sort_order: i })
			.where(and(eq(feedPostImages.id, imageIds[i]), eq(feedPostImages.post_id, postId)));
	}
	return true;
}

// ============================================================
// POST TAGS
// ============================================================

/**
 * Установить теги для поста (заменяет все существующие)
 */
export async function setPostTags(postId: number, tagIds: number[]) {
	// Удаляем старые связи
	await db.delete(feedPostTags).where(eq(feedPostTags.post_id, postId));

	// Добавляем новые
	if (tagIds.length > 0) {
		await db.insert(feedPostTags).values(tagIds.map((tag_id) => ({ post_id: postId, tag_id })));
	}
	return true;
}

/**
 * Получить теги поста
 */
export async function getPostTags(postId: number) {
	const result = await db
		.select({ tag: feedTags })
		.from(feedPostTags)
		.innerJoin(feedTags, eq(feedPostTags.tag_id, feedTags.id))
		.where(eq(feedPostTags.post_id, postId));
	return result.map((r) => r.tag);
}

// ============================================================
// REACTIONS (Likes/Dislikes)
// ============================================================

/**
 * Поставить/изменить/убрать реакцию
 * FIX H1: Защита от race condition через UNIQUE constraint
 * Порядок: сначала обновляем реакцию, потом пересчитываем счётчики из БД
 */
export async function setReaction(
	postId: number,
	telegramUserId: string,
	reactionType: 'like' | 'dislike' | null
) {
	// Получаем текущую реакцию
	const existing = await db
		.select()
		.from(feedPostReactions)
		.where(
			and(
				eq(feedPostReactions.post_id, postId),
				eq(feedPostReactions.telegram_user_id, telegramUserId)
			)
		)
		.limit(1);

	const oldReaction = existing[0]?.reaction_type as 'like' | 'dislike' | undefined;

	// Если реакция null - удаляем
	if (reactionType === null) {
		if (existing[0]) {
			await db.delete(feedPostReactions).where(eq(feedPostReactions.id, existing[0].id));
		}
	} else if (existing[0]) {
		// Если уже есть реакция - обновляем
		if (oldReaction !== reactionType) {
			await db
				.update(feedPostReactions)
				.set({ reaction_type: reactionType })
				.where(eq(feedPostReactions.id, existing[0].id));
		}
	} else {
		// Новая реакция - используем INSERT с обработкой UNIQUE constraint
		try {
			await db.insert(feedPostReactions).values({
				post_id: postId,
				telegram_user_id: telegramUserId,
				reaction_type: reactionType
			});
		} catch (error: any) {
			// FIX H1: Если произошёл race condition и запись уже есть - обновляем
			if (error.message?.includes('UNIQUE constraint')) {
				await db
					.update(feedPostReactions)
					.set({ reaction_type: reactionType })
					.where(
						and(
							eq(feedPostReactions.post_id, postId),
							eq(feedPostReactions.telegram_user_id, telegramUserId)
						)
					);
			} else {
				throw error;
			}
		}
	}

	// FIX H1: Пересчитываем счётчики из БД (атомарно и точно)
	const likesResult = await db
		.select({ count: sql<number>`count(*)` })
		.from(feedPostReactions)
		.where(and(eq(feedPostReactions.post_id, postId), eq(feedPostReactions.reaction_type, 'like')));

	const dislikesResult = await db
		.select({ count: sql<number>`count(*)` })
		.from(feedPostReactions)
		.where(
			and(eq(feedPostReactions.post_id, postId), eq(feedPostReactions.reaction_type, 'dislike'))
		);

	const newLikesCount = likesResult[0]?.count || 0;
	const newDislikesCount = dislikesResult[0]?.count || 0;

	// Обновляем агрегированные счётчики в посте
	await db
		.update(feedPosts)
		.set({
			likes_count: newLikesCount,
			dislikes_count: newDislikesCount
		})
		.where(eq(feedPosts.id, postId));

	return {
		userReaction: reactionType,
		likes_count: newLikesCount,
		dislikes_count: newDislikesCount
	};
}
