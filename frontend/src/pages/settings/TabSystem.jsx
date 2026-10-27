import React from 'react';
import { Activity, RefreshCw } from 'lucide-react';

export default function TabSystem(ctx) {
    const { settings, systemStatus, integrationStatus, fetchIntegrationOverview, loadingIntegrationOverview } = ctx;
    const services = [
        { key: 'database',        label: 'Database Engine' },
        { key: 'sms',             label: 'SMS Gateway' },
        { key: 'email',           label: 'Email (SMTP) Server' },
        { key: 'mpesa',           label: 'M-Pesa Daraja API' },
        { key: 'google_calendar', label: 'Google Calendar SDK' },
        { key: 'zoom',            label: 'Zoom SDK' },
        { key: 'google_meet',     label: 'Google Meet API' },
    ];
    const resultFor = (key) => integrationStatus?.[key] || systemStatus?.[key] || null;
    const stateFor = (key) => resultFor(key)?.status || (systemStatus ? 'unknown' : 'checking');
    const toneFor = (s) =>
        s === 'online' || s === 'connected' ? 'text-emerald-700 bg-emerald-50 border-emerald-200/50 dark:bg-emerald-950/20 dark:text-emerald-400'
            : s === 'configured' ? 'text-blue-700 bg-blue-50 border-blue-200/50 dark:bg-blue-950/20 dark:text-blue-400'
                : s === 'not_configured' ? 'text-amber-700 bg-amber-50 border-amber-200/50 dark:bg-amber-950/20 dark:text-amber-400'
                    : s === 'checking' ? 'text-zinc-500 bg-zinc-100 border-zinc-200/50 dark:bg-white/5 dark:text-zinc-400'
                        : 'text-red-700 bg-red-50 border-red-200/50 dark:bg-red-950/20 dark:text-red-400';
    const labelFor = (s) =>
        s === 'online' ? 'Online' : s === 'connected' ? 'Connected'
            : s === 'configured' ? 'Saved · Unverified' : s === 'not_configured' ? 'Not Configured'
                : s === 'offline' ? 'Offline' : s === 'error' ? 'Failed'
                    : s === 'checking' ? 'Checking…' : 'Unknown';
    const probed = services.map(s => stateFor(s.key));
    const failing = probed.filter(s => s === 'offline' || s === 'error').length;
    const notConfigured = probed.filter(s => s === 'not_configured').length;
    const allLoaded = !systemStatus;
    const banner = allLoaded
        ? { text: 'Checking system services…', tone: 'bg-zinc-100 dark:bg-white/5 text-zinc-500 border-zinc-200/50 dark:border-white/5', dot: 'bg-zinc-400' }
        : failing > 0
            ? { text: `${failing} service${failing > 1 ? 's' : ''} reporting failures`, tone: 'bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 border-red-200/50', dot: 'bg-red-500 animate-pulse' }
            : notConfigured === services.length - 1 && probed[0] !== 'online'
                ? { text: 'Database offline', tone: 'bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 border-red-200/50', dot: 'bg-red-500 animate-pulse' }
                : notConfigured > 0
                    ? { text: `Core systems online · ${notConfigured} optional service${notConfigured > 1 ? 's' : ''} not configured`, tone: 'bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border-amber-200/50', dot: 'bg-amber-500 animate-pulse' }
                    : { text: 'All monitored services operational', tone: 'bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400 border-green-200/50', dot: 'bg-green-500 animate-pulse' };
    return (
        <div className="space-y-5 animate-in fade-in duration-300">
            <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${banner.tone}`}>
                <div className={`w-2 h-2 rounded-full ${banner.dot}`} />
                <span className="text-[10px] font-black uppercase tracking-widest">{banner.text}</span>
                <span className="ml-auto flex items-center gap-2">
                    <span className="text-[9px] font-bold uppercase tracking-widest opacity-70">v{settings.system_version || '—'}</span>
                    {fetchIntegrationOverview && (
                        <button type="button" onClick={fetchIntegrationOverview} disabled={loadingIntegrationOverview}
                            title="Re-probe all services"
                            className="flex items-center gap-1 text-[8px] font-black uppercase tracking-widest border border-dashed border-current rounded-lg px-2 py-1 opacity-80 hover:opacity-100 transition-opacity disabled:opacity-40">
                            <RefreshCw className={`w-2.5 h-2.5 ${loadingIntegrationOverview ? 'animate-spin' : ''}`} /> Re-check
                        </button>
                    )}
                </span>
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-100 dark:border-white/5 p-6 shadow-sm text-left">
                <div className="flex items-center gap-2 border-b border-gray-100 dark:border-white/5 pb-2 mb-4">
                    <Activity className="w-4 h-4 text-maroon dark:text-gold" />
                    <h4 className="text-xs font-black uppercase tracking-widest text-maroon dark:text-gold">Service Health Readings</h4>
                </div>
                <div className="space-y-2">
                    {services.map(s => {
                        const state = stateFor(s.key);
                        const result = resultFor(s.key);
                        return (
                            <div key={s.key} className="flex items-center justify-between gap-4 py-2 px-3 rounded-xl bg-gray-50/60 dark:bg-white/[0.02] border border-gray-100 dark:border-white/5">
                                <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-300">{s.label}</span>
                                <div className="min-w-0 flex items-center gap-3 justify-end">
                                    {result?.message && <span className="hidden md:block text-[8.5px] font-mono text-zinc-400 truncate max-w-72" title={result.message}>{result.message}</span>}
                                    <span className={`shrink-0 text-[8px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border ${toneFor(state)}`}>{labelFor(state)}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
                <p className="text-[8.5px] text-zinc-400 font-semibold mt-4 leading-relaxed">
                    Readings come from live probes run by the server against the configured credentials — a service is only shown as connected when it actually answered.
                </p>
            </div>
        </div>
    );
}
