
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Order, OrderStatus, ChefInsight, StationType, OrderItem, UserRole, StaffUser } from './types';
import { INITIAL_ORDERS, ICONS, SHIFT_HOURS, STAFF_USERS } from './constants';
import OrderCard from './components/OrderCard';
import ChefInsightsPanel from './components/ChefInsightsPanel';
import DailyReportModal from './components/DailyReportModal';
import { getChefInsights, generateSimulatedOrder } from './services/geminiService';

declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
  interface Window {
    aistudio?: AIStudio;
  }
}


type SortDirection = 'asc' | 'desc';

import { supabase } from './supabaseClient';

const KDS_SYNC_CHANNEL = new BroadcastChannel('pj_kds_sync'); // Keep for local fallback or remove if fully replacing

const App: React.FC = () => {
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [orders, setOrders] = useState<Order[]>([]); // Initialize empty, fetch from DB
  const [activeStation, setActiveStation] = useState<StationType>('FRONT_DESK');
  const [activeTab, setActiveTab] = useState<OrderStatus | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [isMuted, setIsMuted] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const [showReport, setShowReport] = useState(false);

  const [insights, setInsights] = useState<ChefInsight[]>([]);
  const [sources, setSources] = useState<any[]>([]);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [simulationLoading, setSimulationLoading] = useState(false);

  const [currentTime, setCurrentTime] = useState(new Date());

  // Auth State
  // Auth State
  // Auth State
  const [selectedAuthRole, setSelectedAuthRole] = useState<UserRole | null>(null);
  const [currentUser, setCurrentUser] = useState<StaffUser | null>(null);
  const [authPin, setAuthPin] = useState('');
  const [authError, setAuthError] = useState('');

  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const [quotaError, setQuotaError] = useState<string | null>(null);

  const soundUpdate = useRef(new Audio('https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3'));
  const soundReady = useRef(new Audio('https://assets.mixkit.co/active_storage/sfx/951/951-preview.mp3'));
  const soundNewOrder = useRef(new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'));

  useEffect(() => {
    if (!supabase) return;

    // Fetch Initial Orders
    const fetchOrders = async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*, items:order_items(*)')
        .order('created_at', { ascending: true });

      if (data) {
        // Map DB structure to App structure if needed, or ensure they match
        // Our SQL schema matches Order type mostly, but we need to ensure 'items' key logic
        const formattedOrders: Order[] = data.map(o => ({
          id: o.id,
          orderNumber: o.order_number,
          customerName: o.customer_name,
          type: o.type as any,
          status: o.status as any,
          createdAt: o.created_at,
          dispatchedAt: o.dispatched_at,
          items: o.items.map((i: any) => ({
            id: i.id,
            name: i.name,
            quantity: i.quantity,
            category: i.category,
            estimatedPrepTime: i.estimated_prep_time
          })) || []
        }));
        setOrders(formattedOrders);
      }
    };

    fetchOrders();

    // Realtime Subscription
    const channel = supabase
      .channel('kds_orders')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        (payload) => {
          fetchOrders();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'order_items' },
        (payload) => {
          fetchOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const broadcast = (type: string, payload: any) => {
    KDS_SYNC_CHANNEL.postMessage({ type, payload });
  };

  useEffect(() => {
    const checkKey = async () => {
      // Check for environment variable first (local dev)
      if (process.env.API_KEY) {
        setHasApiKey(true);
        return;
      }

      const selected = await window.aistudio?.hasSelectedApiKey();
      setHasApiKey(!!selected);
    };
    checkKey();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const refreshInsights = useCallback(async () => {
    if (activeStation !== 'CHEF' || !hasApiKey) return;

    setInsightsLoading(true);
    setQuotaError(null);
    try {
      const activeOrders = orders.filter(o => o.status !== OrderStatus.DISPATCHED);
      const { insights, sources } = await getChefInsights(activeOrders);
      setInsights(insights);
      setSources(sources);
    } catch (err: any) {
      if (err.message?.includes('429')) setQuotaError('AI Rate limit reached. Please try again in a minute.');
      else setQuotaError('Failed to fetch chef insights.');
    } finally {
      setInsightsLoading(false);
    }
  }, [activeStation, orders.length, hasApiKey]);

  useEffect(() => {
    refreshInsights();
  }, [refreshInsights]);

  const playSound = (audioRef: React.RefObject<HTMLAudioElement>) => {
    if (!isMuted && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => { });
    }
  };

  const handleStatusChange = async (orderId: string, newStatus: OrderStatus) => {
    // Optimistic Update
    const updated = orders.map(order => {
      if (order.id === orderId) {
        return {
          ...order,
          status: newStatus,
          dispatchedAt: newStatus === OrderStatus.DISPATCHED ? Date.now() : order.dispatchedAt
        };
      }
      return order;
    });
    setOrders(updated);

    // Supabase Update
    if (supabase) {
      const updates: any = { status: newStatus };
      if (newStatus === OrderStatus.DISPATCHED) updates.dispatched_at = Date.now();

      await supabase.from('orders').update(updates).eq('id', orderId);
    }

    if (newStatus === OrderStatus.READY) playSound(soundReady);
    else if (newStatus === OrderStatus.NEW) playSound(soundNewOrder);
    else playSound(soundUpdate);
  };

  const handleMarkAllPreparingReady = async () => {
    // Optimistic Update
    const updated = orders.map(order =>
      order.status === OrderStatus.PREPARING ? { ...order, status: OrderStatus.READY } : order
    );
    setOrders(updated);

    // Supabase Bulk Update
    if (supabase) {
      await supabase
        .from('orders')
        .update({ status: 'READY' })
        .eq('status', 'PREPARING');
    }

    playSound(soundReady);
    setShowBulkConfirm(false);
  };

  const handleUpdateOrder = async (updatedOrder: Order) => {
    // Optimistic Update
    const updated = orders.map(order => order.id === updatedOrder.id ? updatedOrder : order);
    setOrders(updated);

    // Supabase Update (Assuming only status or minimal fields change here, but full object passed)
    // For now, just update status if that's what changed, or log error if complex update needed
    // In KDS context, usually status is main change. 
    if (supabase) {
      await supabase
        .from('orders')
        .update({ status: updatedOrder.status })
        .eq('id', updatedOrder.id);
    }

    playSound(soundUpdate);
  };

  const handleDeleteItem = async (orderId: string, itemId: string) => {
    // Supabase Delete Item
    if (supabase) {
      await supabase
        .from('order_items')
        .delete()
        .eq('id', itemId);

      // Realtime subscription will trigger refetch and update UI
    }
  };

  const handleSimulateOrder = async () => {
    setSimulationLoading(true);
    try {
      const newOrderInfo = await generateSimulatedOrder();

      if (supabase) {
        // precise timestamp for order
        const createdAt = Date.now();

        // 1. Insert Order
        const { data: orderData, error: orderError } = await supabase
          .from('orders')
          .insert({
            order_number: newOrderInfo.orderNumber,
            customer_name: newOrderInfo.customerName,
            type: newOrderInfo.type,
            status: 'NEW',
            created_at: createdAt,
            metadata: {}
          })
          .select()
          .single();

        if (orderError || !orderData) throw orderError || new Error('Failed to create order');

        // 2. Insert Items with foreign key
        const itemsToInsert = newOrderInfo.items.map(item => ({
          order_id: orderData.id,
          name: item.name,
          quantity: item.quantity,
          category: item.category,
          estimated_prep_time: item.estimatedPrepTime
        }));

        const { error: itemsError } = await supabase
          .from('order_items')
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;
      }

      playSound(soundNewOrder);
    } catch (err: any) {
      console.error(err);
    } finally {
      setSimulationLoading(false);
    }
  };

  const handleExportCSV = () => {
    const doneOrders = orders.filter(o => o.status === OrderStatus.DISPATCHED);
    if (doneOrders.length === 0) return;

    const headers = ['Order Number', 'Customer Name', 'Type', 'Date', 'Total Items', 'Items Detail'];
    const rows = doneOrders.map(o => {
      const date = new Date(o.createdAt).toLocaleString();
      const totalItems = o.items.reduce((sum, item) => sum + item.quantity, 0);
      const itemsDetail = o.items.map(item => `${item.quantity}x ${item.name}`).join('; ');
      return [
        o.orderNumber,
        o.customerName,
        o.type,
        `"${date}"`,
        totalItems,
        `"${itemsDetail}"`
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `pot_of_jollof_history_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  /* const handleRoleSelection = (role: UserRole) => {
    setUserRole(role);
    if (role !== 'ADMIN') {
      setActiveStation(role);
    } else {
      setActiveStation('FRONT_DESK');
    }
    setActiveTab('ALL');
  }; */

  const preparingOrdersCount = useMemo(() => {
    return orders.filter(o => o.status === OrderStatus.PREPARING).length;
  }, [orders]);

  const filteredAndSortedOrders = useMemo(() => {
    const filtered = orders.filter(o => {
      const matchesSearch = o.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.orderNumber.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      switch (activeStation) {
        case 'CHEF':
          return o.status === OrderStatus.NEW || o.status === OrderStatus.PREPARING;
        case 'PACKER':
          return o.status === OrderStatus.PACKING;
        case 'FRONT_DESK':
          if (activeTab === 'ALL') return o.status !== OrderStatus.DISPATCHED;
          return o.status === activeTab;
        default:
          return true;
      }
    });

    return [...filtered].sort((a, b) => {
      if (sortDirection === 'asc') {
        return a.createdAt - b.createdAt;
      } else {
        return b.createdAt - a.createdAt;
      }
    });
  }, [orders, activeStation, activeTab, searchQuery, sortDirection]);

  const stationInfo = useMemo(() => {
    switch (activeStation) {
      case 'CHEF':
        return { title: 'CHEF STATION', desc: 'Accept new orders and track preparation times.' };
      case 'PACKER':
        return { title: 'PACKER / QC', desc: 'Verify orders and push to ready for dispatch.' };
      case 'FRONT_DESK':
        return { title: 'FRONT DESK', desc: 'Punch in orders and manage final dispatch.' };
      default:
        return { title: 'KITCHEN SYSTEM', desc: 'Live order monitor.' };
    }
  }, [activeStation]);

  const availableStations = useMemo(() => {
    const allStations: StationType[] = ['FRONT_DESK', 'CHEF', 'PACKER'];
    if (userRole === 'ADMIN') return allStations;
    return allStations.filter(s => s === userRole);
  }, [userRole]);

  const SortToggle = () => (
    <button
      onClick={() => setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')}
      className="px-3 py-2 bg-zinc-800 text-zinc-400 border border-zinc-700 rounded-xl font-black text-[10px] hover:bg-zinc-700 transition-all flex items-center gap-2"
      title={`Sorting by creation time: ${sortDirection === 'asc' ? 'Oldest First' : 'Newest First'}`}
    >
      <svg className={`w-4 h-4 transition-transform duration-300 ${sortDirection === 'desc' ? 'rotate-180 text-brand-yellow' : 'text-brand-yellow'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
      </svg>
      <span className="hidden sm:inline uppercase">Sort: {sortDirection === 'asc' ? 'Oldest' : 'Newest'}</span>
    </button>
  );

  const HistoryLog = () => {
    return (
      <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6 flex flex-wrap gap-8 items-center justify-between">
          <div className="flex gap-8">
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Completed Today</span>
              <span className="text-3xl font-black text-brand-yellow">{filteredAndSortedOrders.length}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Filtered Result</span>
              <span className="text-3xl font-black text-white">{filteredAndSortedOrders.length} Orders</span>
            </div>
          </div>
          <button
            onClick={handleExportCSV}
            className="px-6 py-3 bg-brand-yellow text-black rounded-2xl font-black text-xs hover:scale-105 transition-all flex items-center gap-2 shadow-lg shadow-brand-yellow/10"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            EXPORT CSV LOG
          </button>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-black/50 text-zinc-500 text-[10px] font-black uppercase tracking-widest border-b border-zinc-800">
                  <th className="px-6 py-5">Order #</th>
                  <th className="px-6 py-5">Customer</th>
                  <th className="px-6 py-5">Type</th>
                  <th className="px-6 py-5">Total Items</th>
                  <th className="px-6 py-5">Turnaround</th>
                  <th className="px-6 py-5">Dispatched At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {filteredAndSortedOrders.map((order) => {
                  const turnaround = order.dispatchedAt ? Math.floor((order.dispatchedAt - order.createdAt) / 60000) : null;
                  return (
                    <tr key={order.id} className="hover:bg-brand-yellow/5 transition-colors group cursor-default">
                      <td className="px-6 py-5">
                        <span className="text-brand-yellow font-black text-lg">{order.orderNumber}</span>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex flex-col">
                          <span className="text-white font-bold">{order.customerName}</span>
                          <span className="text-[10px] text-zinc-500 italic truncate max-w-[200px]">
                            {order.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <span className="px-2 py-0.5 bg-black border border-zinc-800 rounded text-[9px] font-black text-zinc-400 uppercase">
                          {order.type}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <span className="text-zinc-300 font-bold">
                          {order.items.reduce((s, i) => s + i.quantity, 0)}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <span className={`font-mono font-bold ${turnaround && turnaround > 20 ? 'text-red-500' : 'text-green-500'}`}>
                          {turnaround}m
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <span className="text-zinc-500 font-medium text-xs">
                          {new Date(order.dispatchedAt || order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const OrderEntryModal = () => {
    const [name, setName] = useState('');
    const [type, setType] = useState<'Dine-in' | 'Takeout' | 'Delivery'>('Dine-in');

    const addQuickOrder = async () => {
      if (!name) return;

      if (supabase) {
        setSimulationLoading(true);
        const createdAt = Date.now();
        const { data: orderData, error } = await supabase.from('orders').insert({
          order_number: `PJ-${Math.floor(100 + Math.random() * 899)}`,
          customer_name: name,
          type: type,
          status: 'NEW',
          created_at: createdAt
        }).select().single();

        if (error) {
          console.error('Error creating order:', error);
          setSimulationLoading(false);
          return;
        }

        if (orderData) {
          const { error: itemsError } = await supabase.from('order_items').insert([
            { order_id: orderData.id, name: 'Party Jollof Rice', quantity: 1, category: 'Main', estimated_prep_time: 12 },
            { order_id: orderData.id, name: 'Fried Plantain (Dodo)', quantity: 1, category: 'Side', estimated_prep_time: 5 }
          ]);

          if (itemsError) console.error('Error creating items:', itemsError);
        }
        setSimulationLoading(false);
      }

      playSound(soundNewOrder);
      setShowOrderModal(false);
    };

    return (
      <div className="fixed inset-0 z-[120] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
        <div className="bg-zinc-900 border-2 border-brand-yellow rounded-3xl w-full max-w-lg p-8 shadow-2xl animate-in zoom-in duration-200">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-3xl font-black text-brand-yellow tracking-tighter">POS / PUNCH ORDER</h2>
            <button onClick={() => setShowOrderModal(false)} className="text-zinc-500 hover:text-white">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-zinc-500">Customer Name</label>
              <input autoFocus placeholder="Enter customer name..." value={name} onChange={e => setName(e.target.value)} className="w-full bg-black border border-zinc-800 p-4 rounded-2xl font-bold text-xl focus:outline-none focus:border-brand-yellow" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-zinc-500">Order Type</label>
              <div className="grid grid-cols-3 gap-2">
                {(['Dine-in', 'Takeout', 'Delivery'] as const).map(t => (
                  <button key={t} onClick={() => setType(t)} className={`py-4 rounded-2xl font-black text-xs transition-all ${type === t ? 'bg-brand-yellow text-black' : 'bg-zinc-800 text-zinc-500'}`}>{t.toUpperCase()}</button>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-8 flex gap-4">
            <button disabled={!name} onClick={addQuickOrder} className={`flex-grow py-5 bg-brand-yellow text-black font-black rounded-2xl text-xl shadow-lg shadow-brand-yellow/20 active:scale-95 transition-all ${!name ? 'opacity-50 cursor-not-allowed' : ''}`}>CREATE TICKET</button>
          </div>
        </div>
      </div>
    );
  };

  const BulkConfirmModal = () => (
    <div className="fixed inset-0 z-[150] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-zinc-900 border-2 border-red-500 rounded-3xl w-full max-w-md p-8 shadow-2xl animate-in zoom-in duration-200 text-center">
        <div className="bg-red-500/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
        </div>
        <h2 className="text-2xl font-black text-white mb-2 uppercase">Bulk Action</h2>
        <p className="text-zinc-400 font-medium mb-8">Are you sure you want to mark all <span className="text-brand-yellow font-black">{preparingOrdersCount}</span> preparing orders as <span className="text-green-500 font-black">READY</span>?</p>
        <div className="flex gap-4">
          <button onClick={() => setShowBulkConfirm(false)} className="flex-grow py-4 bg-zinc-800 text-zinc-400 font-black rounded-2xl uppercase text-xs">Cancel</button>
          <button onClick={handleMarkAllPreparingReady} className="flex-grow py-4 bg-green-600 text-white font-black rounded-2xl uppercase text-xs shadow-lg shadow-green-600/20">Yes, Mark All</button>
        </div>
      </div>
    </div>
  );

  const handlePinSubmit = () => {
    if (!selectedAuthRole) return;

    // Find User by Role and PIN
    const foundUser = STAFF_USERS.find(u => u.role === selectedAuthRole && u.pin === authPin);

    if (!foundUser) {
      setAuthError('Invalid PIN');
      setAuthPin('');
      return;
    }

    // Check Shift Hours (Skip for ADMIN)
    if (foundUser.role !== 'ADMIN') {
      const currentHour = new Date().getHours();
      if (currentHour < SHIFT_HOURS.start || currentHour >= SHIFT_HOURS.end) {
        setAuthError(`Shift hasn't started yet. (Hours: ${SHIFT_HOURS.start}:00 - ${SHIFT_HOURS.end}:00)`);
        setAuthPin('');
        return;
      }
    }

    // Success
    setUserRole(foundUser.role);
    setCurrentUser(foundUser);

    if (foundUser.role !== 'ADMIN') {
      setActiveStation(foundUser.role as StationType);
    } else {
      setActiveStation('FRONT_DESK');
    }
    setActiveTab('ALL');
    setSelectedAuthRole(null);
    setAuthPin('');
    setAuthError('');
  };

  const AuthModal = () => {
    if (!selectedAuthRole) return null;

    return (
      <div className="fixed inset-0 z-[400] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
        <div className="bg-zinc-900 border-2 border-brand-yellow rounded-3xl w-full max-w-sm p-8 shadow-2xl animate-in zoom-in duration-200">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-black text-white tracking-tighter uppercase">{selectedAuthRole.replace('_', ' ')} ACCESS</h2>
            <button onClick={() => { setSelectedAuthRole(null); setAuthPin(''); setAuthError(''); }} className="text-zinc-500 hover:text-white">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-black uppercase text-zinc-500 mb-2 block">Enter Staff PIN</label>
              <input
                autoFocus
                type="password"
                maxLength={4}
                value={authPin}
                onChange={e => { setAuthError(''); setAuthPin(e.target.value); }}
                onKeyDown={e => e.key === 'Enter' && handlePinSubmit()}
                className="w-full bg-black border border-zinc-700 p-4 rounded-2xl font-mono text-center text-4xl tracking-[0.5em] text-white focus:outline-none focus:border-brand-yellow transition-all"
                placeholder="••••"
              />
            </div>

            {authError && (
              <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-xl flex items-center gap-2">
                <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                <span className="text-red-500 text-xs font-bold">{authError}</span>
              </div>
            )}

            <button onClick={handlePinSubmit} className="w-full py-4 bg-brand-yellow text-black font-black rounded-2xl uppercase text-sm shadow-lg shadow-brand-yellow/20 hover:scale-[1.02] active:scale-95 transition-all">
              Verify Identity
            </button>

            <div className="text-center">
              <span className="text-[9px] text-zinc-600 font-medium">Shift Hours: {SHIFT_HOURS.start}:00 - {SHIFT_HOURS.end}:00</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (!userRole) {
    return (
      <div className="fixed inset-0 z-[300] bg-black flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-4xl w-full">
          <div className="bg-brand-yellow w-24 h-24 rounded-3xl flex items-center justify-center mx-auto mb-10 rotate-12 shadow-2xl shadow-brand-yellow/20">
            <span className="text-black font-black text-5xl">PJ</span>
          </div>
          <h1 className="text-5xl font-black text-white mb-4 tracking-tighter">STAFF IDENTITY</h1>
          <p className="text-zinc-500 font-bold uppercase tracking-widest text-sm mb-16">Select your workstation to begin your shift</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {(['FRONT_DESK', 'CHEF', 'PACKER', 'ADMIN'] as const).map(role => (
              <button key={role} onClick={() => setSelectedAuthRole(role)} className="group relative bg-zinc-900 border-2 border-zinc-800 p-8 rounded-[2.5rem] hover:border-brand-yellow transition-all duration-300 flex flex-col items-center gap-4 hover:-translate-y-2 active:scale-95 shadow-xl">
                <div className="w-16 h-16 rounded-2xl bg-zinc-800 group-hover:bg-brand-yellow flex items-center justify-center text-zinc-500 group-hover:text-black transition-colors uppercase">
                  {role === 'FRONT_DESK' && <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>}
                  {role === 'CHEF' && <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>}
                  {role === 'PACKER' && <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>}
                  {role === 'ADMIN' && <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>}
                </div>
                <span className="font-black text-lg tracking-tight text-white group-hover:text-brand-yellow uppercase">{role.replace('_', ' ')}</span>
              </button>
            ))}
          </div>
        </div>
        {selectedAuthRole && <AuthModal />}
      </div>
    );
  }

  if (hasApiKey === false) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black p-6">
        <div className="max-w-md w-full p-10 bg-zinc-900 rounded-3xl border border-zinc-800 text-center shadow-2xl">
          <div className="bg-brand-yellow w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-8 rotate-12"><span className="text-black font-black text-4xl">PJ</span></div>
          <h1 className="text-3xl font-black mb-4">API KEY REQUIRED</h1>
          <p className="text-zinc-400 mb-8 font-medium">Please connect your Gemini API key to access real-time kitchen insights and order simulation.</p>
          <button onClick={() => window.aistudio?.openSelectKey()} className="w-full py-5 bg-brand-yellow text-black font-black rounded-2xl text-lg hover:scale-105 transition-all shadow-xl shadow-brand-yellow/20">SELECT API KEY</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-brand-black text-white overflow-hidden selection:bg-brand-yellow selection:text-black">
      <div className="flex-grow flex flex-col h-full relative">
        <header className="h-20 flex items-center justify-between px-8 bg-zinc-900/80 backdrop-blur-xl border-b border-zinc-800 shrink-0 z-[60]">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-3">
              <div className="bg-brand-yellow p-2 rounded-xl"><span className="text-black font-black text-xl leading-none">PJ</span></div>
              <h1 className="font-black text-lg tracking-tighter hidden sm:block">{currentUser?.name || 'POT OF JOLLOF'}</h1>
            </div>
            <nav className="flex bg-black/50 p-1.5 rounded-2xl border border-zinc-800">
              {availableStations.map(s => (
                <button key={s} onClick={() => { setActiveStation(s); setActiveTab('ALL'); }} className={`px-5 py-2.5 rounded-xl text-[11px] font-black transition-all flex items-center gap-2 ${activeStation === s ? 'bg-brand-yellow text-black shadow-lg shadow-brand-yellow/10' : 'text-zinc-500 hover:text-zinc-300'}`}>
                  <span className={`w-2 h-2 rounded-full ${activeStation === s ? 'bg-black animate-pulse' : 'bg-zinc-800'}`}></span>
                  {s.replace('_', ' ')}
                </button>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-4">
              <div className="flex flex-col items-end pr-6 border-r border-zinc-800">
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-black text-brand-yellow uppercase tracking-widest">Logged in as:</span>
                  <button onClick={() => setUserRole(null)} className="text-[9px] font-black text-zinc-500 hover:text-white uppercase transition-colors">(Switch Staff)</button>
                </div>
                <p className="font-black text-xs uppercase tracking-tighter text-white">{userRole?.replace('_', ' ')}</p>
              </div>
              <div className="flex items-center bg-black/40 border border-zinc-800 rounded-xl px-4 py-2 gap-3">
                <input type="text" placeholder="Search ticket..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="bg-transparent border-none focus:ring-0 text-xs font-bold w-32 placeholder-zinc-700" />
                <svg className="w-4 h-4 text-zinc-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              </div>
              <SortToggle />
            </div>
            <div className="flex items-center gap-4">
              <button onClick={() => setShowReport(true)} className="px-4 py-2.5 bg-zinc-800 text-zinc-300 border border-zinc-700 rounded-xl font-black text-[10px] hover:bg-zinc-700 transition-all flex items-center gap-2">
                <svg className="w-4 h-4 text-brand-yellow" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                DAILY REPORT
              </button>
              {activeStation === 'FRONT_DESK' && preparingOrdersCount > 0 && (
                <button onClick={() => setShowBulkConfirm(true)} className="px-4 py-2.5 bg-zinc-800 text-green-500 border border-green-500/20 rounded-xl font-black text-[10px] hover:bg-green-500/10 transition-all flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-green-500 text-black flex items-center justify-center text-[8px]">{preparingOrdersCount}</div>
                  BULK READY
                </button>
              )}
              {activeStation === 'FRONT_DESK' && (
                <div className="flex gap-2">
                  <button disabled={simulationLoading} onClick={handleSimulateOrder} className={`px-4 py-2.5 bg-zinc-800 text-brand-yellow border border-brand-yellow/20 rounded-xl font-black text-[10px] hover:bg-zinc-700 transition-all ${simulationLoading ? 'opacity-50 animate-pulse' : ''}`}>SIMULATE TICKET</button>
                  <button onClick={() => setShowOrderModal(true)} className="px-6 py-2.5 bg-brand-yellow text-black rounded-xl font-black text-[10px] shadow-xl shadow-brand-yellow/20 hover:scale-105 transition-all">NEW ORDER +</button>
                </div>
              )}
              <div className="text-right border-l border-zinc-800 pl-6 flex flex-col justify-center">
                <p className="text-2xl font-mono font-black tracking-tighter text-brand-yellow leading-none">{currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}</p>
                <div className="flex items-center gap-1.5 justify-end mt-1">
                  <div className={`w-1.5 h-1.5 rounded-full ${isSyncing ? 'bg-green-500 animate-ping' : 'bg-zinc-700'}`}></div>
                  <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">LIVE SYNC</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        {activeStation === 'FRONT_DESK' && (
          <div className="px-8 py-4 bg-zinc-900/30 border-b border-zinc-800 flex items-center justify-between animate-in slide-in-from-top-4 duration-300">
            <div className="flex gap-2">
              {(['ALL', OrderStatus.NEW, OrderStatus.READY, OrderStatus.DISPATCHED] as const).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)} className={`px-6 py-2.5 rounded-xl font-black text-[10px] transition-all border ${activeTab === tab ? 'bg-brand-yellow text-black border-brand-yellow' : 'bg-transparent text-zinc-500 border-zinc-800 hover:border-zinc-600'}`}>
                  {tab === 'ALL' ? 'LIVE MONITOR' : tab === OrderStatus.DISPATCHED ? 'HISTORY (DONE)' : tab.toUpperCase()}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-4">
              <button onClick={() => setIsMuted(!isMuted)} className="p-2 text-zinc-500 hover:text-white transition-colors">
                {isMuted ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" /></svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
                )}
              </button>
            </div>
          </div>
        )}

        <main className="flex-grow p-8 overflow-y-auto bg-black/40">
          <div className="mb-10 animate-in fade-in slide-in-from-left-4 duration-500 flex justify-between items-end">
            <div>
              <h2 className="text-5xl font-black text-white tracking-tighter uppercase leading-none">{activeTab === OrderStatus.DISPATCHED ? 'HISTORY LOG' : stationInfo.title}</h2>
              <p className="text-zinc-500 font-bold mt-2 uppercase text-xs tracking-widest">{activeTab === OrderStatus.DISPATCHED ? 'Review and audit completed kitchen tickets' : stationInfo.desc}</p>
              <div className="h-1 w-20 bg-brand-yellow mt-4 rounded-full"></div>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-black text-brand-yellow uppercase tracking-[0.2em] mb-1">
                {filteredAndSortedOrders.length} {filteredAndSortedOrders.length === 1 ? 'RECORD' : 'RECORDS'}
              </span>
              <span className="text-[10px] font-bold text-zinc-600 uppercase">Sorted: {sortDirection === 'asc' ? 'Oldest First' : 'Newest First'}</span>
            </div>
          </div>

          {activeStation === 'FRONT_DESK' && activeTab === OrderStatus.DISPATCHED ? (
            <HistoryLog />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
              {filteredAndSortedOrders.map(order => (
                <OrderCard
                  key={order.id}
                  order={order}
                  activeStation={activeStation}
                  isMuted={isMuted}
                  onStatusChange={handleStatusChange}
                  onTypeChange={(id, t) => {
                    const updated = orders.map(o => o.id === id ? { ...o, type: t } : o);
                    setOrders(updated);
                    broadcast('SYNC_ORDERS', updated);
                  }}
                  onUpdateOrder={handleUpdateOrder}
                  onDeleteItem={handleDeleteItem}
                />
              ))}
              {filteredAndSortedOrders.length === 0 && (
                <div className="col-span-full h-96 flex flex-col items-center justify-center border-2 border-dashed border-zinc-800 rounded-[3rem] animate-in fade-in duration-700">
                  <div className="bg-zinc-900 p-8 rounded-full mb-6 opacity-20"><svg className="w-16 h-16 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg></div>
                  <p className="text-3xl font-black uppercase tracking-widest text-zinc-800">No Records Found</p>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {activeStation === 'CHEF' && (
        <ChefInsightsPanel insights={insights} sources={sources} loading={insightsLoading} onRefresh={refreshInsights} error={quotaError} />
      )}

      {showOrderModal && <OrderEntryModal />}
      {showBulkConfirm && <BulkConfirmModal />}
      {showReport && <DailyReportModal orders={orders} onClose={() => setShowReport(false)} />}
    </div>
  );
};

export default App;
