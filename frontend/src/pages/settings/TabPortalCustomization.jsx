import React from 'react';
import { ShieldAlert, Sparkles } from 'lucide-react';
import { FieldRow, Inp, StatusBadge, TA, Toggle } from './atoms';

export default function TabPortalCustomization(ctx) {
    const { settings, set } = ctx;
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in duration-300">
            <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-100 dark:border-white/5 p-6 space-y-6 shadow-sm">
                <div>
                    <h4 className="text-xs font-black uppercase tracking-widest text-maroon dark:text-gold border-b border-gray-100 dark:border-white/5 pb-2">Student Portal Configurations</h4>
                    <p className="text-[9px] text-zinc-400 font-semibold mt-1">Configure announcement banners, contact details and maintenance toggles.</p>
                </div>
                <FieldRow label="Announcement Banner Message" description="Crucial banner message displayed at the top of student dashboards."><TA value={settings.portal_announcement_banner} onChange={e=>set('portal_announcement_banner',e.target.value)} rows={3} /></FieldRow>
                <FieldRow label="Portal Support Email"><Inp value={settings.portal_support_email} onChange={e=>set('portal_support_email',e.target.value)} /></FieldRow>
                <FieldRow label="Portal Support Phone"><Inp value={settings.portal_support_phone} onChange={e=>set('portal_support_phone',e.target.value)} /></FieldRow>
                <FieldRow label="Maintenance Mode Switch" description="Force log out all students and display a system-under-maintenance screen.">
                    <div className="flex items-center gap-3"><Toggle value={settings.portal_maintenance_mode} onChange={v=>set('portal_maintenance_mode',v)} /><StatusBadge active={settings.portal_maintenance_mode} labelOn="Active" labelOff="Inactive" /></div>
                </FieldRow>
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-100 dark:border-white/5 p-6 shadow-sm flex flex-col justify-between">
                <div>
                    <h4 className="text-xs font-black uppercase tracking-widest text-maroon dark:text-gold border-b border-gray-100 dark:border-white/5 pb-2">Student Portal Preview Simulator</h4>
                    <p className="text-[9px] text-zinc-400 font-semibold mt-1">A real-time mockup view of the portal dashboard.</p>
                </div>

                <div className="flex-1 mt-6 border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden flex flex-col shadow-inner bg-zinc-50 dark:bg-zinc-950 p-4 justify-center relative">
                    {settings.portal_maintenance_mode ? (
                        <div className="flex flex-col items-center justify-center text-center p-6 space-y-3">
                            <ShieldAlert className="w-10 h-10 text-red-500 animate-bounce" />
                            <p className="text-xs font-black uppercase tracking-wider text-red-500">System Maintenance Mode Active</p>
                            <p className="text-[9px] text-zinc-400 font-semibold leading-relaxed">The Student Portal is temporarily down for maintenance. Admitted students cannot log in or check results at this time.</p>
                        </div>
                    ) : (
                        <div className="space-y-4 text-left">
                            {settings.portal_announcement_banner && (
                                <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200/50 dark:border-amber-500/20 px-3.5 py-2.5 rounded-xl flex items-start gap-2 animate-pulse">
                                    <Sparkles className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                                    <p className="text-[9.5px] font-bold text-amber-800 dark:text-amber-400 leading-normal">{settings.portal_announcement_banner}</p>
                                </div>
                            )}
                            <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 border border-gray-100 dark:border-white/5 shadow-sm space-y-2">
                                <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full bg-gold/25 border border-gold flex items-center justify-center text-[10px] font-black text-maroon dark:text-gold uppercase">JD</div>
                                    <div>
                                        <p className="text-[9px] font-black text-zinc-700 dark:text-zinc-200 uppercase leading-none">John Doe</p>
                                        <span className="text-[7.5px] text-zinc-400 font-semibold">Adm No: BTC/2026/042</span>
                                    </div>
                                </div>
                                <div className="h-0.5 bg-gray-100 dark:bg-white/5 my-2" />
                                <div className="grid grid-cols-2 gap-2 text-[8px] font-black uppercase text-zinc-400 tracking-wider">
                                    <div className="p-2 bg-gray-50 dark:bg-zinc-800 rounded-lg flex flex-col justify-between"><span>Grade Record</span><span className="text-maroon dark:text-gold text-[10px] mt-1">GPA 3.82</span></div>
                                    <div className="p-2 bg-gray-50 dark:bg-zinc-800 rounded-lg flex flex-col justify-between"><span>Fees Balance</span><span className="text-maroon dark:text-gold text-[10px] mt-1">KES 0.00</span></div>
                                </div>
                            </div>
                            
                            <div className="flex justify-between items-center text-[8px] text-zinc-400 font-bold uppercase tracking-wider px-1">
                                <span>Support Helpline: {settings.portal_support_phone || 'None'}</span>
                                <span>{settings.portal_support_email || 'None'}</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
