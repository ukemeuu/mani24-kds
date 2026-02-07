
import React, { useState, useMemo } from 'react';
import { Order, OrderStatus } from '../types';

interface OrderHistoryDashboardProps {
    orders: Order[];
    onClose: () => void;
}

type DateFilter = 'TODAY' | 'YESTERDAY' | 'CUSTOM';

const OrderHistoryDashboard: React.FC<OrderHistoryDashboardProps> = ({ orders, onClose }) => {
    const [dateFilter, setDateFilter] = useState<DateFilter>('TODAY');
    const [customDate, setCustomDate] = useState<string>(new Date().toISOString().split('T')[0]);

    const filteredOrders = useMemo(() => {
        let startTimestamp: number;
        let endTimestamp: number;
        const now = new Date();

        if (dateFilter === 'TODAY') {
            const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            startTimestamp = start.getTime();
            endTimestamp = startTimestamp + 86400000;
        } else if (dateFilter === 'YESTERDAY') {
            const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
            startTimestamp = start.getTime();
            endTimestamp = startTimestamp + 86400000;
        } else {
            const start = new Date(customDate);
            startTimestamp = start.getTime();
            endTimestamp = startTimestamp + 86400000;
        }

        return orders.filter(o => o.createdAt >= startTimestamp && o.createdAt < endTimestamp);
    }, [orders, dateFilter, customDate]);

    const analytics = useMemo(() => {
        const totalOrders = filteredOrders.length;
        const completedOrders = filteredOrders.filter(o => o.status === OrderStatus.DISPATCHED || o.status === OrderStatus.SERVED);

        let totalPrepTime = 0;
        let prepCount = 0;

        completedOrders.forEach(o => {
            if (o.dispatchedAt) {
                totalPrepTime += (o.dispatchedAt - o.createdAt);
                prepCount++;
            }
        });

        const avgPrepTime = prepCount > 0 ? Math.round(totalPrepTime / prepCount / 60000) : 0;

        // Top Items
        const itemCounts: Record<string, number> = {};
        filteredOrders.forEach(o => {
            o.items.forEach(i => {
                itemCounts[i.name] = (itemCounts[i.name] || 0) + i.quantity;
            });
        });

        const topItems = Object.entries(itemCounts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 3);

        return { totalOrders, avgPrepTime, topItems };
    }, [filteredOrders]);

    return (
        <div className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-md flex flex-col p-6 overflow-hidden">
            {/* Header */}
            <div className="flex justify-between items-center mb-8 shrink-0">
                <div>
                    <h2 className="text-4xl font-black text-white tracking-tighter uppercase">Kitchen Analytics</h2>
                    <p className="text-zinc-500 font-bold uppercase tracking-widest text-sm mt-1">Performance Overview & History</p>
                </div>
                <button onClick={onClose} className="bg-zinc-800 hover:bg-zinc-700 text-white p-3 rounded-full transition-colors">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>

            {/* Filters */}
            <div className="flex gap-4 mb-8 shrink-0">
                <button
                    onClick={() => setDateFilter('TODAY')}
                    className={`px-6 py-3 rounded-xl font-black text-xs uppercase tracking-wide transition-all ${dateFilter === 'TODAY' ? 'bg-brand-yellow text-black' : 'bg-zinc-900 text-zinc-500 border border-zinc-800'}`}
                >
                    Today
                </button>
                <button
                    onClick={() => setDateFilter('YESTERDAY')}
                    className={`px-6 py-3 rounded-xl font-black text-xs uppercase tracking-wide transition-all ${dateFilter === 'YESTERDAY' ? 'bg-brand-yellow text-black' : 'bg-zinc-900 text-zinc-500 border border-zinc-800'}`}
                >
                    Yesterday
                </button>
                <div className={`flex items-center px-4 rounded-xl border transition-all ${dateFilter === 'CUSTOM' ? 'bg-brand-yellow border-brand-yellow text-black' : 'bg-zinc-900 border-zinc-800 text-zinc-500'}`}>
                    <input
                        type="date"
                        value={customDate}
                        onChange={(e) => { setCustomDate(e.target.value); setDateFilter('CUSTOM'); }}
                        className="bg-transparent font-black text-xs uppercase focus:outline-none"
                    />
                </div>
            </div>

            {/* Analytics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 shrink-0">
                <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl">
                    <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mb-1">Total Orders</p>
                    <p className="text-4xl font-black text-white">{analytics.totalOrders}</p>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl">
                    <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mb-1">Avg. Prep Time</p>
                    <p className="text-4xl font-black text-brand-yellow">{analytics.avgPrepTime} <span className="text-lg text-zinc-600">min</span></p>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl">
                    <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mb-2">Top Selling Items</p>
                    <div className="space-y-2">
                        {analytics.topItems.map(([name, count], idx) => (
                            <div key={idx} className="flex justify-between items-center">
                                <span className="text-zinc-300 text-xs font-bold truncate max-w-[150px]">{name}</span>
                                <span className="text-brand-yellow text-xs font-black">{count}</span>
                            </div>
                        ))}
                        {analytics.topItems.length === 0 && <span className="text-zinc-700 text-xs italic">No data</span>}
                    </div>
                </div>
            </div>

            {/* Order List Table */}
            <div className="flex-grow bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden flex flex-col">
                <div className="overflow-x-auto overflow-y-auto h-full">
                    <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 bg-zinc-900 z-10">
                            <tr className="text-zinc-500 text-[10px] font-black uppercase tracking-widest border-b border-zinc-800">
                                <th className="px-6 py-4">Time</th>
                                <th className="px-6 py-4">Order #</th>
                                <th className="px-6 py-4">Customer</th>
                                <th className="px-6 py-4">Items</th>
                                <th className="px-6 py-4">Total</th>
                                <th className="px-6 py-4">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800/50">
                            {filteredOrders.length > 0 ? filteredOrders.map(order => (
                                <tr key={order.id} className="hover:bg-brand-yellow/5 transition-colors">
                                    <td className="px-6 py-4 text-zinc-400 font-mono text-xs">
                                        {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </td>
                                    <td className="px-6 py-4 text-brand-yellow font-black">{order.orderNumber}</td>
                                    <td className="px-6 py-4 text-white font-bold text-sm">{order.customerName}</td>
                                    <td className="px-6 py-4 text-zinc-400 text-xs max-w-[200px] truncate">
                                        {order.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}
                                    </td>
                                    <td className="px-6 py-4 text-zinc-300 font-bold">
                                        {order.items.reduce((sum, i) => sum + i.quantity, 0)}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded text-[9px] font-black uppercase ${order.status === 'DISPATCHED' ? 'bg-green-500/20 text-green-500' :
                                                order.status === 'READY' ? 'bg-brand-yellow/20 text-brand-yellow' :
                                                    'bg-zinc-800 text-zinc-400'
                                            }`}>
                                            {order.status}
                                        </span>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-zinc-600 font-medium">
                                        No orders found for this period.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default OrderHistoryDashboard;
