import { readFileSync } from 'fs';
import { join } from 'path';
import type { PageServerLoad } from './$types';

/**
 * Data loader for Offers page
 *
 * MIGRATION NOTES:
 * When switching to database:
 * 1. Replace readFileSync with database query
 * 2. Use ORM/Query builder (e.g., Prisma, Drizzle, Kysely)
 * 3. Keep the same return structure
 *
 * Example with Prisma:
 * const offers = await prisma.offer.findMany({
 *   orderBy: { createdAt: 'desc' }
 * });
 *
 * Database schema suggestion:
 * Table: offers
 * Columns:
 *   - id: INT PRIMARY KEY AUTO_INCREMENT
 *   - title: VARCHAR(255) NOT NULL
 *   - description: TEXT
 *   - icon: VARCHAR(10)
 *   - icon_color: VARCHAR(50)
 *   - deadline: VARCHAR(100)
 *   - deadline_class: VARCHAR(50)
 *   - details: TEXT
 *   - conditions: JSON (array of strings)
 *   - created_at: TIMESTAMP DEFAULT CURRENT_TIMESTAMP
 *   - updated_at: TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
 *   - is_active: BOOLEAN DEFAULT TRUE
 */
export const load: PageServerLoad = () => {
  const offersPath = join(process.cwd(), 'src/lib/data/loyalty/offers.json');
  const offers = JSON.parse(readFileSync(offersPath, 'utf-8'));

  return {
    offers
  };
};
