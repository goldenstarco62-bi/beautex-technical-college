import React, { useState, useEffect } from 'react';
import { Activity, ChevronRight, Clock, Plus, Sparkles, Zap, Download, UserPlus, BookOpen, Award, GraduationCap, Users, Home, RefreshCw, AlertTriangle, Globe, Mail, Phone, MapPin, ExternalLink } from 'lucide-react';

export default function TabDashboard(ctx) {
    const {
        settings, loading, setActiveTab, searchQuery, counts, statsLoading, statsError, loadCounts,
        openNewDept, handleBackup, displayActivities, filteredModules, systemStatus,
        isSuperAdmin, navigate,
    } = ctx;

    // Live date/time in the dashboard header
    const [now, setNow] = useState(() => new Date());
    useEffect(() => {
        const t = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(t);
    }, []);

    const fmtNum = (v) => (statsLoading ? '…' : v === null || v === undefined ? '—' : v);

    const kpis = [
        { label: 'Total Programs',   count: counts.programs,       icon: GraduationCap, tone: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400',
          go: () => setActiveTab('academic'), manage: 'Manage Programs' },
        { label: 'Total Courses',    count: counts.courses,        icon: BookOpen,      tone: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
          go: () => navigate('/courses'), manage: 'Manage Courses' },
        { label: 'Total Students',   count: counts.students,       icon: Users,         tone: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-400',
          go: () => navigate('/students'), manage: 'Manage Students' },
        { label: 'Total Staff Members', count: counts.staff,       icon: UserPlus,      tone: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
          go: () => navigate('/faculty'), manage: 'Manage Staff' },
        { label: 'Active Student Portals', count: counts.active_portals, icon: Globe,   tone: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400',
          go: () => setActiveTab('portal_customization'), manage: 'Portal Options' },
    ];

    const quickActions = [
        { label: 'Add New Program',      action: () => { setActiveTab('academic'); setTimeout(openNewDept, 200); } },
        { label: 'Add New Course',       action: () => navigate('/courses') },
        { label: 'Create New Intake',    action: () => setActiveTab('academic') },
        ...(isSuperAdmin ? [{ label: 'Add New User', action: () => navigate('/users') }] : []),
        { label: 'Configure Fee Structure', action: () => setActiveTab('finance') },
        { label: 'Send SMS Notification', action: () => navigate('/announcements') },
        { label: 'Backup Now',           action: handleBackup, icon: Download },
    ];

    return (
        <div className="space-y-6 animate-in fade-in duration-300">

            {/* Dashboard Header: breadcrumbs + title + live date/time */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
                <div>
                    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-2">
                        <button onClick={() => navigate('/dashboard')} className="flex items-center gap-1 hover:text-maroon dark:hover:text-gold transition-colors">
                            <Home className="w-3 h-3" /> Home
                        </button>
                        <ChevronRight className="w-3 h-3 text-gold" />
                        <span className="text-zinc-500">Settings</span>
                        <ChevronRight className="w-3 h-3 text-gold" />
                        <span className="text-maroon dark:text-gold">Dashboard</span>
                    </nav>
                    <h1 className="text-xl font-black text-maroon dark:text-gold uppercase tracking-wider leading-none">Settings Dashboard</h1>
                    <p className="text-xs text-zinc-400 font-bold uppercase tracking-wider mt-1.5">Manage all system settings and configurations from one central location</p>
                </div>
                <div className="flex items-center gap-2 self-start md:self-auto bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-white/10 rounded-xl px-4 py-2.5 shadow-sm">
                    <Clock className="w-4 h-4 text-gold shrink-0" />
                    <div className="text-left">
                        <p className="text-[11px] font-black text-zinc-700 dark:text-zinc-200 tabular-nums leading-none">
                            {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </p>
                        <p className="text-[8.5px] font-bold text-zinc-400 uppercase tracking-widest mt-1 leading-none">
                            {now.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>
                    </div>
                </div>
            </div>

            {/* Stats error banner */}
            {statsError && !statsLoading && (
                <div className="flex items-center justify-between gap-3 bg-red-50 dark:bg-red-500/10 border border-red-200/60 dark:border-red-500/20 rounded-2xl px-4 py-3">
                    <p className="text-[10px] font-black text-red-600 dark:text-red-400 uppercase tracking-wider flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" /> Statistics could not be loaded from the server.
                    </p>
                    <button onClick={loadCounts} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-600 text-white text-[9px] font-black uppercase tracking-widest hover:opacity-90 transition-opacity shrink-0">
                        <RefreshCw className="w-3 h-3" /> Retry
                    </button>
                </div>
            )}

            {/* KPI Metrics row — real counts from GET /settings/dashboard-stats */}
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-4">
                {kpis.map((kpi) => {
                    const Icon = kpi.icon;
                    return (
                        <button key={kpi.label} onClick={kpi.go}
                            className="bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-white/5 rounded-2xl p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 hover:border-gold/30 transition-all text-left flex items-center gap-4 group">
                            <div className={`w-11 h-11 rounded-xl ${kpi.tone} flex items-center justify-center shadow-inner shrink-0 group-hover:scale-105 transition-transform`}>
                                <Icon className="w-5 h-5" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-2xl font-black text-zinc-800 dark:text-white leading-none tabular-nums">{fmtNum(kpi.count)}</p>
                                <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider mt-1 truncate">{kpi.label}</p>
                                <span className="text-[7.5px] text-gold font-bold uppercase tracking-widest mt-1 block group-hover:underline">{kpi.manage} →</span>
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* Main split grid */}
            <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">

                {/* Left column: Settings modules grid */}
                <div className="xl:col-span-3 space-y-4 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/50 dark:border-white/5 p-6 shadow-sm">
                    <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-white/5">
                        <div className="flex items-center gap-2">
                            <Sparkles className="w-4.5 h-4.5 text-gold" />
                            <span className="text-xs font-black uppercase tracking-wider text-maroon dark:text-gold">Settings Modules</span>
                        </div>
                        {searchQuery && (
                            <span className="text-[9px] bg-gold/10 text-gold px-2 py-0.5 rounded-full font-bold uppercase tracking-widest">Filtered: {filteredModules.length}</span>
                        )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
                        {filteredModules.map(mod => {
                            const Icon = mod.icon;
                            return (
                                <button key={mod.id} onClick={() => setActiveTab(mod.id)}
                                    className="flex items-start gap-3 p-4 border border-zinc-100 dark:border-white/5 hover:border-gold/30 hover:shadow-md rounded-2xl bg-zinc-50/50 dark:bg-white/[0.02] hover:bg-white transition-all group text-left relative overflow-hidden">
                                    <div className="absolute top-0 left-0 bottom-0 w-1 bg-maroon opacity-0 group-hover:opacity-100 transition-opacity" />
                                    <div className={`w-10 h-10 rounded-xl ${mod.tone || 'bg-maroon/10 text-maroon'} flex items-center justify-center shrink-0 shadow-inner group-hover:scale-105 transition-transform`}>
                                        <Icon className="w-4.5 h-4.5" />
                                    </div>
                                    <div className="min-w-0 flex-1 pr-3 pt-0.5">
                                        <p className="text-[10px] font-black uppercase tracking-wide text-zinc-700 dark:text-zinc-200 group-hover:text-maroon dark:group-hover:text-gold transition-colors leading-none truncate">{mod.title}</p>
                                        <p className="text-[9px] text-zinc-400 font-medium mt-1 leading-normal line-clamp-2">{mod.desc}</p>
                                    </div>
                                    <ChevronRight className="w-3.5 h-3.5 text-gold self-center shrink-0 transform group-hover:translate-x-1 transition-transform" />
                                </button>
                            );
                        })}
                        {filteredModules.length === 0 && (
                            <div className="col-span-full py-8 text-center text-zinc-400 text-xs font-semibold uppercase tracking-wider">
                                No settings modules matched your search queries.
                            </div>
                        )}
                    </div>
                </div>

                {/* Right column: Quick actions, status and activity */}
                <div className="xl:col-span-1 space-y-6">

                    {/* Quick Actions */}
                    <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/50 dark:border-white/5 overflow-hidden shadow-sm">
                        <div className="px-5 py-3.5 flex items-center gap-2 bg-maroon text-white">
                            <Zap className="w-4 h-4 text-yellow-300 shrink-0" />
                            <span className="text-[10px] font-black uppercase tracking-widest leading-none mt-0.5">Quick Actions</span>
                        </div>
                        <div className="p-3.5 space-y-1">
                            {quickActions.map((act) => (
                                <button key={act.label} onClick={act.action}
                                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-maroon/5 hover:text-maroon dark:hover:bg-white/5 dark:hover:text-gold transition-all text-left text-zinc-600 dark:text-zinc-400 group">
                                    <div className="w-5 h-5 rounded-lg flex items-center justify-center shrink-0 bg-gold/10 group-hover:bg-gold transition-colors duration-200">
                                        {act.icon ? <act.icon className="w-3.5 h-3.5 text-gold group-hover:text-white" /> : <Plus className="w-3.5 h-3.5 text-gold group-hover:text-white" />}
                                    </div>
                                    <span className="text-[9px] font-black uppercase tracking-wide leading-none mt-0.5">{act.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* System Status */}
                    <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/50 dark:border-white/5 overflow-hidden shadow-sm">
                        <div className="px-5 py-3.5 flex items-center gap-2 bg-maroon text-white">
                            <Activity className="w-4 h-4 text-gold shrink-0" />
                            <span className="text-[10px] font-black uppercase tracking-widest leading-none mt-0.5">System Status</span>
                        </div>
                        <div className="p-4 space-y-3.5">
                            {[
                                { key: 'database', label: 'Database' },
                                { key: 'sms',      label: 'SMS Gateway' },
                                { key: 'email',    label: 'Email Server' },
                                { key: 'mpesa',    label: 'M-Pesa API' },
                            ].map((statusItem, idx) => {
                                const result = systemStatus ? systemStatus[statusItem.key] : null;
                                const state = systemStatus ? (result?.status || 'unknown') : 'checking';
                                const healthy = state === 'online' || state === 'connected';
                                const tone = healthy
                                    ? 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400'
                                    : state === 'configured'
                                        ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400'
                                        : state === 'not_configured'
                                            ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'
                                            : state === 'checking'
                                                ? 'bg-zinc-100 text-zinc-500 dark:bg-white/5 dark:text-zinc-400'
                                                : 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400';
                                const dot = healthy ? 'bg-green-500 animate-pulse'
                                    : state === 'configured' ? 'bg-blue-500'
                                    : state === 'not_configured' ? 'bg-amber-500'
                                    : state === 'checking' ? 'bg-zinc-400'
                                    : 'bg-red-500';
                                const text = systemStatus
                                    ? (state === 'online' ? 'Online'
                                        : state === 'connected' ? 'Connected'
                                        : state === 'configured' ? 'Saved · Unverified'
                                        : state === 'not_configured' ? 'Not Configured'
                                        : state === 'offline' ? 'Offline'
                                        : state === 'error' ? 'Failed' : 'Unknown')
                                    : 'Checking…';
                                return (
                                    <div key={idx} className="flex justify-between items-center" title={result?.message || ''}>
                                        <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">{statusItem.label}</span>
                                        <span className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${tone}`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
                                            {text}
                                        </span>
                                    </div>
                                );
                            })}
                            <p className="text-[7.5px] text-zinc-400 font-semibold uppercase tracking-wider pt-1 border-t border-zinc-100 dark:border-white/5">Live status from the integration probe · hover a badge for detail</p>
                        </div>
                    </div>

                    {/* Recent Activity */}
                    <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/50 dark:border-white/5 overflow-hidden shadow-sm">
                        <div className="px-5 py-3.5 flex items-center justify-between bg-maroon text-white">
                            <span className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-yellow-300 shrink-0" />
                                <span className="text-[10px] font-black uppercase tracking-widest leading-none mt-0.5">Recent Activity</span>
                            </span>
                            {isSuperAdmin && (
                                <button onClick={() => setActiveTab('audit')} className="flex items-center gap-1 text-[8px] font-black uppercase tracking-widest text-gold hover:underline">
                                    View All <ExternalLink className="w-2.5 h-2.5" />
                                </button>
                            )}
                        </div>
                        <div className="p-4 space-y-3">
                            {displayActivities.map((act, idx) => (
                                <div key={idx} className="flex items-start gap-3 text-left">
                                    <div className={`w-1.5 h-1.5 rounded-full ${act.dot} shrink-0 mt-1`} />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[9.5px] font-bold text-zinc-700 dark:text-zinc-300 leading-snug">{act.text}</p>
                                        <span className="text-[8px] text-zinc-400 font-semibold uppercase block mt-0.5">{act.time}</span>
                                    </div>
                                </div>
                            ))}
                            {displayActivities.length === 0 && (
                                <p className="text-[9px] text-zinc-400 font-semibold uppercase tracking-wider text-center py-2">
                                    {isSuperAdmin ? 'No recent activity recorded.' : 'Activity details are visible to Super Administrators.'}
                                </p>
                            )}
                        </div>
                    </div>

                </div>

            </div>

            {/* Official contact strip + copyright footer */}
            <div className="pt-4 border-t border-zinc-200/40 dark:border-white/5">
                <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[9px] text-zinc-500 dark:text-zinc-400 font-semibold">
                    <span className="flex items-center gap-1.5"><MapPin className="w-3 h-3 text-gold shrink-0" />{settings.college_address || '—'}</span>
                    <span className="flex items-center gap-1.5"><Phone className="w-3 h-3 text-gold shrink-0" />{settings.college_phone || '—'}</span>
                    <span className="flex items-center gap-1.5"><Mail className="w-3 h-3 text-gold shrink-0" />{settings.contact_email || '—'}</span>
                </div>
                <div className="mt-2 flex flex-col sm:flex-row justify-between items-center text-[9px] text-zinc-400 font-semibold uppercase tracking-wider">
                    <span>© 2026 Beautex Technical Training College. All Rights Reserved.</span>
                    <span className="mt-1 sm:mt-0 text-gold">Version {settings.system_version || '—'}</span>
                </div>
            </div>

        </div>
    );
}
