
import React, { useState, useEffect, useRef } from 'react';
import { Order, OrderStatus, OrderItem, StationType } from '../types';
import { ICONS } from '../constants';

interface OrderCardProps {
  order: Order;
  activeStation: StationType;
  isMuted?: boolean;
  onStatusChange: (id: string, newStatus: OrderStatus) => void;
  onTypeChange: (id: string, newType: 'Dine-in' | 'Takeout' | 'Delivery') => void;
  onUpdateOrder: (updatedOrder: Order) => void;
  onDeleteItem: (orderId: string, itemId: string) => void;
}

const QUICK_MENU = [
  { name: 'Party Jollof Rice', category: 'Main', prep: 12 },
  { name: 'Beef Suya', category: 'Main', prep: 15 },
  { name: 'Chicken Suya', category: 'Main', prep: 15 },
  { name: 'Fried Plantain (Dodo)', category: 'Side', prep: 5 },
  { name: 'Moin Moin', category: 'Side', prep: 8 },
  { name: 'Zobo Drink', category: 'Drink', prep: 2 },
];

const OrderCard: React.FC<OrderCardProps> = ({ order, activeStation, isMuted, onStatusChange, onTypeChange, onUpdateOrder, onDeleteItem }) => {
  const [minutesElapsed, setMinutesElapsed] = useState(Math.floor((Date.now() - order.createdAt) / 60000));
  const [isUpdated, setIsUpdated] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editOrder, setEditOrder] = useState<Order>(order);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [flashingItemId, setFlashingItemId] = useState<string | null>(null);
  
  // Inline Note State
  const [editingNoteItemId, setEditingNoteItemId] = useState<string | null>(null);
  const [tempNoteValue, setTempNoteValue] = useState('');

  // New Item State for Modal
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [newItem, setNewItem] = useState<Partial<OrderItem>>({
    name: '',
    quantity: 1,
    category: 'Main',
    estimatedPrepTime: 12,
    notes: ''
  });

  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);
  const [dragOverItemIndex, setDragOverItemIndex] = useState<number | null>(null);

  const prevStatus = useRef(order.status);
  const prevType = useRef(order.type);
  const hasPlayedNewSound = useRef(false);

  const soundNewOrderRef = useRef(new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'));

  useEffect(() => {
    const interval = setInterval(() => {
      setMinutesElapsed(Math.floor((Date.now() - order.createdAt) / 60000));
    }, 30000);
    return () => clearInterval(interval);
  }, [order.createdAt]);

  useEffect(() => {
    if (prevStatus.current !== order.status || prevType.current !== order.type) {
      setIsUpdated(true);
      const timer = setTimeout(() => setIsUpdated(false), 500);
      prevStatus.current = order.status;
      prevType.current = order.type;
      return () => clearTimeout(timer);
    }
  }, [order.status, order.type]);

  useEffect(() => {
    if (!isEditing) {
      setEditOrder(order);
      setShowAddItemModal(false);
      setConfirmingDeleteId(null);
      setFlashingItemId(null);
      setEditingNoteItemId(null);
    }
  }, [order, isEditing]);

  useEffect(() => {
    if (order.status === OrderStatus.NEW && !isMuted && !hasPlayedNewSound.current) {
      soundNewOrderRef.current.currentTime = 0;
      soundNewOrderRef.current.play().catch(() => {});
      hasPlayedNewSound.current = true;
    }
    if (order.status !== OrderStatus.NEW) {
      hasPlayedNewSound.current = false;
    }
  }, [order.status, isMuted]);

  const triggerItemFlash = (itemId: string) => {
    setFlashingItemId(itemId);
    setTimeout(() => setFlashingItemId(null), 500);
  };

  const isDelayed = minutesElapsed >= 20 && order.status !== OrderStatus.DISPATCHED;
  const isCritical = minutesElapsed >= 15 && minutesElapsed < 20 && order.status !== OrderStatus.DISPATCHED;
  const isWarning = minutesElapsed >= 5 && minutesElapsed < 15 && order.status !== OrderStatus.DISPATCHED;
  const isReady = order.status === OrderStatus.READY;
  const isPacking = order.status === OrderStatus.PACKING;
  const isDispatched = order.status === OrderStatus.DISPATCHED;

  const getUrgencyColor = () => {
    if (isDispatched) return 'bg-zinc-900/40 border-zinc-800 opacity-90';
    if (isReady && activeStation === 'FRONT_DESK') return 'bg-green-700 border-green-500 shadow-lg';
    if (isDelayed) return 'bg-red-700 border-red-500 shadow-xl';
    if (isCritical) return 'bg-red-600 border-red-500 shadow-lg';
    if (isWarning) return 'bg-orange-500 border-orange-400 shadow-md';
    return 'bg-brand-dark border-zinc-800';
  };

  const totalSumPrepTime = editOrder.items.reduce((sum, item) => {
    const prepTime = item.estimatedPrepTime || (item.category === 'Main' ? 15 : item.category === 'Side' ? 8 : 2);
    return sum + (prepTime * item.quantity);
  }, 0);

  const OrderTypeSegment = ({ type, label }: { type: 'Dine-in' | 'Takeout' | 'Delivery', label: string }) => {
    const isActive = order.type === type;
    return (
      <button
        onClick={() => onTypeChange(order.id, type)}
        className={`px-2 py-0.5 text-[9px] font-black uppercase tracking-tighter transition-all rounded cursor-pointer ${
          isActive 
            ? (isReady || isDispatched) ? 'bg-black text-brand-yellow shadow-inner' : 'bg-brand-yellow text-black' 
            : 'text-zinc-500 hover:text-white hover:bg-white/10 active:scale-95'
        }`}
      >
        {label}
      </button>
    );
  };

  const handleSaveEdit = () => {
    onUpdateOrder(editOrder);
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditOrder(order);
  };

  const handleItemEdit = (itemId: string, field: keyof OrderItem, value: any) => {
    setEditOrder(prev => ({
      ...prev,
      items: prev.items.map(item => item.id === itemId ? { ...item, [field]: value } : item)
    }));
    triggerItemFlash(itemId);
  };

  const handleUpdateQuantity = (itemId: string, delta: number) => {
    setEditOrder(prev => ({
      ...prev,
      items: prev.items.map(item => {
        if (item.id === itemId) {
          const newQty = Math.max(1, item.quantity + delta);
          return { ...item, quantity: newQty };
        }
        return item;
      })
    }));
    triggerItemFlash(itemId);
  };

  const handleConfirmDelete = (itemId: string) => {
    setEditOrder(prev => ({
      ...prev,
      items: prev.items.filter(i => i.id !== itemId)
    }));
    setConfirmingDeleteId(null);
  };

  const handleAddItem = () => {
    if (!newItem.name) return;
    const itemToAdd: OrderItem = {
      id: `new-${Date.now()}`,
      name: newItem.name,
      quantity: newItem.quantity || 1,
      category: newItem.category as any || 'Main',
      estimatedPrepTime: newItem.estimatedPrepTime || 12,
      notes: newItem.notes || ''
    };
    setEditOrder(prev => ({
      ...prev,
      items: [...prev.items, itemToAdd]
    }));
    setShowAddItemModal(false);
    setNewItem({ name: '', quantity: 1, category: 'Main', estimatedPrepTime: 12, notes: '' });
  };

  const handleQuickSelect = (item: typeof QUICK_MENU[0]) => {
    setNewItem(prev => ({
      ...prev,
      name: item.name,
      category: item.category as any,
      estimatedPrepTime: item.prep
    }));
  };

  // Drag and Drop Logic
  const handleDragStart = (index: number) => {
    if (isDispatched || !isEditing) return;
    setDraggedItemIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedItemIndex === null || draggedItemIndex === index) return;
    setDragOverItemIndex(index);
  };

  const handleDrop = (index: number) => {
    if (draggedItemIndex === null) return;
    const newItems = [...editOrder.items];
    const [draggedItem] = newItems.splice(draggedItemIndex, 1);
    newItems.splice(index, 0, draggedItem);
    setEditOrder(prev => ({ ...prev, items: newItems }));
    setDraggedItemIndex(null);
    setDragOverItemIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedItemIndex(null);
    setDragOverItemIndex(null);
  };

  const handleStartEditNote = (item: OrderItem) => {
    setEditingNoteItemId(item.id);
    setTempNoteValue(item.notes || '');
  };

  const handleSaveInlineNote = (itemId: string) => {
    const updatedOrder = {
      ...order,
      items: order.items.map(i => i.id === itemId ? { ...i, notes: tempNoteValue } : i)
    };
    onUpdateOrder(updatedOrder);
    setEditingNoteItemId(null);
    triggerItemFlash(itemId);
  };

  const action = (() => {
    if (isDispatched) return null;
    switch (activeStation) {
      case 'CHEF':
        if (order.status === OrderStatus.NEW) return { label: 'START PREP', next: OrderStatus.PREPARING };
        if (order.status === OrderStatus.PREPARING) return { label: 'PUSH TO PACKER', next: OrderStatus.PACKING };
        return null;
      case 'PACKER':
        if (order.status === OrderStatus.PACKING) return { label: 'MARK AS READY', next: OrderStatus.READY };
        return null;
      case 'FRONT_DESK':
        if (order.status === OrderStatus.READY) return { label: 'DISPATCH', next: OrderStatus.DISPATCHED };
        return null;
      default:
        return null;
    }
  })();

  return (
    <div className={`flex flex-col border-2 rounded-xl overflow-hidden transition-all duration-300 relative 
      ${getUrgencyColor()} 
      ${isDelayed || isCritical ? 'animate-critical' : ''} 
      ${isReady ? 'ring-4 ring-brand-yellow animate-ready-shimmer z-10' : ''}
      ${isUpdated ? 'animate-status-change' : ''}`}>
      
      {isReady && (
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden rounded-xl">
          <div className="absolute top-0 bottom-0 w-[40%] bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer-sweep" />
        </div>
      )}
      
      {isDelayed && <div className="absolute top-2 right-2 z-10"><span className="bg-white text-red-600 text-[10px] font-black px-2 py-0.5 rounded-full animate-pulse shadow-sm ring-2 ring-red-500">DELAYED</span></div>}
      {!isDelayed && isCritical && <div className="absolute top-2 right-2 z-10"><span className="bg-white text-red-600 text-[10px] font-black px-2 py-0.5 rounded-full animate-pulse shadow-sm">CRITICAL</span></div>}
      {isPacking && <div className="absolute top-2 right-2 z-10"><span className="bg-brand-yellow text-black text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm">PACKING</span></div>}
      {isReady && <div className="absolute top-2 right-2 z-10"><span className="bg-white text-black text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm border border-brand-yellow animate-pulse">READY</span></div>}

      <div className={`p-3 flex justify-between items-start transition-colors duration-300 relative z-10
        ${isReady ? 'bg-brand-yellow text-black' : 
          isDelayed ? 'bg-red-800 text-white' : 
          isCritical ? 'bg-red-700 text-white' : 
          isWarning ? 'bg-orange-600 text-white' : 
          isDispatched ? 'bg-zinc-800/50 text-zinc-400' : 'bg-zinc-900 text-white'}`}>
        <div className="flex flex-col flex-grow min-w-0 pr-4">
          <div className="flex items-center gap-2">
            <h3 className="font-black text-xl leading-none tracking-tight">{order.orderNumber}</h3>
            {!isDispatched && activeStation === 'FRONT_DESK' && (
              <button onClick={() => setIsEditing(!isEditing)} className={`p-1 rounded transition-colors ${isEditing ? 'bg-white text-black' : 'hover:bg-white/10'}`}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
              </button>
            )}
          </div>
          <div className="mt-2 flex flex-col gap-1.5">
            <span className="text-[10px] font-black uppercase flex items-center gap-1 opacity-90"><ICONS.Clock /> Load: {totalSumPrepTime}m</span>
            <div className={`flex items-center p-0.5 rounded-md gap-0.5 w-fit ${isReady || isDispatched ? 'bg-black/60 border border-brand-yellow/20' : 'bg-black/40 border border-zinc-800'}`}>
              <OrderTypeSegment type="Dine-in" label="DINE" />
              <OrderTypeSegment type="Takeout" label="TO-GO" />
              <OrderTypeSegment type="Delivery" label="DELIV" />
            </div>
          </div>
        </div>
        <div className={`flex items-center gap-1 font-mono font-bold text-2xl ${isDelayed || isCritical ? 'animate-pulse' : ''}`}><span>{minutesElapsed}m</span></div>
      </div>

      <div className="p-4 flex-grow space-y-3 bg-brand-dark/60 backdrop-blur-sm overflow-y-auto max-h-[400px] relative z-10">
        {/* ADD ITEM MODAL OVERLAY */}
        {showAddItemModal && (
          <div className="absolute inset-0 z-50 bg-black/95 p-4 flex flex-col animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-brand-yellow font-black text-xs uppercase tracking-widest">Add New Item</h4>
              <button onClick={() => setShowAddItemModal(false)} className="text-zinc-500 hover:text-white">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="flex-grow space-y-4 overflow-y-auto pr-1">
              <div className="space-y-2">
                <p className="text-[8px] font-black text-zinc-600 uppercase">Quick Add</p>
                <div className="grid grid-cols-2 gap-2">
                  {QUICK_MENU.map(item => (
                    <button 
                      key={item.name} 
                      onClick={() => handleQuickSelect(item)}
                      className={`px-2 py-2 text-[9px] font-black text-left rounded-lg border border-zinc-800 hover:border-brand-yellow/50 transition-colors ${newItem.name === item.name ? 'bg-brand-yellow/10 border-brand-yellow text-brand-yellow' : 'bg-zinc-900 text-zinc-400'}`}
                    >
                      {item.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <input 
                  autoFocus 
                  placeholder="Item Name..." 
                  value={newItem.name} 
                  onChange={e => setNewItem({...newItem, name: e.target.value})} 
                  className="w-full bg-black border border-zinc-800 rounded-lg px-3 py-2.5 text-xs font-bold text-white focus:outline-none focus:border-brand-yellow" 
                />
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[8px] font-black text-zinc-600 uppercase">Quantity</label>
                    <input type="number" min="1" value={newItem.quantity} onChange={e => setNewItem({...newItem, quantity: parseInt(e.target.value) || 1})} className="w-full bg-black border border-zinc-800 rounded-lg px-3 py-2 text-xs font-bold text-white focus:outline-none" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] font-black text-zinc-600 uppercase">Prep (min)</label>
                    <input type="number" min="1" value={newItem.estimatedPrepTime} onChange={e => setNewItem({...newItem, estimatedPrepTime: parseInt(e.target.value) || 10})} className="w-full bg-black border border-zinc-800 rounded-lg px-3 py-2 text-xs font-bold text-white focus:outline-none" />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[8px] font-black text-zinc-600 uppercase">Category</label>
                  <div className="flex gap-1">
                    {['Main', 'Side', 'Drink'].map(cat => (
                      <button 
                        key={cat} 
                        onClick={() => setNewItem({...newItem, category: cat as any})}
                        className={`flex-grow py-2 rounded-lg text-[9px] font-black uppercase transition-all ${newItem.category === cat ? 'bg-brand-yellow text-black' : 'bg-zinc-900 text-zinc-600 border border-zinc-800'}`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <button 
              onClick={handleAddItem} 
              disabled={!newItem.name}
              className={`mt-4 w-full py-4 bg-brand-yellow text-black font-black rounded-xl text-xs uppercase shadow-lg shadow-brand-yellow/10 transition-all active:scale-95 ${!newItem.name ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              Confirm Item
            </button>
          </div>
        )}

        {isEditing ? (
          <div className="space-y-1">
            <label className="text-[10px] text-zinc-500 font-bold uppercase">Customer Name</label>
            <input type="text" value={editOrder.customerName} onChange={(e) => setEditOrder({...editOrder, customerName: e.target.value})} className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-sm font-bold text-white focus:outline-none focus:border-brand-yellow" />
          </div>
        ) : (
          <div className="flex items-center gap-2 text-zinc-300"><ICONS.User /><span className={`text-sm font-bold truncate ${isDispatched ? 'text-zinc-500' : ''}`}>{order.customerName}</span></div>
        )}
        
        <div className="space-y-2 pt-2">
          {editOrder.items.map((item, index) => (
            <div 
              key={item.id} 
              draggable={isEditing} 
              onDragStart={() => handleDragStart(index)} 
              onDragOver={(e) => handleDragOver(e, index)} 
              onDrop={() => handleDrop(index)} 
              onDragEnd={handleDragEnd}
              onDragLeave={(e) => {
                // Only reset if we're actually leaving the element, not just entering a child
                if (dragOverItemIndex === index) setDragOverItemIndex(null);
              }}
              className={`relative flex justify-between items-start gap-3 group transition-all duration-200 p-2 rounded-lg border-2 border-transparent
                ${draggedItemIndex === index ? 'opacity-30 bg-zinc-800/50' : ''} 
                ${dragOverItemIndex === index ? 'border-t-brand-yellow bg-brand-yellow/5' : ''} 
                ${flashingItemId === item.id ? 'animate-status-change border-brand-yellow/30 bg-white/5' : ''}`}
            >
              <div className="flex gap-2 min-w-0 flex-grow">
                {isEditing ? (
                  <div className="flex flex-col gap-1 items-center shrink-0">
                    {/* Drag Handle */}
                    <div className="p-1 mb-1 text-zinc-600 hover:text-brand-yellow cursor-grab active:cursor-grabbing">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                      </svg>
                    </div>

                    <div className="flex flex-col items-center bg-black rounded-lg border border-brand-yellow overflow-hidden">
                      <button 
                        onClick={() => handleUpdateQuantity(item.id, 1)}
                        className="w-full py-1.5 bg-brand-yellow text-black hover:bg-yellow-400 active:bg-yellow-500 flex items-center justify-center"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
                      </button>
                      <div className="px-2 py-1 bg-black text-white text-xs font-black">
                        {item.quantity}
                      </div>
                      <button 
                        onClick={() => handleUpdateQuantity(item.id, -1)}
                        className="w-full py-1.5 bg-zinc-800 text-brand-yellow hover:bg-zinc-700 active:bg-zinc-600 flex items-center justify-center"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M20 12H4" /></svg>
                      </button>
                    </div>
                    
                    {confirmingDeleteId === item.id ? (
                      <div className="flex flex-col gap-1 mt-2">
                        <button onClick={() => handleConfirmDelete(item.id)} className="p-1.5 bg-red-600 text-white rounded-lg animate-pulse">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                        </button>
                        <button onClick={() => setConfirmingDeleteId(null)} className="p-1.5 bg-zinc-700 text-white rounded-lg">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => setConfirmingDeleteId(item.id)} className="mt-1 p-1 text-zinc-700 hover:text-red-500 transition-colors">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    )}
                  </div>
                ) : (
                  <span className={`flex-shrink-0 font-black px-2 py-0.5 rounded text-sm h-fit ${isDispatched ? 'bg-zinc-800 text-zinc-600' : 'bg-brand-yellow text-black'}`}>{item.quantity}x</span>
                )}
                <div className="min-w-0 flex-grow">
                  <p className={`font-bold leading-tight ${isDispatched ? 'text-zinc-600' : 'text-zinc-100'}`}>{item.name}</p>
                  
                  {/* Notes Section - Refactored for Inline Editing */}
                  <div className="mt-1.5">
                    {isEditing ? (
                      <div className="space-y-1.5">
                        <input 
                          type="text" 
                          placeholder="Instructions..." 
                          value={item.notes || ''} 
                          onChange={(e) => handleItemEdit(item.id, 'notes', e.target.value)} 
                          className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-[10px] text-zinc-300 focus:outline-none focus:border-brand-yellow" 
                        />
                        <div className="flex items-center gap-1.5">
                          <span className="text-[8px] font-black uppercase text-zinc-600">Prep(m):</span>
                          <input type="number" min="0" value={item.estimatedPrepTime || 10} onChange={(e) => handleItemEdit(item.id, 'estimatedPrepTime', Math.max(0, parseInt(e.target.value) || 0))} className="w-10 bg-black border border-zinc-800 rounded px-1 py-0.5 text-[9px] font-bold text-brand-yellow text-center" />
                        </div>
                      </div>
                    ) : editingNoteItemId === item.id ? (
                      <div className="p-2 rounded-lg bg-black border border-brand-yellow animate-in fade-in duration-200">
                        <textarea 
                          autoFocus
                          value={tempNoteValue}
                          onChange={(e) => setTempNoteValue(e.target.value)}
                          placeholder="Kitchen note..."
                          className="w-full bg-transparent border-none focus:ring-0 text-[11px] font-bold text-brand-yellow resize-none h-16 mb-2"
                        />
                        <div className="flex gap-1">
                          <button onClick={() => handleSaveInlineNote(item.id)} className="flex-grow py-1 bg-brand-yellow text-black font-black text-[9px] rounded uppercase">Save Note</button>
                          <button onClick={() => setEditingNoteItemId(null)} className="px-3 py-1 bg-zinc-800 text-zinc-400 font-bold text-[9px] rounded uppercase">X</button>
                        </div>
                      </div>
                    ) : item.notes ? (
                      <div 
                        onClick={() => handleStartEditNote(item)}
                        className="group relative cursor-pointer p-2 rounded-md bg-brand-yellow/10 border border-brand-yellow/30 hover:bg-brand-yellow/20 transition-colors"
                      >
                        <p className="text-[11px] font-bold italic text-brand-yellow pr-4">"{item.notes}"</p>
                        <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <svg className="w-2.5 h-2.5 text-brand-yellow" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                        </div>
                      </div>
                    ) : (
                      !isDispatched && (
                        <button 
                          onClick={() => handleStartEditNote(item)}
                          className="text-[9px] font-black text-zinc-700 hover:text-brand-yellow flex items-center gap-1 transition-colors uppercase tracking-widest"
                        >
                          <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg> Add Note
                        </button>
                      )
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {isEditing && (
            <button 
              onClick={() => setShowAddItemModal(true)} 
              className="w-full py-3 border border-dashed border-brand-yellow/40 rounded-xl text-brand-yellow text-[10px] font-black uppercase hover:bg-brand-yellow/10 transition-colors flex items-center justify-center gap-2 mt-4"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
              Add Item +
            </button>
          )}
        </div>
      </div>

      <div className="p-2 bg-zinc-900 flex flex-col gap-2 mt-auto relative z-10">
        {isEditing ? (
          <div className="flex gap-2">
            <button 
              onClick={handleSaveEdit} 
              className="flex-grow py-3 bg-brand-yellow text-black font-black rounded-lg hover:bg-yellow-400 active:scale-95 transition-all shadow-lg shadow-brand-yellow/20 uppercase text-[10px] tracking-widest"
            >
              SAVE CHANGES
            </button>
            <button 
              onClick={handleCancelEdit} 
              className="px-6 py-3 bg-zinc-800 text-zinc-400 font-black rounded-lg hover:bg-zinc-700 transition-all border border-zinc-700 uppercase text-[10px] tracking-widest"
            >
              CANCEL
            </button>
          </div>
        ) : action ? (
          <button onClick={() => onStatusChange(order.id, action.next)} className={`w-full py-3 text-black font-black rounded-lg shadow-lg active:scale-95 transition-all ${isReady ? 'bg-green-500 hover:bg-green-400' : 'bg-brand-yellow hover:bg-yellow-400'}`}>{action.label}</button>
        ) : (
          activeStation === 'FRONT_DESK' && (order.status === OrderStatus.NEW || order.status === OrderStatus.PREPARING) && (
            <button onClick={() => setIsEditing(true)} className="w-full py-3 bg-zinc-800 text-brand-yellow font-black rounded-lg shadow-lg active:scale-95 transition-all hover:bg-zinc-700 border border-brand-yellow/20">EDIT TICKET</button>
          )
        )}
      </div>
    </div>
  );
};

export default OrderCard;
