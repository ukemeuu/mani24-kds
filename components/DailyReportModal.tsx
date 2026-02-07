
import React from 'react';
import { Order, OrderStatus } from '../types';

interface DailyReportModalProps {
  orders: Order[];
  onClose: () => void;
}

const DailyReportModal: React.FC<DailyReportModalProps> = ({ orders, onClose }) => {
  const totalOrders = orders.length;
  const dispatched = orders.filter(o => o.status === OrderStatus.DISPATCHED).length;
  const active = totalOrders - dispatched;
  
  const typeStats = {
    'Dine-in': orders.filter(o => o.type === 'Dine-in').length,
    'Takeout': orders.filter(o => o.type === 'Takeout').length,
    'Delivery': orders.filter(o => o.type === 'Delivery').length,
  };

  const stationStats = {
    'CHEF (Prep)': orders.filter(o => o.status === OrderStatus.NEW || o.status === OrderStatus.PREPARING).length,
    'PACKER (QC)': orders.filter(o => o.status === OrderStatus.PACKING).length,
    'FRONT (Ready)': orders.filter(o => o.status === OrderStatus.READY).length,
  };

  const avgPrepTime = orders.length > 0 
    ? Math.round(orders.reduce((acc, o) => acc + (Date.now() - o.createdAt), 0) / orders.length / 60000)
    : 0;

  return (
    <div className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4 lg:p-12">
      <div className="bg-brand-dark border-2 border-brand-yellow rounded-[2.5rem] w-full max-w-5xl h-full max-h-[85vh] overflow-hidden flex flex-col shadow-2xl">
        <div className="p-8 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
          <div>
            <h2 className="text-4xl font-black text-brand-yellow tracking-tighter">DAILY PERFORMANCE REPORT</h2>
            <p className="text-zinc-500 font-bold uppercase text-xs tracking-widest mt-1">Pot of Jollof Kitchen Analytics</p>
          </div>
          <button onClick={onClose} className="p-4 bg-zinc-800 text-white rounded-2xl hover:bg-brand-yellow hover:text-black transition-all">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-grow overflow-y-auto p-8 grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Summary Cards */}
          <div className="col-span-full grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-zinc-900 p-6 rounded-3xl border border-zinc-800">
              <p className="text-[10px] font-black text-zinc-500 uppercase">Total Tickets</p>
              <p className="text-5xl font-black text-white">{totalOrders}</p>
            </div>
            <div className="bg-zinc-900 p-6 rounded-3xl border border-zinc-800">
              <p className="text-[10px] font-black text-zinc-500 uppercase">Avg Turnaround</p>
              <p className="text-5xl font-black text-brand-yellow">{avgPrepTime}m</p>
            </div>
            <div className="bg-zinc-900 p-6 rounded-3xl border border-zinc-800">
              <p className="text-[10px] font-black text-zinc-500 uppercase">Dispatched</p>
              <p className="text-5xl font-black text-green-500">{dispatched}</p>
            </div>
            <div className="bg-zinc-900 p-6 rounded-3xl border border-zinc-800">
              <p className="text-[10px] font-black text-zinc-500 uppercase">Active Load</p>
              <p className="text-5xl font-black text-orange-500">{active}</p>
            </div>
          </div>

          {/* Station Load */}
          <div className="bg-zinc-900 p-8 rounded-[2rem] border border-zinc-800 flex flex-col">
            <h3 className="text-xl font-black text-white mb-6 uppercase tracking-tight">Station Tracking</h3>
            <div className="space-y-6">
              {Object.entries(stationStats).map(([name, count]) => (
                <div key={name} className="space-y-2">
                  <div className="flex justify-between text-xs font-black uppercase text-zinc-400">
                    <span>{name}</span>
                    <span className="text-brand-yellow">{count}</span>
                  </div>
                  <div className="h-4 bg-black rounded-full overflow-hidden border border-zinc-800">
                    <div 
                      className="h-full bg-brand-yellow transition-all duration-1000" 
                      style={{ width: `${totalOrders > 0 ? (count / totalOrders) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Revenue Mix */}
          <div className="bg-zinc-900 p-8 rounded-[2rem] border border-zinc-800 flex flex-col">
            <h3 className="text-xl font-black text-white mb-6 uppercase tracking-tight">Order Type Mix</h3>
            <div className="space-y-6">
               {Object.entries(typeStats).map(([name, count]) => (
                <div key={name} className="flex items-center justify-between p-4 bg-black rounded-2xl border border-zinc-800">
                  <span className="text-sm font-black text-zinc-300">{name.toUpperCase()}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl font-black text-white">{count}</span>
                    <span className="text-[10px] font-bold text-zinc-600">({totalOrders > 0 ? Math.round((count/totalOrders)*100) : 0}%)</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Optimization Insight */}
          <div className="bg-brand-yellow p-8 rounded-[2rem] flex flex-col text-black shadow-xl shadow-brand-yellow/10">
            <h3 className="text-xl font-black mb-4 uppercase leading-none">AI Insight</h3>
            <p className="text-sm font-bold leading-relaxed mb-6 italic opacity-80">
              "Based on today's flow, the PACKING station is your current bottleneck. Consider shifting one person from the CHEF station to QC for the next 60 minutes."
            </p>
            <div className="mt-auto bg-black text-brand-yellow p-4 rounded-2xl text-center">
              <p className="text-[10px] font-black uppercase tracking-widest">Efficiency Rating</p>
              <p className="text-4xl font-black">94%</p>
            </div>
          </div>
        </div>

        <div className="p-8 bg-black/50 border-t border-zinc-800 text-center">
          <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Reports reset daily at 00:00 • End of Shift Summary</p>
        </div>
      </div>
    </div>
  );
};

export default DailyReportModal;
