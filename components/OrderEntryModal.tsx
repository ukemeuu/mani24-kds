
import React, { useState } from 'react';
import { supabase } from '../supabaseClient';


// Define props interface
interface OrderEntryModalProps {
    onClose: () => void;
    playSound: () => void;
    setSimulationLoading: (loading: boolean) => void;
    tenantId: string;
}

const QUICK_MENU = [
    { name: 'Party Jollof Rice', category: 'Main', prep: 12 },
    { name: 'Beef Suya', category: 'Main', prep: 15 },
    { name: 'Chicken Suya', category: 'Main', prep: 15 },
    { name: 'Fried Plantain (Dodo)', category: 'Side', prep: 5 },
    { name: 'Moin Moin', category: 'Side', prep: 8 },
    { name: 'Zobo Drink', category: 'Drink', prep: 2 },
];

const OrderEntryModal: React.FC<OrderEntryModalProps> = ({ onClose, playSound, setSimulationLoading, tenantId }) => {
    const [name, setName] = useState('');
    const [type, setType] = useState<'Dine-in' | 'Takeout' | 'Delivery'>('Dine-in');
    const [items, setItems] = useState<{ name: string, quantity: number, category: string, prep: number }[]>([]);

    const handleAddItem = (menuItem: typeof QUICK_MENU[0]) => {
        setItems(prev => {
            const existing = prev.find(i => i.name === menuItem.name);
            if (existing) {
                return prev.map(i => i.name === menuItem.name ? { ...i, quantity: i.quantity + 1 } : i);
            }
            return [...prev, { name: menuItem.name, quantity: 1, category: menuItem.category, prep: menuItem.prep }];
        });
    };

    const handleRemoveItem = (itemName: string) => {
        setItems(prev => {
            const existing = prev.find(i => i.name === itemName);
            if (existing && existing.quantity > 1) {
                return prev.map(i => i.name === itemName ? { ...i, quantity: i.quantity - 1 } : i);
            }
            return prev.filter(i => i.name !== itemName);
        });
    };

    const addQuickOrder = async () => {
        if (!name || items.length === 0) return;

        if (supabase) {
            setSimulationLoading(true);
            const createdAt = Date.now();
            const { data: orderData, error } = await supabase.from('orders').insert({
                order_number: `PJ-${Math.floor(100 + Math.random() * 899)}`,
                customer_name: name,
                type: type,
                status: 'NEW',
                created_at: createdAt,
                tenant_id: tenantId
            }).select().single();

            if (error) {
                console.error('Error creating order:', error);
                setSimulationLoading(false);
                return;
            }

            if (orderData) {
                const orderItems = items.map(item => ({
                    order_id: orderData.id,
                    name: item.name,
                    quantity: item.quantity,
                    category: item.category,
                    estimated_prep_time: item.prep
                }));

                const { error: itemsError } = await supabase.from('order_items').insert(orderItems);

                if (itemsError) console.error('Error creating items:', itemsError);
            }
            setSimulationLoading(false);
        }

        playSound();
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[120] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-zinc-900 border-2 border-brand-yellow rounded-3xl w-full max-w-4xl p-8 shadow-2xl animate-in zoom-in duration-200 flex gap-8">

                {/* Left Col: Order Details */}
                <div className="w-1/2 flex flex-col space-y-6">
                    <div className="flex justify-between items-center">
                        <h2 className="text-3xl font-black text-brand-yellow tracking-tighter">NEW ORDER</h2>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-zinc-500">Customer Name</label>
                            <input autoFocus placeholder="Enter customer name..." value={name} onChange={e => setName(e.target.value)} className="w-full bg-black border border-zinc-800 p-4 rounded-2xl font-bold text-xl text-white focus:outline-none focus:border-brand-yellow" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-zinc-500">Order Type</label>
                            <div className="grid grid-cols-3 gap-2">
                                {(['Dine-in', 'Takeout', 'Delivery'] as const).map(t => (
                                    <button key={t} onClick={() => setType(t)} className={`py-3 rounded-xl font-black text-[10px] uppercase transition-all ${type === t ? 'bg-brand-yellow text-black' : 'bg-zinc-800 text-zinc-500 hover:bg-zinc-700'}`}>{t}</button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="flex-grow bg-black/50 rounded-2xl p-4 border border-zinc-800 overflow-y-auto max-h-[300px]">
                        {items.length === 0 ? (
                            <div className="h-full flex items-center justify-center text-zinc-600 text-sm font-bold italic">No items added</div>
                        ) : (
                            <div className="space-y-2">
                                {items.map(item => (
                                    <div key={item.name} className="flex justify-between items-center bg-zinc-900 p-2 rounded-xl border border-zinc-800">
                                        <span className="font-bold text-sm text-zinc-200">{item.name}</span>
                                        <div className="flex items-center gap-3">
                                            <button onClick={() => handleRemoveItem(item.name)} className="w-6 h-6 rounded-full bg-zinc-800 text-white flex items-center justify-center hover:bg-red-900">-</button>
                                            <span className="font-black text-brand-yellow">{item.quantity}</span>
                                            <button onClick={() => handleAddItem(item)} className="w-6 h-6 rounded-full bg-zinc-800 text-white flex items-center justify-center hover:bg-brand-yellow hover:text-black">+</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <button disabled={!name || items.length === 0} onClick={addQuickOrder} className={`py-5 bg-brand-yellow text-black font-black rounded-2xl text-xl shadow-lg shadow-brand-yellow/20 active:scale-95 transition-all ${(!name || items.length === 0) ? 'opacity-50 cursor-not-allowed' : ''}`}>CREATE TICKET</button>
                </div>

                {/* Right Col: Menu */}
                <div className="w-1/2 flex flex-col border-l border-zinc-800 pl-8">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-black text-white uppercase tracking-wide">Menu</h3>
                        <button onClick={onClose} className="text-zinc-500 hover:text-white">
                            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3 overflow-y-auto">
                        {QUICK_MENU.map(item => (
                            <button
                                key={item.name}
                                onClick={() => handleAddItem(item)}
                                className="flex flex-col items-start p-4 bg-zinc-900 border border-zinc-800 rounded-2xl hover:bg-zinc-800 hover:border-brand-yellow/50 transition-all active:scale-95 group text-left"
                            >
                                <span className="font-bold text-sm text-zinc-300 group-hover:text-white mb-1">{item.name}</span>
                                <div className="flex justify-between w-full">
                                    <span className="text-[10px] font-black uppercase text-zinc-600 bg-black px-2 py-0.5 rounded">{item.category}</span>
                                    <span className="text-[10px] font-mono text-zinc-500">{item.prep}m</span>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

            </div>
        </div>
    );
};

export default OrderEntryModal;
