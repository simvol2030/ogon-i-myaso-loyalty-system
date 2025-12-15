export interface User {
  name: string;
  cardNumber: string;
  balance: number;
  totalPurchases: number;
  totalSaved: number;
}

export interface ProductVariation {
  id: number;
  name: string;
  price: number;
  oldPrice?: number;
  sku?: string;
  isDefault: boolean;
  isActive: boolean;
}

export interface Product {
  id: number;
  name: string;
  description?: string | null;
  price: number;
  oldPrice?: number;
  quantityInfo?: string | null;
  image: string;
  category: string;
  variationAttribute?: string | null;
  variations?: ProductVariation[];
}

export interface Store {
  id: number;
  name: string;
  city: string | null; // Sprint 4 Task 1.4: City name
  address: string;
  iconColor: string;
  phone: string;
  hours: string;
  features: string[];
  coords: { lat: number; lng: number };
  closed?: boolean;
}

export interface Offer {
  id: number;
  title: string;
  description: string;
  image: string | null; // Sprint 2: URL to banner image
  deadline: string;
  isActive?: boolean;
  showOnHome?: boolean;
}

export interface Transaction {
  id: string | number; // Allow both string (for examples) and number (from database)
  title: string;
  amount: number;
  date: string;
  type: 'earn' | 'spend';
  spent: string;
  storeName?: string;
}

export interface Recommendation {
  id: number;
  name: string;
  description: string | null; // Sprint 3: Can be null for old data
  image: string;
  // CRITICAL FIX #2 (Sprint 3): price removed - recommendations display WITHOUT price
}

// ============================================
// 1C Integration Types
// ============================================

export interface OneCTransaction {
  Ref_Key: string; // 1C GUID
  Amount: number; // Purchase amount in rubles
  StoreId: number; // Store identifier
  Status: 'Active' | 'Completed' | 'Cancelled';
  CreatedAt: string; // ISO 8601 timestamp
}

export interface OneCConfig {
  baseUrl: string;
  username: string;
  password: string;
  timeout: number;
}

export interface TransactionFetchState {
  loading: boolean;
  amount: number | null;
  error: string | null;
  lastFetchedAt: Date | null;
}

export interface Customer {
  id: number;
  name: string;
  cardNumber: string;
  balance: number;
  qrCode: string;
}
