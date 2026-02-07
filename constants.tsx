
import { Order, OrderStatus, StaffUser } from './types';

export const INITIAL_ORDERS: Order[] = [
  {
    id: '1',
    orderNumber: 'PJ-001',
    customerName: 'Ayo Balogun',
    type: 'Dine-in',
    status: OrderStatus.PREPARING,
    createdAt: Date.now() - 15 * 60000,
    tableNumber: '4',
    items: [
      { id: 'i1', name: 'Party Jollof Rice', quantity: 2, category: 'Main', notes: 'Extra spicy', estimatedPrepTime: 12 },
      { id: 'i2', name: 'Fried Plantain (Dodo)', quantity: 1, category: 'Side', estimatedPrepTime: 5 },
      { id: 'i3', name: 'Zobo Drink', quantity: 2, category: 'Drink', estimatedPrepTime: 2 }
    ]
  },
  {
    id: '2',
    orderNumber: 'PJ-002',
    customerName: 'Chidi E.',
    type: 'Delivery',
    status: OrderStatus.NEW,
    createdAt: Date.now() - 5 * 60000,
    items: [
      { id: 'i4', name: 'Egusi Soup with Pounded Yam', quantity: 1, category: 'Main', estimatedPrepTime: 18 },
      { id: 'i5', name: 'Suya Platter', quantity: 1, category: 'Main', notes: 'Well done', estimatedPrepTime: 15 }
    ]
  },
  {
    id: '3',
    orderNumber: 'PJ-003',
    customerName: 'Tunde W.',
    type: 'Takeout',
    status: OrderStatus.NEW,
    createdAt: Date.now() - 2 * 60000,
    items: [
      { id: 'i6', name: 'Moin Moin', quantity: 3, category: 'Side', estimatedPrepTime: 8 },
      { id: 'i7', name: 'Beef Jollof Bowl', quantity: 2, category: 'Main', estimatedPrepTime: 10 }
    ]
  }
];

export const ICONS = {
  Clock: () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  User: () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
  Sparkles: () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-7.714 2.143L11 21l-2.286-6.857L1 12l7.714-2.143L11 3z" />
    </svg>
  )
};

export const SHIFT_HOURS = {
  start: 8, // 8:00 AM
  end: 22   // 10:00 PM
};

export const STAFF_USERS: StaffUser[] = [
  // Front Desk
  { id: 'u1', name: 'Enock', role: 'FRONT_DESK', pin: '1001' },
  { id: 'u2', name: 'David', role: 'FRONT_DESK', pin: '1002' },
  { id: 'u3', name: 'Judith', role: 'FRONT_DESK', pin: '1003' },
  { id: 'u4', name: 'Yvonne', role: 'FRONT_DESK', pin: '1004' },
  // Chefs
  { id: 'u5', name: 'Paul', role: 'CHEF', pin: '2001' },
  { id: 'u6', name: 'Ken M', role: 'CHEF', pin: '2002' },
  { id: 'u7', name: 'Ken N', role: 'CHEF', pin: '2003' },
  // Packers
  { id: 'u8', name: 'Samuel', role: 'PACKER', pin: '3001' },
  { id: 'u9', name: 'Nicholus', role: 'PACKER', pin: '3002' },
  { id: 'u10', name: 'Benard', role: 'PACKER', pin: '3003' },
  // Admin
  { id: 'u11', name: 'Manager Kemi', role: 'ADMIN', pin: '9001' }
];
