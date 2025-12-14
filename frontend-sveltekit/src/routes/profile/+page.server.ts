import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db/client';
import { loyaltySettings } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Склонение слова "балл" в зависимости от числа
 * @param count - количество
 * @returns правильная форма слова (балл/балла/баллов)
 */
function declinePoints(count: number): string {
  const lastDigit = count % 10;
  const lastTwoDigits = count % 100;

  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
    return 'Баллов';
  }

  if (lastDigit === 1) {
    return 'Балл';
  }

  if (lastDigit >= 2 && lastDigit <= 4) {
    return 'Балла';
  }

  return 'Баллов';
}

export const load: PageServerLoad = async () => {
  // Fetch loyalty settings from DB
  const [settings] = await db.select().from(loyaltySettings).where(eq(loyaltySettings.id, 1)).limit(1);

  // Extract values with defaults
  const earningPercent = settings?.earning_percent ?? 4;
  const maxDiscountPercent = settings?.max_discount_percent ?? 20;
  const expiryDays = settings?.expiry_days ?? 45;
  const minRedemption = settings?.min_redemption_amount ?? 1;
  const pointsName = settings?.points_name?.trim() || 'Мурзи-коины'; // Use || to catch empty strings

  // Profile menu items (static config)
  // H-004 FIX: Removed "pets" item - not implemented in MVP
  const profileMenu = [
    {
      id: 'birthday',
      icon: '🎂',
      iconColor: 'pink',
      title: 'День рождения',
      description: 'Укажите дату для получения бонуса',
      action: 'openBirthdayModal'
    },
    {
      id: 'orders',
      icon: '📦',
      iconColor: 'orange',
      title: 'Мои заказы',
      description: 'История заказов магазина',
      action: 'link',
      href: '/my-orders'
    },
    {
      id: 'notifications',
      icon: '🔔',
      iconColor: 'blue',
      title: 'Настройки уведомлений',
      description: 'Управление push-уведомлениями',
      action: 'openNotificationsModal'
    },
    {
      id: 'payment',
      icon: '💳',
      iconColor: 'green',
      title: 'Способы оплаты',
      description: 'Привязанные карты и счета',
      action: 'openPaymentModal'
    },
    {
      id: 'referral',
      icon: '🎁',
      iconColor: 'purple',
      title: 'Пригласить друзей',
      description: 'Получите бонусы за приглашение',
      action: null
    },
    {
      id: 'support',
      icon: '💬',
      iconColor: 'pink',
      title: 'Поддержка',
      description: 'Свяжитесь с нами',
      action: 'alert'
    }
  ];

  // Loyalty rules (DYNAMIC from DB)
  const loyaltyRulesDetailed = {
    title: 'Правила программы лояльности',
    icon: '🎁',
    rules: [
      {
        id: 'earning',
        emoji: '💰',
        title: 'Начисление бонусов',
        description: `Получайте <strong>${earningPercent}% от суммы покупки</strong> в виде Баллов за каждую покупку`,
        example: (() => {
          const points = Math.round(1000 * earningPercent / 100);
          return `Пример: покупка на 1000₽ = ${points} ${declinePoints(points)}`;
        })()
      },
      {
        id: 'payment',
        emoji: '🎯',
        title: 'Оплата бонусами',
        description: `Оплачивайте до <strong>${maxDiscountPercent}% от суммы чека</strong> накопленными Баллами`,
        example: (() => {
          const points = Math.round(500 * maxDiscountPercent / 100);
          return `Чек на 500₽ → можно списать до ${points} ${declinePoints(points)}`;
        })()
      },
      {
        id: 'expiry',
        emoji: '⏱️',
        title: 'Срок действия',
        description: `Баллы действуют <strong>${expiryDays} дней</strong> с момента последней активности`,
        example: 'Совершайте покупки регулярно, чтобы Баллы не сгорели!'
      },
      {
        id: 'conditions',
        emoji: '⚠️',
        title: 'Важные условия',
        description: '',
        list: [
          `Минимальная сумма для списания: <strong>${minRedemption} ${declinePoints(minRedemption)}</strong>`,
          'Бонусы не начисляются на <strong>акционные товары</strong>',
          'Начисление только при <strong>полной оплате деньгами</strong>',
          'Бонусы нельзя передать другому лицу'
        ]
      }
    ],
    footer: `✨ Копите Баллы и экономьте на покупках`
  };

  return {
    profileMenu,
    loyaltyRulesDetailed
  };
};
