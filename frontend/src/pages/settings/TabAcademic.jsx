import React from 'react';
import { Edit3, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { FieldRow, GOLD, Sel, StatusBadge, Toggle } from './atoms';

export default function TabAcademic(ctx) {
    const { settings, set, departments, loadingDepts, handleDeptDelete, openNewDept, openEditDept } = ctx;
    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-100 dark:border-white/5 p-6 shadow-sm">
                <div className="flex justify-between items-center mb-5 pb-3 border-b border-gray-100 dark:border-white/5">
                    <div>
                        <h4 className="text-xs font-black uppercase tracking-widest text-maroon dark:text-gold">College Departments Registry</h4>
                        <p className="text-[9px] text-zinc-400 font-semibold mt-0.5">Manage administrative and academic departments within the college.</p>
                    </div>
                    <button onClick={openNewDept} className="text-white text-[9px] font-black uppercase tracking-widest px-4 py-2.5 rounded-xl flex items-center gap-1.5 transition-all hover:opacity-90 shadow-md"
                        style={{ backgroundColor: settings.sidebar_colors || '#7a0000', border: `1px solid ${GOLD}30` }}>
                        <Plus className="w-3.5 h-3.5 text-yellow-300" /> Add Department
                    </button>
                </div>
                {loadingDepts ? (
                    <div className="flex flex-col items-center justify-center py-10 space-y-2">
                        <RefreshCw className="w-6 h-6 text-maroon animate-spin" />
                        <span className="text-xs text-zinc-400 font-semibold">Loading departments...</span>
                    </div>
                ) : (
                    <div className="overflow-hidden border border-gray-100 dark:border-white/5 rounded-2xl">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="bg-gray-50 dark:bg-white/[0.02] border-b border-gray-100 dark:border-white/5">
                                    <th className="px-4 py-3 text-[9px] font-black text-gray-400 uppercase tracking-widest text-left">Department Name</th>
                                    <th className="px-4 py-3 text-[9px] font-black text-gray-400 uppercase tracking-widest text-left">Head of Department (HOD)</th>
                                    <th className="px-4 py-3 text-[9px] font-black text-gray-400 uppercase tracking-widest text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                                {departments.map(d => (
                                    <tr key={d.id} className="hover:bg-maroon/[0.02] dark:hover:bg-white/[0.01] transition-colors">
                                        <td className="px-4 py-3.5 font-bold text-zinc-700 dark:text-zinc-200">{d.name}</td>
                                        <td className="px-4 py-3.5 text-zinc-400 font-semibold">{d.head_of_department || 'Unassigned'}</td>
                                        <td className="px-4 py-3.5 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button onClick={() => openEditDept(d)} className="p-2 rounded-xl bg-white dark:bg-zinc-800 border border-gray-200 dark:border-white/5 hover:border-gold hover:text-maroon dark:hover:text-gold transition-all shadow-sm"><Edit3 className="w-3.5 h-3.5" /></button>
                                                <button onClick={() => handleDeptDelete(d.id)} className="p-2 rounded-xl bg-white dark:bg-zinc-800 border border-gray-200 dark:border-white/5 hover:bg-red-50 dark:hover:bg-red-950/20 hover:text-red-600 transition-all shadow-sm"><Trash2 className="w-3.5 h-3.5" /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {departments.length === 0 && (
                                    <tr>
                                        <td colSpan="3" className="py-8 text-center text-zinc-400 text-xs font-semibold uppercase tracking-wider">No departments registered.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-100 dark:border-white/5 p-6 space-y-4 shadow-sm">
                <div>
                    <h4 className="text-xs font-black uppercase tracking-widest text-maroon dark:text-gold border-b border-gray-100 dark:border-white/5 pb-2">Academic Intake Management</h4>
                    <p className="text-[9px] text-zinc-400 font-semibold mt-1">Configure status toggles and enrollment capacities for college admissions.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                        { id:'jan', label:'January Intake', bg: 'from-blue-500/5 to-cyan-500/5', text: 'text-blue-500' },
                        { id:'may', label:'May Intake', bg: 'from-amber-500/5 to-orange-500/5', text: 'text-amber-500' },
                        { id:'sept', label:'September Intake', bg: 'from-purple-500/5 to-pink-500/5', text: 'text-purple-500' },
                        { id:'rolling', label:'Rolling Intake', bg: 'from-emerald-500/5 to-teal-500/5', text: 'text-emerald-500' }
                    ].map(i => (
                        <div key={i.id} className={`p-5 bg-gradient-to-br ${i.bg} rounded-3xl border border-gray-200/50 dark:border-white/5 flex flex-col justify-between gap-4`}>
                            <span className="text-[11px] font-black uppercase tracking-wider text-zinc-800 dark:text-gold block">{i.label}</span>
                            <div className="space-y-2">
                                <label className="text-[8px] font-black text-zinc-400 uppercase tracking-wider block">Intake Status</label>
                                <Sel value={settings[`intake_${i.id}_status`]} onChange={e=>set(`intake_${i.id}_status`,e.target.value)}>
                                    <option value="open">Open (Admitting)</option>
                                    <option value="closed">Closed</option>
                                    <option value="suspended">Suspended</option>
                                </Sel>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[8px] font-black text-zinc-400 uppercase tracking-wider block">Max Capacity</label>
                                <input type="number" value={settings[`intake_${i.id}_capacity`] || ''} onChange={e=>set(`intake_${i.id}_capacity`,e.target.value)} className="w-full bg-white dark:bg-zinc-800 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-center outline-none focus:ring-1 focus:ring-maroon" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-100 dark:border-white/5 p-6 shadow-sm">
                <FieldRow label="Online Applications Portal" description="Enable/Disable self-enrollment registrations from the public website interface.">
                    <div className="flex items-center gap-3"><Toggle value={settings.intake_online_app_enabled} onChange={v=>set('intake_online_app_enabled',v)} /><StatusBadge active={settings.intake_online_app_enabled} labelOn="Active" labelOff="Suspended" /></div>
                </FieldRow>
            </div>
        </div>
    );
}
