import React, { useState } from 'react';
import { supabase } from '../supabaseClient';

interface OnboardingScreenProps {
    onComplete: (tenantId: string, tenantName: string) => void;
}

const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ onComplete }) => {
    const [mode, setMode] = useState<'WELCOME' | 'LOGIN' | 'SIGNUP'>('WELCOME');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Login State
    const [slug, setSlug] = useState('');

    // Signup State
    const [restaurantName, setRestaurantName] = useState('');
    const [adminName, setAdminName] = useState('');
    const [adminPin, setAdminPin] = useState('');

    const handleLogin = async () => {
        if (!slug) return;
        setLoading(true);
        setError('');

        try {
            if (!supabase) throw new Error("Database connection failed");

            const { data, error } = await supabase
                .from('tenants')
                .select('id, name')
                .eq('slug', slug.toLowerCase().trim())
                .single();

            if (error || !data) {
                setError('Restaurant not found. Please check the code.');
            } else {
                onComplete(data.id, data.name);
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSignup = async () => {
        if (!restaurantName || !adminName || !adminPin) {
            setError('Please fill in all fields.');
            return;
        }
        if (adminPin.length !== 4) {
            setError('PIN must be 4 digits.');
            return;
        }

        setLoading(true);
        setError('');

        try {
            if (!supabase) throw new Error("Database connection failed");

            const generatedSlug = restaurantName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
            const uniqueSlug = `${generatedSlug}-${Math.floor(Math.random() * 1000)}`;

            // 1. Create Tenant
            const { data: tenantData, error: tenantError } = await supabase
                .from('tenants')
                .insert({
                    name: restaurantName,
                    slug: uniqueSlug,
                    settings: { shift_start: 8, shift_end: 22 }
                })
                .select()
                .single();

            if (tenantError) throw tenantError;

            // 2. Create Admin Staff
            const { error: staffError } = await supabase
                .from('staff')
                .insert({
                    tenant_id: tenantData.id,
                    name: adminName,
                    role: 'ADMIN',
                    pin: adminPin
                });

            if (staffError) throw staffError;

            // 3. Create Default Menu
            const defaultMenu = [
                { tenant_id: tenantData.id, name: 'Burger', category: 'Main', estimated_prep_time: 15 },
                { tenant_id: tenantData.id, name: 'Fries', category: 'Side', estimated_prep_time: 5 },
                { tenant_id: tenantData.id, name: 'Soda', category: 'Drink', estimated_prep_time: 2 },
            ];
            await supabase.from('menu_items').insert(defaultMenu);

            onComplete(tenantData.id, tenantData.name);

        } catch (err: any) {
            console.error(err);
            setError('Failed to create restaurant. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    if (mode === 'WELCOME') {
        return (
            <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-center text-white">
                <div className="max-w-4xl w-full animate-in fade-in zoom-in duration-500">
                    <div className="bg-brand-yellow w-24 h-24 rounded-3xl flex items-center justify-center mx-auto mb-10 rotate-12 shadow-2xl shadow-brand-yellow/20">
                        <span className="text-black font-black text-5xl">M24</span>
                    </div>
                    <h1 className="text-6xl font-black mb-6 tracking-tighter">MANI24 KDS</h1>
                    <p className="text-zinc-500 font-bold uppercase tracking-widest text-lg mb-16">The Operating System for Modern Kitchens</p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-2xl mx-auto">
                        <button onClick={() => setMode('LOGIN')} className="group p-8 rounded-[2.5rem] bg-zinc-900 border-2 border-zinc-800 hover:border-brand-yellow hover:-translate-y-2 transition-all">
                            <div className="w-16 h-16 bg-zinc-800 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:bg-brand-yellow group-hover:text-black transition-colors">
                                <svg className="w-8 h-8 flex text-zinc-500 group-hover:text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" /></svg>
                            </div>
                            <h3 className="text-2xl font-black mb-2 text-white">LOGIN</h3>
                            <p className="text-zinc-500 text-sm font-medium">Enter your restaurant code</p>
                        </button>

                        <button onClick={() => setMode('SIGNUP')} className="group p-8 rounded-[2.5rem] bg-zinc-900 border-2 border-zinc-800 hover:border-brand-yellow hover:-translate-y-2 transition-all">
                            <div className="w-16 h-16 bg-zinc-800 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:bg-brand-yellow group-hover:text-black transition-colors">
                                <svg className="w-8 h-8 flex text-zinc-500 group-hover:text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                            </div>
                            <h3 className="text-2xl font-black mb-2 text-white">NEW RESTAURANT</h3>
                            <p className="text-zinc-500 text-sm font-medium">Create a new workspace</p>
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-center text-white">
            <button onClick={() => setMode('WELCOME')} className="absolute top-8 left-8 text-zinc-500 hover:text-white font-bold uppercase text-xs flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                Back
            </button>

            <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 p-10 rounded-[2.5rem] shadow-2xl animate-in fade-in slide-in-from-bottom-8 duration-500">
                <h2 className="text-3xl font-black mb-2 tracking-tighter uppercase text-white">{mode === 'LOGIN' ? 'Restaurant Login' : 'Create Workspace'}</h2>
                <p className="text-zinc-500 text-sm font-bold uppercase tracking-widest mb-8">{mode === 'LOGIN' ? 'Enter your unique store code' : 'Setup your kitchen in seconds'}</p>

                <div className="space-y-4 text-left">
                    {mode === 'LOGIN' ? (
                        <div>
                            <label className="text-[10px] font-black uppercase text-zinc-500 ml-4 mb-2 block">Store Code (Slug)</label>
                            <input
                                autoFocus
                                value={slug}
                                onChange={e => setSlug(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                                placeholder="e.g. pot-of-jollof"
                                className="w-full bg-black border border-zinc-800 p-4 rounded-2xl font-bold text-white focus:outline-none focus:border-brand-yellow transition-all placeholder:text-zinc-700"
                            />
                        </div>
                    ) : (
                        <>
                            <div>
                                <label className="text-[10px] font-black uppercase text-zinc-500 ml-4 mb-2 block">Restaurant Name</label>
                                <input
                                    autoFocus
                                    value={restaurantName}
                                    onChange={e => setRestaurantName(e.target.value)}
                                    placeholder="e.g. Mama Oliech's"
                                    className="w-full bg-black border border-zinc-800 p-4 rounded-2xl font-bold text-white focus:outline-none focus:border-brand-yellow transition-all placeholder:text-zinc-700"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase text-zinc-500 ml-4 mb-2 block">Admin Name</label>
                                <input
                                    value={adminName}
                                    onChange={e => setAdminName(e.target.value)}
                                    placeholder="John Doe"
                                    className="w-full bg-black border border-zinc-800 p-4 rounded-2xl font-bold text-white focus:outline-none focus:border-brand-yellow transition-all placeholder:text-zinc-700"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase text-zinc-500 ml-4 mb-2 block">Admin PIN</label>
                                <input
                                    type="password"
                                    maxLength={4}
                                    value={adminPin}
                                    onChange={e => setAdminPin(e.target.value)}
                                    placeholder="••••"
                                    className="w-full bg-black border border-zinc-800 p-4 rounded-2xl font-bold text-white focus:outline-none focus:border-brand-yellow transition-all text-center tracking-widest placeholder:text-zinc-700"
                                />
                            </div>
                        </>
                    )}

                    {error && (
                        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-500 text-xs font-bold text-center">
                            {error}
                        </div>
                    )}

                    <button
                        onClick={mode === 'LOGIN' ? handleLogin : handleSignup}
                        disabled={loading}
                        className="w-full py-5 bg-brand-yellow text-black font-black rounded-2xl uppercase text-sm shadow-lg shadow-brand-yellow/20 hover:scale-[1.02] active:scale-95 transition-all mt-4 disabled:opacity-50 disabled:cursor-wait"
                    >
                        {loading ? 'Processing...' : (mode === 'LOGIN' ? 'Enter Kitchen' : 'Complete Setup')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default OnboardingScreen;
