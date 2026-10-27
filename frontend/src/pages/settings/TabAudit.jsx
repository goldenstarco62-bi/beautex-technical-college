import React from 'react';
import { Search, RefreshCw, ChevronLeft, ChevronRight, ShieldAlert } from 'lucide-react';

const relTime = (iso) => {
    if (!iso) return '';
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return '';
};

const actionTone = (action) => {
    const a = (action || '').toLowerCase();
    if (a.includes('login') || a.includes('logout')) return 'bg-sky-50 text-sky-700 border-sky-200/50 dark:bg-sky-950/20 dark:text-sky-400';
    if (a.includes('delete') || a.includes('remove') || a.includes('revoke')) return 'bg-red-50 text-red-700 border-red-200/50 dark:bg-red-950/20 dark:text-red-400';
    if (a.includes('create') || a.includes('add') || a.includes('register') || a.includes('issue')) return 'bg-green-50 text-green-700 border-green-200/50 dark:bg-green-950/20 dark:text-green-400';
    if (a.includes('update') || a.includes('edit') || a.includes('approve') || a.includes('publish')) return 'bg-amber-50 text-amber-700 border-amber-200/50 dark:bg-amber-950/20 dark:text-amber-400';
    return 'bg-zinc-100 text-zinc-600 border-zinc-200/50 dark:bg-white/5 dark:text-zinc-300';
};

export default function TabAudit(ctx) {
    const { loadingAudit, auditSearch, setAuditSearch, auditLogs, auditPage, auditPageSize, auditPagination, auditError, changeAuditPage, changeAuditPageSize, fetchAuditLogs } = ctx;
    const { total = 0, totalPages = 1 } = auditPagination || {};
    const from = total === 0 ? 0 : (auditPage - 1) * auditPageSize + 1;
    const to = total === 0 ? 0 : Math.min(auditPage * auditPageSize, total);
    return (
        <div className="space-y-4 animate-in fade-in duration-300">
            <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-100 dark:border-white/5 p-4 shadow-sm flex flex-col md:flex-row md:items-center gap-3">
                <div className="flex flex-1 items-center gap-2 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2.5 focus-within:ring-2 focus-within:ring-maroon/30 focus-within:border-maroon transition-all">
                    <Search className="w-4 h-4 text-gray-400 shrink-0" />
                    <input type="text" value={auditSearch} onChange={e=>setAuditSearch(e.target.value)} placeholder="Search all entries by operator, action, resource, details or IP..." aria-label="Search audit logs" className="w-full bg-transparent text-xs font-semibold outline-none" />
                    {auditSearch && (
                        <button type="button" onClick={()=>setAuditSearch('')} aria-label="Clear search" className="text-[8px] font-black uppercase tracking-widest text-zinc-400 hover:text-maroon dark:hover:text-gold px-1.5 py-0.5 rounded">Clear</button>
                    )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">
                        {loadingAudit ? 'Loading…' : `${total.toLocaleString()} entr${total === 1 ? 'y' : 'ies'}`}
                    </span>
                    <button type="button" onClick={()=>fetchAuditLogs({ page: auditPage })} disabled={loadingAudit}
                        className="flex items-center gap-1.5 text-[8px] font-black uppercase tracking-widest border border-gray-200 dark:border-white/10 hover:border-gold hover:text-maroon dark:hover:text-gold text-zinc-500 dark:text-zinc-300 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-40">
                        <RefreshCw className={`w-2.5 h-2.5 ${loadingAudit ? 'animate-spin' : ''}`} /> Refresh
                    </button>
                </div>
            </div>

            {auditError ? (
                <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-red-200/60 dark:border-red-950/40 p-8 shadow-sm flex flex-col items-center gap-3 text-center">
                    <ShieldAlert className="w-8 h-8 text-red-500" />
                    <p className="text-xs font-black text-zinc-700 dark:text-zinc-200 uppercase tracking-wider">Could not load the audit trail</p>
                    <p className="text-[10px] text-zinc-400 font-semibold max-w-sm">The server did not respond to the audit log request. Check your connection and try again.</p>
                    <button type="button" onClick={()=>fetchAuditLogs({ page: auditPage })}
                        className="mt-1 text-[9px] font-black uppercase tracking-widest text-white bg-maroon hover:opacity-90 px-4 py-2 rounded-xl transition-opacity">Retry</button>
                </div>
            ) : (
            <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs min-w-[880px]">
                        <thead><tr className="bg-gray-50 dark:bg-white/5 border-b border-gray-200/50 dark:border-white/5">
                            {['Date & Time','Operator','Action','Resource','Details','IP Address'].map(h=>(
                                <th key={h} className="px-4 py-3 text-[9px] font-black text-zinc-400 uppercase tracking-widest whitespace-nowrap">{h}</th>
                            ))}
                        </tr></thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                            {loadingAudit && Array.from({length:6}).map((_,i)=>(
                                <tr key={i}>
                                    {Array.from({length:6}).map((__,j)=>(<td key={j} className="px-4 py-3.5"><div className="h-3 rounded bg-gray-100 dark:bg-white/5 animate-pulse" style={{width:`${[35,45,25,30,60,25][j]}%`}} /></td>))}
                                </tr>
                            ))}
                            {!loadingAudit && auditLogs.map((l)=>(
                                <tr key={l.id} className="hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors align-top">
                                    <td className="px-4 py-3 whitespace-nowrap">
                                        <p className="font-bold text-zinc-700 dark:text-zinc-200 text-[11px]">{l.created_at?new Date(l.created_at).toLocaleString():'—'}</p>
                                        {relTime(l.created_at) && <p className="text-[8.5px] font-black uppercase tracking-wider text-zinc-400 mt-0.5">{relTime(l.created_at)}</p>}
                                    </td>
                                    <td className="px-4 py-3 font-semibold text-zinc-600 dark:text-zinc-300 break-all max-w-48">{l.user_email||'system'}</td>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                        <span className={`inline-block text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-full border ${actionTone(l.action)}`}>{l.action||'—'}</span>
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                        <p className="font-bold text-zinc-600 dark:text-zinc-300 text-[10.5px]">{l.resource||'—'}</p>
                                        {l.resource_id!=null && <p className="text-[8.5px] font-mono text-zinc-400 mt-0.5">#{l.resource_id}</p>}
                                    </td>
                                    <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400 font-medium max-w-72">
                                        <p className="truncate" title={l.details||''}>{l.details||'—'}</p>
                                    </td>
                                    <td className="px-4 py-3 font-mono text-zinc-500 whitespace-nowrap">{l.ip_address||'—'}</td>
                                </tr>
                            ))}
                            {!loadingAudit && auditLogs.length===0 && (
                                <tr><td colSpan="6" className="px-4 py-10 text-center">
                                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{auditSearch ? `No entries match "${auditSearch}"` : 'No activity recorded yet.'}</p>
                                    {auditSearch && <button type="button" onClick={()=>setAuditSearch('')} className="mt-2 text-[9px] font-black uppercase tracking-widest text-maroon dark:text-gold hover:underline">Clear search</button>}
                                </td></tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 border-t border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/[0.02]">
                    <label className="flex items-center gap-2 text-[8.5px] font-black uppercase tracking-widest text-zinc-400">
                        Rows
                        <select value={auditPageSize} onChange={e=>changeAuditPageSize(Number(e.target.value))} className="bg-white dark:bg-zinc-800 border border-gray-200 dark:border-white/10 rounded-lg px-2 py-1 text-[10px] font-black text-zinc-600 dark:text-zinc-200 outline-none focus:ring-1 focus:ring-maroon cursor-pointer">
                            {[10,25,50,100].map(n=><option key={n} value={n}>{n}</option>)}
                        </select>
                    </label>
                    <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400 sm:ml-auto">
                        {total===0 ? 'No entries' : `Showing ${from.toLocaleString()}–${to.toLocaleString()} of ${total.toLocaleString()}`}
                    </span>
                    <div className="flex items-center gap-1.5">
                        <button type="button" onClick={()=>changeAuditPage(auditPage-1)} disabled={auditPage<=1||loadingAudit} aria-label="Previous page"
                            className="p-1.5 rounded-lg border border-gray-200 dark:border-white/10 text-zinc-500 hover:border-gold hover:text-maroon dark:hover:text-gold disabled:opacity-30 disabled:pointer-events-none transition-colors bg-white dark:bg-zinc-800">
                            <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-300 px-1 whitespace-nowrap">Page {auditPage} / {Math.max(totalPages,1)}</span>
                        <button type="button" onClick={()=>changeAuditPage(auditPage+1)} disabled={auditPage>=totalPages||loadingAudit} aria-label="Next page"
                            className="p-1.5 rounded-lg border border-gray-200 dark:border-white/10 text-zinc-500 hover:border-gold hover:text-maroon dark:hover:text-gold disabled:opacity-30 disabled:pointer-events-none transition-colors bg-white dark:bg-zinc-800">
                            <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
            </div>
            )}
        </div>
    );
}
