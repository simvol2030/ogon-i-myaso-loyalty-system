export interface User {
  name: string;
  cardNumber: string;
  balance: number;
  totalPurchases: number;
  totalSaved: number;
}

export interface Product {
  id: number;
  name: string;
  price: number;
  oldPrice?: number;
  image: string;
  category: string;
}

export interface Store {
  id: number;
  name: string;
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
  icon: string;
  iconColor: string;
  deadline: string;
  deadlineClass: string;
  details: string;
  conditions: string[];
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
  description: string;
  price: number;
  image: string;
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
