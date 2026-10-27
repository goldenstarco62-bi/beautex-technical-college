import React from 'react';
import { CheckCircle, Eye } from 'lucide-react';
import { FieldRow, GOLD, Inp } from './atoms';

export default function TabBrandingThemes(ctx) {
    const { settings, set } = ctx;
        const MAROON_PALETTE = [
            { name: 'Royal Maroon',    hex: '#800000' },
            { name: 'Deep Crimson',    hex: '#6B0000' },
            { name: 'Dark Maroon',     hex: '#5a0000' },
            { name: 'Warm Burgundy',   hex: '#722F37' },
            { name: 'Classic Wine',    hex: '#7B2D8B' },
            { name: 'Heritage Red',    hex: '#8B1A1A' },
            { name: 'Scarlet Deep',    hex: '#9B1B30' },
            { name: 'Oxblood',         hex: '#4A0010' },
        ];
        const GOLD_PALETTE = [
            { name: 'Classic Gold',    hex: '#c8a94a' },
            { name: 'Bright Gold',     hex: '#FFD700' },
            { name: 'Antique Gold',    hex: '#B8860B' },
            { name: 'Rich Gold',       hex: '#DAA520' },
            { name: 'Warm Amber',      hex: '#FFBF00' },
            { name: 'Deep Saffron',    hex: '#E8A000' },
            { name: 'Burnished Gold',  hex: '#A0790A' },
            { name: 'Pale Gold',       hex: '#EDD26A' },
        ];
        const DARK_PALETTE = [
            { name: 'Midnight',        hex: '#0b0b0c' },
            { name: 'Charcoal',        hex: '#1a1a2e' },
            { name: 'Navy',            hex: '#0d1b2a' },
            { name: 'Forest',          hex: '#0d2818' },
            { name: 'Graphite',        hex: '#2d2d2d' },
            { name: 'Slate',           hex: '#1e293b' },
            { name: 'Deep Purple',     hex: '#2d1b69' },
            { name: 'Ocean',           hex: '#0a3d62' },
        ];
        const SwatchGroup = ({ title, palette, settingKey }) => (
            <div className="space-y-3">
                <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">{title}</p>
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                    {palette.map(sw => {
                        const isActive = settings[settingKey]?.toLowerCase() === sw.hex.toLowerCase();
                        return (
                            <button
                                key={sw.hex}
                                title={sw.name}
                                onClick={() => set(settingKey, sw.hex)}
                                className="group flex flex-col items-center gap-1.5"
                            >
                                <div
                                    className={`w-full aspect-square rounded-xl shadow-md transition-all duration-200 group-hover:scale-110 group-hover:shadow-lg border-2 ${isActive ? 'border-white scale-110 shadow-xl ring-2 ring-offset-2' : 'border-transparent'}`}
                                    style={{ backgroundColor: sw.hex, ringColor: sw.hex }}
                                >
                                    {isActive && (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <CheckCircle className="w-4 h-4 text-white drop-shadow" />
                                        </div>
                                    )}
                                </div>
                                <span className="text-[7px] font-bold text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-200 text-center leading-tight line-clamp-2 px-0.5 transition-colors">{sw.name}</span>
                            </button>
                        );
                    })}
                </div>
            </div>
        );
        return (
            <div className="space-y-8 animate-in fade-in duration-300">
                {/* Live Preview Card */}
                <div className="rounded-2xl border border-gray-200 dark:border-white/10 overflow-hidden shadow-lg">
                    <div className="px-4 py-2.5 border-b border-gray-100 dark:border-white/10 bg-gray-50 dark:bg-zinc-900 flex items-center justify-between">
                        <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 flex items-center gap-1.5"><Eye className="w-3 h-3" /> Live Preview</p>
                        <span className="text-[8px] font-bold text-zinc-400">Changes apply on Save</span>
                    </div>
                    <div className="flex h-32 bg-white dark:bg-zinc-950">
                        {/* Mini sidebar preview */}
                        <div className="w-20 flex flex-col items-start px-2 py-2 gap-1 shrink-0" style={{ backgroundColor: settings.sidebar_colors || '#7a0000' }}>
                            <div className="w-full h-3 rounded bg-white/30 mb-1" />
                            {[1,2,3,4].map(i => (
                                <div key={i} className={`w-full h-2.5 rounded flex items-center gap-1 px-1 ${i===1?'bg-white/25':''}`}>
                                    <div className="w-1.5 h-1.5 rounded-sm bg-white/40 shrink-0" />
                                    <div className="flex-1 h-1 bg-white/20 rounded-sm" />
                                </div>
                            ))}
                        </div>
                        {/* Mini header + content preview */}
                        <div className="flex-1 flex flex-col">
                            <div className="h-7 flex items-center px-3 gap-2 shrink-0" style={{ backgroundColor: settings.portal_theme_colors || '#800000' }}>
                                <div className="w-12 h-2 bg-white/50 rounded-sm" />
                                <div className="flex-1" />
                                <div className="w-2 h-2 bg-white/50 rounded-full" />
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: GOLD }} />
                            </div>
                            <div className="flex-1 p-2 space-y-1 bg-gray-50 dark:bg-zinc-900">
                                <div className="flex gap-1">
                                    <div className="h-6 rounded-lg flex-1" style={{ backgroundColor: (settings.portal_theme_colors || '#800000') + '15', border: `1px solid ${settings.portal_theme_colors || '#800000'}30` }} />
                                    <div className="h-6 rounded-lg flex-1 bg-gray-100 dark:bg-zinc-800" />
                                    <div className="h-6 rounded-lg flex-1 bg-gray-100 dark:bg-zinc-800" />
                                </div>
                                <div className="h-2 bg-gray-200 dark:bg-zinc-800 rounded-sm w-3/4" />
                                <div className="h-2 bg-gray-100 dark:bg-zinc-700 rounded-sm w-1/2" />
                            </div>
                        </div>
                    </div>
                    <div className="px-4 py-3 bg-gray-50/50 dark:bg-zinc-900/60 border-t border-gray-100 dark:border-white/5 flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <div className="w-5 h-5 rounded-md border border-white/20 shadow" style={{ backgroundColor: settings.portal_theme_colors || '#800000' }} />
                            <div>
                                <p className="text-[8px] font-black text-zinc-400 uppercase tracking-wider">Primary / Header</p>
                                <p className="text-[9px] font-mono font-bold text-zinc-700 dark:text-zinc-200">{settings.portal_theme_colors || '#800000'}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-5 h-5 rounded-md border border-white/20 shadow" style={{ backgroundColor: settings.sidebar_colors || '#7a0000' }} />
                            <div>
                                <p className="text-[8px] font-black text-zinc-400 uppercase tracking-wider">Sidebar / Accent</p>
                                <p className="text-[9px] font-mono font-bold text-zinc-700 dark:text-zinc-200">{settings.sidebar_colors || '#7a0000'}</p>
                            </div>
                        </div>
                        <button onClick={() => { set('portal_theme_colors','#800000'); set('sidebar_colors','#7a0000'); }}
                            className="ml-auto text-[8px] font-black text-zinc-400 hover:text-maroon dark:hover:text-gold transition-colors uppercase tracking-widest border border-dashed border-zinc-200 dark:border-white/10 px-2 py-1 rounded-lg hover:border-maroon dark:hover:border-gold">
                            ↺ Reset to BTTC Default
                        </button>
                    </div>
                </div>

                {/* PRIMARY / HEADER COLOR */}
                <div className="p-5 bg-white dark:bg-zinc-900 border border-gray-100 dark:border-white/5 rounded-2xl shadow-sm space-y-5">
                    <div className="flex items-center justify-between">
                        <div>
                            <h4 className="text-xs font-black uppercase tracking-wider text-zinc-700 dark:text-zinc-200">Primary / Header Color</h4>
                            <p className="text-[9px] text-zinc-400 font-semibold mt-0.5">Used for the top navigation bar and primary action buttons</p>
                        </div>
                        <div className="flex items-center gap-2 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2">
                            <div className="w-6 h-6 rounded-lg shadow border border-white/20" style={{backgroundColor:settings.portal_theme_colors || '#800000'}} />
                            <input type="color" value={settings.portal_theme_colors || '#800000'} onChange={e=>set('portal_theme_colors',e.target.value)} className="w-7 h-7 rounded-lg cursor-pointer bg-transparent border-0 p-0" title="Pick custom color" />
                            <span className="text-[10px] font-mono font-black text-gray-500 dark:text-zinc-300">{settings.portal_theme_colors || '#800000'}</span>
                        </div>
                    </div>
                    <SwatchGroup title="🔴 Maroon Shades" palette={MAROON_PALETTE} settingKey="portal_theme_colors" />
                    <SwatchGroup title="⚫ Dark Tones" palette={DARK_PALETTE} settingKey="portal_theme_colors" />
                </div>

                {/* SIDEBAR COLOR */}
                <div className="p-5 bg-white dark:bg-zinc-900 border border-gray-100 dark:border-white/5 rounded-2xl shadow-sm space-y-5">
                    <div className="flex items-center justify-between">
                        <div>
                            <h4 className="text-xs font-black uppercase tracking-wider text-zinc-700 dark:text-zinc-200">Sidebar / Accent Color</h4>
                            <p className="text-[9px] text-zinc-400 font-semibold mt-0.5">Used for the left navigation sidebar and accent elements</p>
                        </div>
                        <div className="flex items-center gap-2 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2">
                            <div className="w-6 h-6 rounded-lg shadow border border-white/20" style={{backgroundColor:settings.sidebar_colors || '#7a0000'}} />
                            <input type="color" value={settings.sidebar_colors || '#7a0000'} onChange={e=>set('sidebar_colors',e.target.value)} className="w-7 h-7 rounded-lg cursor-pointer bg-transparent border-0 p-0" title="Pick custom color" />
                            <span className="text-[10px] font-mono font-black text-gray-500 dark:text-zinc-300">{settings.sidebar_colors || '#7a0000'}</span>
                        </div>
                    </div>
                    <SwatchGroup title="🔴 Maroon Shades" palette={MAROON_PALETTE} settingKey="sidebar_colors" />
                    <SwatchGroup title="🏆 Gold & Amber" palette={GOLD_PALETTE} settingKey="sidebar_colors" />
                    <SwatchGroup title="⚫ Dark Tones" palette={DARK_PALETTE} settingKey="sidebar_colors" />
                </div>

                {/* QUICK THEME PRESETS */}
                <div className="p-5 bg-white dark:bg-zinc-900 border border-gray-100 dark:border-white/5 rounded-2xl shadow-sm space-y-4">
                    <div>
                        <h4 className="text-xs font-black uppercase tracking-wider text-zinc-700 dark:text-zinc-200">Quick Theme Presets</h4>
                        <p className="text-[9px] text-zinc-400 font-semibold mt-0.5">One-click apply coordinated color combinations</p>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {[
                            { name: 'BTTC Classic',    primary: '#800000', sidebar: '#7a0000', gold: GOLD },
                            { name: 'Deep Maroon',     primary: '#6B0000', sidebar: '#5a0000', gold: '#DAA520' },
                            { name: 'Burgundy & Gold', primary: '#722F37', sidebar: '#6a2030', gold: '#FFD700' },
                            { name: 'Heritage',        primary: '#8B1A1A', sidebar: '#7a0000', gold: '#B8860B' },
                            { name: 'Midnight Blue',   primary: '#0d1b2a', sidebar: '#1a1a2e', gold: GOLD },
                            { name: 'Forest Green',    primary: '#0d2818', sidebar: '#0a1f12', gold: '#DAA520' },
                            { name: 'Graphite',        primary: '#2d2d2d', sidebar: '#1a1a1a', gold: GOLD },
                            { name: 'Oxblood Elite',   primary: '#4A0010', sidebar: '#3a000c', gold: '#E8A000' },
                        ].map(preset => (
                            <button key={preset.name}
                                onClick={() => { set('portal_theme_colors', preset.primary); set('sidebar_colors', preset.sidebar); }}
                                className="group p-3 rounded-xl border border-gray-100 dark:border-white/5 hover:border-gold hover:shadow-md transition-all text-left space-y-2 bg-gray-50/50 dark:bg-zinc-800 hover:bg-white dark:hover:bg-zinc-700">
                                <div className="flex gap-1.5 h-6 rounded-lg overflow-hidden">
                                    <div className="flex-1 h-full" style={{ backgroundColor: preset.primary }} />
                                    <div className="flex-1 h-full" style={{ backgroundColor: preset.sidebar }} />
                                    <div className="w-4 h-full" style={{ backgroundColor: preset.gold }} />
                                </div>
                                <p className="text-[9px] font-black text-zinc-600 dark:text-zinc-300 uppercase tracking-wide group-hover:text-maroon dark:group-hover:text-gold transition-colors">{preset.name}</p>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Login Banner URL */}
                <div className="p-5 bg-white dark:bg-zinc-900 border border-gray-100 dark:border-white/5 rounded-2xl shadow-sm">
                    <FieldRow label="Login Banner URL" description="Custom image URL displayed on the login page background">
                        <Inp value={settings.login_banner_url} onChange={e=>set('login_banner_url',e.target.value)} placeholder="https://example.com/banner.jpg" />
                    </FieldRow>
                </div>
            </div>
        );
}
