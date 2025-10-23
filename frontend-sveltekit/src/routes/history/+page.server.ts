import { readFileSync } from 'fs';
import { join } from 'path';
import type { PageServerLoad } from './$types';

/**
 * Data loader for Transaction History page
 *
 * MIGRATION NOTES:
 * When switching to database:
 * 1. Replace readFileSync with database query
 * 2. Add user authentication and filter by user_id
 * 3. Add pagination (important for large transaction history)
 * 4. Add filtering by: date range, transaction type, store
 * 5. Calculate real-time balance from transactions
 *
 * Example with Prisma:
 * const history = await prisma.transaction.findMany({
 *   where: { user_id: userId },
 *   include: { store: true },
 *   orderBy: { created_at: 'desc' },
 *   take: 50
 * });
 *
 * Database schema suggestion:
 * Table: transactions
 * Columns:
 *   - id: INT PRIMARY KEY AUTO_INCREMENT
 *   - user_id: INT NOT NULL (FK to users.id)
 *   - store_id: INT (FK to stores.id, nullable)
 *   - title: VARCHAR(255) NOT NULL
 *   - amount: DECIMAL(10, 2) NOT NULL (positive for earn, negative for spend)
 *   - type: ENUM('earn', 'spend') NOT NULL
 *   - spent_money: DECIMAL(10, 2) (actual money spent, if applicable)
 *   - description: TEXT
 *   - created_at: TIMESTAMP DEFAULT CURRENT_TIMESTAMP
 *
 * Related tables:
 *   - users (id, name, email, card_number, current_balance)
 *   - stores (id, name, address)
 *
 * Index suggestions:
 *   - INDEX idx_user_date (user_id, created_at DESC)
 *   - INDEX idx_type (type)
 *   - INDEX idx_store (store_id)
 *
 * Business logic:
 *   - On INSERT transaction: UPDATE users SET current_balance = current_balance + NEW.amount WHERE id = NEW.user_id
 *   - Consider using database triggers or application-level transaction management
 */
export const load: PageServerLoad = () => {
  const historyPath = join(process.cwd(), 'src/lib/data/loyalty/history.json');
  const history = JSON.parse(readFileSync(historyPath, 'utf-8'));

  return {
    history
  };
};
