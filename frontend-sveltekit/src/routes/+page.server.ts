import type { PageServerLoad } from './$types';
import { env } from '$env/dynamic/public';

const BACKEND_URL = env.PUBLIC_BACKEND_URL || 'http://localhost:3000';

/**
 * Data loader for Home page - API VERSION
 * Fetches recommendations, offers, and products from backend API
 */
export const load: PageServerLoad = async ({ fetch }) => {
  try {
    const response = await fetch(`${BACKEND_URL}/api/content/home`);

    if (!response.ok) {
      console.error('[HOME PAGE] API error:', response.status, response.statusText);
      // Return empty data on error instead of failing
      return {
        recommendations: [],
        monthOffers: [],
        topProducts: [],
        store: null
      };
    }

    const data = await response.json();

    return {
      recommendations: data.recommendations || [],
      monthOffers: data.monthOffers || [],
      topProducts: data.topProducts || [],
      store: data.store || null // First store for homepage snippet
    };

  } catch (error) {
    console.error('[HOME PAGE] Failed to fetch home data:', error);
    // Return empty data on error instead of failing
    return {
      recommendations: [],
      monthOffers: [],
      topProducts: [],
      store: null
    };
  }
};
