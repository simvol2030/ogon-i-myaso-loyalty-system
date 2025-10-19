import type { PageServerLoad } from './$types';
import { queries } from '$lib/server/db/database';

export const load: PageServerLoad = async () => {
	// Получаем статистику
	const usersCount = queries.getAllUsers.all().length;
	const postsCount = queries.getAllPosts.all().length;
	const publishedCount = queries.getAllPosts.all().filter((p: any) => p.published === 1).length;

	// Получаем недавние посты
	const recentPosts = queries.getAllPosts.all().slice(0, 5);

	return {
		stats: {
			users: usersCount,
			posts: postsCount,
			published: publishedCount,
			drafts: postsCount - publishedCount
		},
		recentPosts
	};
};
