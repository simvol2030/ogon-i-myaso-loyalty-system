import type { PageServerLoad } from './$types';
import { env } from '$env/dynamic/public';

const BACKEND_URL = env.PUBLIC_BACKEND_URL || 'http://localhost:3000';

/**
 * Data loader for Home page - API VERSION
 * Fetches recommendations, offers, products, and free delivery info from backend API
 */
export const load: PageServerLoad = async ({ fetch }) => {
  // Default free delivery info
  const defaultFreeDeliveryInfo = {
    enabled: false,
    defaultThreshold: 3000,
    widget: {
      enabled: false,
      title: 'Бесплатная доставка',
      text: 'При заказе от {threshold}₽ доставка бесплатная в выбранные населённые пункты',
      icon: '🚚'
    },
    toast: {
      enabled: false,
      text: 'Добавьте ещё на {remaining}₽ — доставка может быть бесплатной!',
      showThreshold: 500
    },
    locationsCount: 0
  };

  try {
    // Fetch home content and free delivery info in parallel
    const [homeResponse, freeDeliveryResponse] = await Promise.all([
      fetch(`${BACKEND_URL}/api/content/home`),
      fetch(`${BACKEND_URL}/api/shop/free-delivery-info`)
    ]);

    let homeData = { recommendations: [], monthOffers: [], topProducts: [], store: null };
    let freeDeliveryInfo = defaultFreeDeliveryInfo;

    if (homeResponse.ok) {
      homeData = await homeResponse.json();
    } else {
      console.error('[HOME PAGE] Home API error:', homeResponse.status, homeResponse.statusText);
    }

    if (freeDeliveryResponse.ok) {
      const freeDeliveryData = await freeDeliveryResponse.json();
      if (freeDeliveryData.success) {
        freeDeliveryInfo = freeDeliveryData.data;
      }
    } else {
      console.error('[HOME PAGE] Free delivery info API error:', freeDeliveryResponse.status);
    }

    return {
      recommendations: homeData.recommendations || [],
      monthOffers: homeData.monthOffers || [],
      topProducts: homeData.topProducts || [],
      store: homeData.store || null,
      freeDeliveryInfo
    };

  } catch (error) {
    console.error('[HOME PAGE] Failed to fetch home data:', error);
    // Return empty data on error instead of failing
    return {
      recommendations: [],
      monthOffers: [],
      topProducts: [],
      store: null,
      freeDeliveryInfo: defaultFreeDeliveryInfo
    };
  }
};
