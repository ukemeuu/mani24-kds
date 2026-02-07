
export enum OrderStatus {
  NEW = 'NEW',
  PREPARING = 'PREPARING',
  READY = 'READY',
  DSTACHED = 'DISPATCHED',
  SERVED = 'SERVED',
  DISPATCHED = 'DISPATCHED',
  PACKING = 'PACKING'
}

export type StationType = 'FRONT_DESK' | 'CHEF' | 'PACKER';
export type UserRole = StationType | 'ADMIN';

export interface StaffUser {
  id: string;
  name: string;
  role: UserRole;
  pin: string;
  avatar?: string;
}

export interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  notes?: string;
  category: 'Main' | 'Side' | 'Drink' | 'Dessert';
  estimatedPrepTime?: number; // in minutes
}

export interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  type: 'Dine-in' | 'Takeout' | 'Delivery';
  items: OrderItem[];
  status: OrderStatus;
  createdAt: number;
  dispatchedAt?: number; // timestamp when status became DISPATCHED
  prepStartedAt?: number;
  tableNumber?: string;
  metadata?: any;
  groundingSources?: { title: string; uri: string }[];
}

export interface ChefInsight {
  title: string;
  advice: string;
  urgency: 'low' | 'medium' | 'high';
}
