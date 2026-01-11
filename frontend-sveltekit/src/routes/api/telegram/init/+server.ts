import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db/client';
import { loyaltyUsers, loyaltySettings } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { createWelcomeBonus } from '$lib/server/transactions/createWelcomeBonus';
import { generateUniqueCardNumber } from '$lib/server/utils/cardNumber';

/**
 * API Endpoint: POST /api/telegram/init
 *
 * DATABASE VERSION:
 * Initializes Telegram user on first app launch:
 * 1. Checks if user exists in loyalty_users table
 * 2. If new user: awards welcome bonus (from loyalty_settings)
 * 3. Tracks which store user registered from (CRITICAL for analytics)
 * 4. Creates transaction record for welcome bonus
 * 5. Triggers welcome message via /api/telegram/welcome
 */

interface TelegramUserData {
  telegram_user_id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  chat_id: number;
  store_id?: number;
}

export const POST: RequestHandler = async ({ request, fetch, cookies }) => {
  console.log('[API /telegram/init] 📥 ============ REQUEST START ============');
  console.log('[API /telegram/init] 📥 Timestamp:', new Date().toISOString());

  try {
    console.log('[API /telegram/init] 📋 Parsing request body...');
    const userData: TelegramUserData = await request.json();
    console.log('[API /telegram/init] ✅ Body parsed successfully');
    console.log('[API /telegram/init] 📦 Received userData:', JSON.stringify({
      telegram_user_id: userData.telegram_user_id,
      first_name: userData.first_name,
      last_name: userData.last_name,
      username: userData.username,
      chat_id: userData.chat_id,
      store_id: userData.store_id
    }, null, 2));

    // Validate required fields
    if (!userData.telegram_user_id || !userData.first_name || !userData.chat_id) {
      console.error('[API /telegram/init] ❌ VALIDATION FAILED:', {
        has_telegram_user_id: !!userData.telegram_user_id,
        has_first_name: !!userData.first_name,
        has_chat_id: !!userData.chat_id
      });
      return json(
        {
          success: false,
          message: 'Missing required fields: telegram_user_id, first_name, chat_id'
        },
        { status: 400 }
      );
    }

    // Fetch loyalty settings
    const [settings] = await db.select().from(loyaltySettings).where(eq(loyaltySettings.id, 1)).limit(1);

    // Validate and sanitize settings
    let welcomeBonus = settings?.welcome_bonus ?? 500.0;
    if (!Number.isFinite(welcomeBonus) || welcomeBonus < 0) {
      console.error('[API /telegram/init] ⚠️ Invalid welcome_bonus in settings:', welcomeBonus, '- using default 500.0');
      welcomeBonus = 500.0;
    }

    const pointsName = (settings?.points_name?.trim() || 'Murzikoyns');
    console.log('[API /telegram/init] 📋 Settings loaded:', { welcomeBonus, pointsName });

    // Check if user already exists in database
    const existingUser = await db
      .select()
      .from(loyaltyUsers)
      .where(eq(loyaltyUsers.telegram_user_id, userData.telegram_user_id))
      .get();

    if (existingUser) {
      // Check if user hasn't claimed welcome bonus yet (legacy users or incomplete signup)
      if (!existingUser.first_login_bonus_claimed) {
        console.log(`[API] 🎯 LEGACY USER DETECTED! Awarding ${welcomeBonus} ${pointsName}:`, existingUser.telegram_user_id);

        // TASK-002 FIX: Use atomic transaction helper (SYNC - no await for better-sqlite3)
        const bonusResult = createWelcomeBonus(
          existingUser.id,
          welcomeBonus,
          existingUser.store_id,
          pointsName
        );

        console.log('[API] ✅ Welcome bonus awarded atomically:', existingUser.current_balance, '→', bonusResult.newBalance);

        // AUDIT FIX: Bonus claim flag now set inside atomic transaction (no separate UPDATE needed)

        // 🔴 FIX: УДАЛЕНО дублирующееся приветствие
        // Приветствие отправляется только через bot /start
        console.log('[API] ℹ️ Welcome message will be sent via Telegram Bot /start command');

        // FIX #3: Set cookie on server (prevents race condition)
        cookies.set('telegram_user_id', existingUser.telegram_user_id.toString(), {
          path: '/',
          maxAge: 60 * 60 * 24 * 30, // 30 days
          sameSite: 'strict',
          httpOnly: false // Needed for client-side access
        });
        console.log('[API] 🍪 Cookie set: telegram_user_id=', existingUser.telegram_user_id);

        return json({
          success: true,
          isNewUser: true, // Treat as new user (first bonus)
          user: {
            telegram_user_id: existingUser.telegram_user_id,
            first_name: existingUser.first_name,
            last_name: existingUser.last_name,
            username: existingUser.username,
            current_balance: bonusResult.newBalance, // TASK-002 FIX: Use atomic result
            store_id: existingUser.store_id,
            first_login_bonus_claimed: true // AUDIT FIX: Now set atomically in transaction
          },
          message: 'Welcome bonus awarded!'
        });
      }

      // Existing user with bonus already claimed - just update activity
      await db
        .update(loyaltyUsers)
        .set({ last_activity: new Date().toISOString() })
        .where(eq(loyaltyUsers.telegram_user_id, userData.telegram_user_id))
        .run();

      // FIX #3: Set cookie for existing user too
      cookies.set('telegram_user_id', existingUser.telegram_user_id.toString(), {
        path: '/',
        maxAge: 60 * 60 * 24 * 30,
        sameSite: 'strict',
        httpOnly: false
      });

      return json({
        success: true,
        isNewUser: false,
        user: {
          telegram_user_id: existingUser.telegram_user_id,
          first_name: existingUser.first_name,
          last_name: existingUser.last_name,
          username: existingUser.username,
          current_balance: existingUser.current_balance,
          store_id: existingUser.store_id,
          first_login_bonus_claimed: existingUser.first_login_bonus_claimed
        },
        message: 'Welcome back!'
      });
    } else {
      // New user - award welcome bonus dynamically
      console.log(`[API] 🆕 NEW USER DETECTED! Creating account for: ${userData.telegram_user_id}`);

      // Generate unique 6-digit card number (try preferred, fallback to random if collision)
      const cardNumber = await generateUniqueCardNumber(userData.telegram_user_id);
      console.log('[API] 📝 Generated card number:', cardNumber);

      const newUser = await db
        .insert(loyaltyUsers)
        .values({
          telegram_user_id: userData.telegram_user_id,
          card_number: cardNumber, // ✅ Сохраняем номер карты
          first_name: userData.first_name,
          last_name: userData.last_name,
          username: userData.username,
          language_code: userData.language_code || 'ru',
          current_balance: 0, // TASK-002 FIX: Start with 0, add bonus atomically
          store_id: userData.store_id,
          first_login_bonus_claimed: false, // AUDIT FIX (Cycle 2): Must be false so bonus can be awarded
          chat_id: userData.chat_id
        })
        .returning()
        .get();

      console.log('[API] ✅ New user created, card:', cardNumber);

      // TASK-002 FIX: Award welcome bonus with atomic transaction (SYNC - no await for better-sqlite3)
      const bonusResult = createWelcomeBonus(
        newUser.id,
        welcomeBonus,
        userData.store_id,
        pointsName
      );

      console.log(`[API] 📝 Welcome bonus awarded atomically: 0 → ${bonusResult.newBalance} ${pointsName}`);

      // 🔴 FIX: УДАЛЕНО дублирующееся приветствие
      // Приветствие отправляется только через bot /start
      console.log('[API] ℹ️ Welcome message will be sent via Telegram Bot /start command');

      // FIX #3: Set cookie for new user
      cookies.set('telegram_user_id', newUser.telegram_user_id.toString(), {
        path: '/',
        maxAge: 60 * 60 * 24 * 30,
        sameSite: 'strict',
        httpOnly: false
      });
      console.log('[API] 🍪 Cookie set for new user:', newUser.telegram_user_id);

      console.log('[API /telegram/init] ✅ ============ SUCCESS (NEW USER) ============');
      console.log('[API /telegram/init] ✅ Returning user data with balance:', bonusResult.newBalance);

      return json({
        success: true,
        isNewUser: true,
        user: {
          telegram_user_id: newUser.telegram_user_id,
          first_name: newUser.first_name,
          last_name: newUser.last_name,
          username: newUser.username,
          current_balance: bonusResult.newBalance, // TASK-002 FIX: Use atomic result
          store_id: newUser.store_id,
          first_login_bonus_claimed: newUser.first_login_bonus_claimed
        },
        message: `Welcome! ${welcomeBonus} ${pointsName} awarded`
      });
    }
  } catch (error) {
    console.error('[API /telegram/init] ❌ ============ ERROR CAUGHT ============');
    console.error('[API /telegram/init] ❌ Error type:', error instanceof Error ? error.constructor.name : typeof error);
    console.error('[API /telegram/init] ❌ Error message:', error instanceof Error ? error.message : String(error));
    console.error('[API /telegram/init] ❌ Error stack:', error instanceof Error ? error.stack : 'No stack');
    console.error('[API /telegram/init] ❌ Full error object:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    return json(
      {
        success: false,
        message: 'Internal server error'
      },
      { status: 500 }
    );
  }
};
