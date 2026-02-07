
import React from 'react';
import { ChefInsight } from '../types';
import { ICONS } from '../constants';

interface ChefInsightsPanelProps {
  insights: ChefInsight[];
  sources: any[];
  loading: boolean;
  onRefresh: () => void;
  error?: string | null;
}

const ChefInsightsPanel: React.FC<ChefInsightsPanelProps> = ({ insights, sources, loading, onRefresh, error }) => {
  return (
    <div className="w-80 border-l border-zinc-800 bg-brand-black flex flex-col hidden lg:flex">
      <div className="p-6 border-b border-zinc-800 flex justify-between items-center">
        <div className="flex items-center gap-2 text-brand-yellow">
          <ICONS.Sparkles />
          <h2 className="text-xl font-bold tracking-tight">Chef AI</h2>
        </div>
        <button 
          onClick={onRefresh}
          disabled={loading}
          className={`p-2 rounded-full hover:bg-zinc-800 transition-colors ${loading ? 'animate-spin' : ''}`}
        >
          <svg className="w-5 h-5 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      <div className="flex-grow p-4 overflow-y-auto space-y-4">
        {error ? (
          <div className="p-4 rounded-xl border-2 border-dashed border-red-500/50 bg-red-500/5 text-center">
            <svg className="w-8 h-8 text-red-500 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-xs font-black text-red-400 uppercase tracking-wider mb-2">Service Paused</p>
            <p className="text-[10px] text-zinc-400 mb-4">{error}</p>
            <button
              onClick={() => (window as any).aistudio.openSelectKey()}
              className="text-[10px] bg-red-600 text-white font-black py-1.5 px-3 rounded uppercase hover:bg-red-700 transition-colors"
            >
              Update API Key
            </button>
          </div>
        ) : loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 bg-zinc-900 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          insights.map((insight, idx) => (
            <div key={idx} className={`p-4 rounded-xl border-l-4 bg-zinc-900/50 ${
              insight.urgency === 'high' ? 'border-red-500' : insight.urgency === 'medium' ? 'border-brand-yellow' : 'border-zinc-700'
            }`}>
              <h4 className="font-bold text-white mb-1">{insight.title}</h4>
              <p className="text-sm text-zinc-400 leading-relaxed">{insight.advice}</p>
            </div>
          ))
        )}

        {!loading && !error && insights.length === 0 && (
          <div className="text-center py-10 opacity-30 italic text-sm">
            No insights yet. Keep cooking!
          </div>
        )}

        {sources.length > 0 && !error && (
          <div className="pt-4 border-t border-zinc-800">
            <p className="text-[10px] text-zinc-500 font-bold uppercase mb-2">Sources</p>
            {sources.map((chunk, i) => chunk.web && (
              <a 
                key={i} 
                href={chunk.web.uri} 
                target="_blank" 
                rel="noopener noreferrer"
                className="block text-[10px] text-brand-yellow hover:underline truncate mb-1"
              >
                {chunk.web.title || chunk.web.uri}
              </a>
            ))}
          </div>
        )}
      </div>

      <div className="p-6 bg-zinc-900/30">
        <div className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest text-center">
          Powered by Gemini 3.0 Pro
        </div>
      </div>
    </div>
  );
};

export default ChefInsightsPanel;
