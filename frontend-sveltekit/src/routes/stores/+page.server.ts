import { readFileSync } from 'fs';
import { join } from 'path';
import type { PageServerLoad } from './$types';

/**
 * Data loader for Stores page
 *
 * MIGRATION NOTES:
 * When switching to database:
 * 1. Replace readFileSync with database query
 * 2. Can add filtering by: city, distance, features, open/closed status
 * 3. Add geolocation queries for "near me" functionality
 *
 * Example with Prisma:
 * const stores = await prisma.store.findMany({
 *   where: { is_active: true },
 *   orderBy: { name: 'asc' }
 * });
 *
 * Database schema suggestion:
 * Table: stores
 * Columns:
 *   - id: INT PRIMARY KEY AUTO_INCREMENT
 *   - name: VARCHAR(255) NOT NULL
 *   - address: TEXT NOT NULL
 *   - status: VARCHAR(100)
 *   - distance: VARCHAR(50)
 *   - icon_color: VARCHAR(50)
 *   - phone: VARCHAR(20)
 *   - hours: VARCHAR(255)
 *   - features: JSON (array of strings)
 *   - latitude: DECIMAL(10, 8)
 *   - longitude: DECIMAL(11, 8)
 *   - is_closed: BOOLEAN DEFAULT FALSE
 *   - created_at: TIMESTAMP DEFAULT CURRENT_TIMESTAMP
 *   - updated_at: TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
 *
 * Index suggestions:
 *   - INDEX idx_location (latitude, longitude) for geospatial queries
 *   - INDEX idx_active (is_closed) for filtering
 */
export const load: PageServerLoad = () => {
  const storesPath = join(process.cwd(), 'src/lib/data/loyalty/stores.json');
  const stores = JSON.parse(readFileSync(storesPath, 'utf-8'));

  return {
    stores
  };
};
