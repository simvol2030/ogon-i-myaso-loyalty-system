import { readFileSync } from 'fs';
import { join } from 'path';
import type { PageServerLoad } from './$types';

/**
 * Data loader for Products page
 *
 * MIGRATION NOTES:
 * When switching to database:
 * 1. Replace readFileSync with database query
 * 2. Add pagination (limit/offset or cursor-based)
 * 3. Add filtering by: category, price range, in stock
 * 4. Add sorting options: price, name, popularity
 *
 * Example with Prisma:
 * const products = await prisma.product.findMany({
 *   where: { is_active: true },
 *   orderBy: { popularity: 'desc' },
 *   take: 20
 * });
 *
 * Database schema suggestion:
 * Table: products
 * Columns:
 *   - id: INT PRIMARY KEY AUTO_INCREMENT
 *   - name: VARCHAR(255) NOT NULL
 *   - price: DECIMAL(10, 2) NOT NULL
 *   - old_price: DECIMAL(10, 2)
 *   - image: VARCHAR(500)
 *   - category: VARCHAR(100)
 *   - description: TEXT
 *   - stock_quantity: INT DEFAULT 0
 *   - is_active: BOOLEAN DEFAULT TRUE
 *   - popularity_score: INT DEFAULT 0
 *   - created_at: TIMESTAMP DEFAULT CURRENT_TIMESTAMP
 *   - updated_at: TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
 *
 * Related tables:
 *   - categories (id, name, slug, parent_id)
 *   - product_images (id, product_id, url, order)
 *
 * Index suggestions:
 *   - INDEX idx_category (category)
 *   - INDEX idx_price (price)
 *   - INDEX idx_active (is_active)
 *   - INDEX idx_popularity (popularity_score)
 */
export const load: PageServerLoad = () => {
  const productsPath = join(process.cwd(), 'src/lib/data/loyalty/products.json');
  const products = JSON.parse(readFileSync(productsPath, 'utf-8'));

  return {
    products
  };
};
