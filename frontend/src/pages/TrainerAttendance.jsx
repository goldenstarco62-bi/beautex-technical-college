import { useCallback, useEffect, useMemo, useState } from 'react';
import { attendanceAPI, academicAPI, trainerAttendanceAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';
import {
    Calendar, CheckCircle2, Clock, XCircle, Thermometer, ShieldCheck,
    AlertTriangle, UserCheck, Users, Save, CalendarRange,
} from 'lucide-react';

const todayISO = () => new Date().toISOString().slice(0, 10);

const STATUS_META = {
    Present: { icon: CheckCircle2, active: 'bg-green-600 text-white border-green-600', idle: 'hover:bg-green-600 hover:text-white hover:border-green-600', badge: 'bg-green-100 text-green-700' },
    Late: { icon: Clock, active: 'bg-amber-500 text-white border-amber-500', idle: 'hover:bg-amber-500 hover:text-white hover:border-amber-500', badge: 'bg-amber-100 text-amber-700' },
    Absent: { icon: XCircle, active: 'bg-red-600 text-white border-red-600', idle: 'hover:bg-red-600 hover:text-white hover:border-red-600', badge: 'bg-red-50 text-red-600' },
    Sick: { icon: Thermometer, active: 'bg-sky-600 text-white border-sky-600', idle: 'hover:bg-sky-600 hover:text-white hover:border-sky-600', badge: 'bg-sky-100 text-sky-700' },
    Excused: { icon: ShieldCheck, active: 'bg-violet-600 text-white border-violet-600', idle: 'hover:bg-violet-600 hover:text-white hover:border-violet-600', badge: 'bg-violet-100 text-violet-700' },
};

const badgeFor = (status) => STATUS_META[status]?.badge || 'bg-gray-100 text-gray-400';

export default function TrainerAttendance() {
    const { user } = useAuth();
    const role = String(user?.role || '').toLowerCase().trim();
    const isAdmin = ['admin', 'superadmin'].includes(role);

    const [statuses, setStatuses] = useState(['Present', 'Absent', 'Late', 'Sick', 'Excused']);
    const [threshold, setThreshold] = useState(90);
    const [periods, setPeriods] = useState([]);
    const [selectedPeriod, setSelectedPeriod] = useState('');
    const [rosterDate, setRosterDate] = useState(todayISO());
    const [entries, setEntries] = useState([]);
    const [summary, setSummary] = useState({ range: {}, threshold: 90, trainers: [] });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [checkingIn, setCheckingIn] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        (async () => {
            const [configRes, periodsRes] = await Promise.all([
                attendanceAPI.getConfig().catch(() => ({ data: null })),
                academicAPI.getPeriods().catch(() => ({ data: [] })),
            ]);
            const config = configRes.data;
            if (Array.isArray(config?.statuses) && config.statuses.length) setStatuses(config.statuses);
            if (Number.isFinite(Number(config?.threshold))) setThreshold(Number(config.threshold));
            const list = Array.isArray(periodsRes.data) ? periodsRes.data : [];
            setPeriods(list);
            const active = config?.active_period || list.find(p => p.is_active);
            if (active) setSelectedPeriod(String(active.id));
        })();
    }, []);

    const fetchRoster = useCallback(async () => {
        try {
            const res = await trainerAttendanceAPI.getRoster({ date: rosterDate });
            setEntries(Array.isArray(res.data?.entries) ? res.data.entries : []);
            setError('');
        } catch (err) {
            setEntries([]);
            setError(err.response?.data?.error || 'Failed to load the trainer register.');
        }
    }, [rosterDate]);

    const fetchSummary = useCallback(async () => {
        try {
            const params = selectedPeriod
                ? { academic_period_id: selectedPeriod }
                : { month: rosterDate.slice(0, 7) };
            const res = await trainerAttendanceAPI.getSummary(params);
            setSummary(res.data || { range: {}, threshold, trainers: [] });
        } catch (err) {
            console.error('Trainer summary error:', err);
        }
    }, [selectedPeriod, rosterDate, threshold]);

    useEffect(() => {
        let active = true;
        (async () => {
            setLoading(true);
            await Promise.all([fetchRoster(), fetchSummary()]);
            if (active) setLoading(false);
        })();
        return () => { active = false; };
    }, [fetchRoster, fetchSummary]);

    const selfEntry = !isAdmin ? entries[0] : null;

    const rosterStats = useMemo(() => {
        const counts = { marked: 0, pending: 0, total: entries.length };
        statuses.forEach(s => { counts[s] = 0; });
        for (const entry of entries) {
            if (statuses.includes(entry.status)) counts[entry.status] += 1;
            else counts.pending += 1;
        }
        counts.marked = entries.length - counts.pending;
        return counts;
    }, [entries, statuses]);

    const setEntryStatus = (facultyId, status) => {
        setEntries(prev => prev.map(entry =>
            String(entry.faculty_id) === String(facultyId) ? { ...entry, status } : entry
        ));
    };

    const handleCheckIn = async (status) => {
        if (checkingIn) return;
        setCheckingIn(true);
        const loadingToast = toast.loading(`Checking in as ${status}...`);
        try {
            await trainerAttendanceAPI.mark({ date: todayISO(), status });
            toast.success(`Checked in as ${status}`, { id: loadingToast });
            await Promise.all([fetchRoster(), fetchSummary()]);
        } catch (err) {
            toast.error(err.response?.data?.error || 'Check-in failed', { id: loadingToast });
        } finally {
            setCheckingIn(false);
        }
    };

    const saveRegister = async () => {
        const payload = entries
            .filter(entry => statuses.includes(entry.status))
            .map(entry => ({ faculty_id: entry.faculty_id, status: entry.status }));
        if (payload.length === 0) {
            toast.error('Mark at least one trainer before saving.');
            return;
        }
        setSaving(true);
        const loadingToast = toast.loading(`Saving ${payload.length} trainer record(s)...`);
        try {
            const res = await trainerAttendanceAPI.markBatch({ date: rosterDate, entries: payload });
            const skipped = res.data?.skipped?.length || 0;
            toast.success(
                skipped ? `${res.data.saved} saved · ${skipped} skipped` : `${res.data?.saved ?? payload.length} trainer record(s) saved`,
                { id: loadingToast }
            );
            await Promise.all([fetchRoster(), fetchSummary()]);
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to save the trainer register', { id: loadingToast });
        } finally {
            setSaving(false);
        }
    };

    const summaryWindow = summary.period?.name
        || (summary.range?.from && summary.range?.to ? `${summary.range.from} → ${summary.range.to}` : 'All recorded time');

    const renderStatusButtons = (current, onPick) => (
        <div className="flex flex-wrap gap-1.5 sm:gap-2">
            {statuses.map(status => {
                const meta = STATUS_META[status];
                const Icon = meta?.icon || CheckCircle2;
                const isActive = current === status;
                return (
                    <button
                        key={status}
                        type="button"
                        title={`Mark ${status}`}
                        onClick={() => onPick(status)}
                        className={`p-2 sm:p-2.5 rounded-xl transition-all border text-[9px] font-black flex items-center gap-1 ${
                            isActive
                                ? (meta?.active || 'bg-gray-700 text-white border-gray-700')
                                : `bg-gray-50 text-gray-500 border-gray-100 ${meta?.idle || ''}`
                        }`}
                    >
                        <Icon className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">{status}</span>
                    </button>
                );
            })}
        </div>
    );

    if (loading) {
        return (
            <div className="p-8 text-center font-black uppercase tracking-widest text-maroon">
                Loading Trainer Register...
            </div>
        );
    }

    return (
        <div className="space-y-6 sm:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 sm:gap-6 bg-white p-4 sm:p-8 rounded-2xl sm:rounded-[2.5rem] border border-gray-100 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-maroon/[0.02] rounded-full translate-x-1/2 -translate-y-1/2 blur-2xl" />
                <div>
                    <h1 className="text-xl sm:text-3xl font-black text-gray-800 uppercase tracking-tighter">
                        Trainer Attendance
                    </h1>
                    <p className="text-xs sm:text-sm text-gray-400 font-medium">
                        {isAdmin ? 'Staff register • daily check-in oversight' : 'Your daily trainer check-in'}
                    </p>
                </div>
                <div className="flex items-center gap-2 bg-maroon/5 border border-maroon/10 text-maroon px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest">
                    <UserCheck className="w-4 h-4" />
                    Eligibility {threshold}%
                </div>
            </div>

            {error && (
                <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-[1.5rem] text-xs font-bold">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    {error}
                </div>
            )}

            {!isAdmin && (
                <div className="bg-white p-4 sm:p-8 rounded-2xl sm:rounded-[2.5rem] border border-gray-100 shadow-xl space-y-4">
                    <div className="flex items-center gap-3 sm:gap-4">
                        <div className="w-9 h-9 sm:w-10 sm:h-10 bg-maroon/5 rounded-xl flex items-center justify-center text-maroon shrink-0">
                            <UserCheck className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-xs sm:text-sm font-black text-gray-800 uppercase tracking-tight">Today's Check-In</h2>
                            <p className="text-[9px] sm:text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                                {rosterDate} · Present or Late
                            </p>
                        </div>
                    </div>

                    {selfEntry ? (
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-2">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-maroon/5 rounded-xl flex items-center justify-center text-maroon font-black uppercase shrink-0">
                                    {(selfEntry.trainer_name || '?').charAt(0)}
                                </div>
                                <div>
                                    <p className="text-xs font-black text-gray-800 uppercase tracking-tight">{selfEntry.trainer_name}</p>
                                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                                        {selfEntry.department || 'Trainer'}
                                    </p>
                                </div>
                                <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${badgeFor(selfEntry.status)}`}>
                                    {selfEntry.status || 'Not checked in'}
                                </span>
                            </div>
                            <div className="flex gap-2">
                                {['Present', 'Late'].map(status => {
                                    const meta = STATUS_META[status];
                                    const Icon = meta.icon;
                                    const isActive = selfEntry.status === status;
                                    return (
                                        <button
                                            key={status}
                                            type="button"
                                            onClick={() => handleCheckIn(status)}
                                            disabled={checkingIn}
                                            className={`flex-1 md:flex-none px-4 py-3 rounded-xl border text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all disabled:opacity-50 ${
                                                isActive
                                                    ? meta.active
                                                    : `bg-gray-50 text-gray-500 border-gray-100 ${meta.idle}`
                                            }`}
                                        >
                                            <Icon className="w-4 h-4" />
                                            {status === 'Present' ? 'Check In' : 'Late Arrival'}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ) : (
                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                            Loading your trainer profile...
                        </p>
                    )}

                    <p className="text-[9px] font-bold text-gray-400 italic pt-2 border-t border-gray-50">
                        Self check-in supports Present or Late only. Ask administration to record Sick, Excused or Absent days.
                    </p>
                </div>
            )}

            {isAdmin && (
                <div className="bg-white p-4 sm:p-8 rounded-2xl sm:rounded-[2.5rem] border border-gray-100 shadow-xl space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6">
                        <div className="space-y-2">
                            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                <Calendar className="w-3 h-3" /> Register Date
                            </label>
                            <input
                                type="date"
                                value={rosterDate}
                                onChange={(e) => setRosterDate(e.target.value)}
                                className="w-full px-4 py-3 sm:px-5 sm:py-3.5 bg-gray-50 border-transparent rounded-xl text-xs font-bold text-gray-700 focus:bg-white focus:border-maroon/20 outline-none"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                <CalendarRange className="w-3 h-3" /> Summary Term
                            </label>
                            <select
                                value={selectedPeriod}
                                onChange={(e) => setSelectedPeriod(e.target.value)}
                                className="w-full px-4 py-3 sm:px-5 sm:py-3.5 bg-gray-50 border-transparent rounded-xl text-xs font-bold text-gray-700 focus:bg-white focus:border-maroon/20 outline-none cursor-pointer"
                            >
                                <option value="">Current month</option>
                                {periods.map(p => (
                                    <option key={p.id} value={p.id}>{p.name}{p.is_active ? ' • Active' : ''}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex items-end gap-2 md:col-span-2 xl:col-span-2">
                            <button
                                type="button"
                                onClick={() => setEntries(prev => prev.map(e => ({ ...e, status: 'Present' })))}
                                disabled={entries.length === 0}
                                className="flex-1 h-[42px] sm:h-[47px] bg-green-50 text-green-600 rounded-xl font-black text-[9px] sm:text-[10px] uppercase tracking-widest hover:bg-green-600 hover:text-white transition-all flex items-center justify-center gap-2 border border-green-100 disabled:opacity-50"
                            >
                                <CheckCircle2 className="w-4 h-4" /> All Present
                            </button>
                            <button
                                type="button"
                                onClick={() => setEntries(prev => prev.map(e => ({ ...e, status: 'Absent' })))}
                                disabled={entries.length === 0}
                                className="flex-1 h-[42px] sm:h-[47px] bg-red-50 text-red-500 rounded-xl font-black text-[9px] sm:text-[10px] uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all flex items-center justify-center gap-2 border border-red-100 disabled:opacity-50"
                            >
                                <XCircle className="w-4 h-4" /> All Absent
                            </button>
                        </div>
                    </div>

                    {entries.length > 0 && (
                        <div className="pt-4 sm:pt-5 border-t border-gray-50">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1 sm:gap-0 mb-2">
                                <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">
                                    Register Progress — {rosterStats.marked}/{rosterStats.total} Marked
                                </span>
                                <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-[9px] font-black">
                                    {statuses.map(status => (
                                        <span key={status} className="text-gray-500">{rosterStats[status] || 0} {status}</span>
                                    ))}
                                    {rosterStats.pending > 0 && <span className="text-gray-400">⋯ {rosterStats.pending} Pending</span>}
                                </div>
                            </div>
                            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden flex">
                                {statuses.map(status => {
                                    const meta = STATUS_META[status];
                                    const color = meta?.active?.split(' ')[0] || 'bg-gray-400';
                                    return (
                                        <div
                                            key={status}
                                            className={`h-full ${color} transition-all duration-500`}
                                            style={{ width: `${rosterStats.total > 0 ? ((rosterStats[status] || 0) / rosterStats.total) * 100 : 0}%` }}
                                        />
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {isAdmin && (
                <div className="bg-white rounded-2xl sm:rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-4 sm:px-8 sm:py-5 border-b border-gray-50">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-maroon/5 rounded-xl flex items-center justify-center text-maroon shrink-0">
                                <Users className="w-4 h-4" />
                            </div>
                            <div>
                                <h2 className="text-xs font-black text-gray-800 uppercase tracking-tight">Daily Trainer Register</h2>
                                <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">{rosterDate}</p>
                            </div>
                        </div>
                        <button
                            onClick={saveRegister}
                            disabled={saving || rosterStats.marked === 0}
                            className="px-5 py-3 bg-maroon text-gold rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-elite-maroon transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Register'}
                        </button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-gray-50/50 border-b border-gray-100">
                                    {['#', 'Trainer', 'Department', 'Status', 'Registry Actions'].map(header => (
                                        <th key={header} className="px-4 py-3.5 sm:px-8 sm:py-5 text-left text-[9px] sm:text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">{header}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {entries.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-4 py-14 text-center">
                                            <div className="flex flex-col items-center gap-3 opacity-40">
                                                <UserCheck className="w-12 h-12 text-gray-300" />
                                                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400">No active trainers found</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : entries.map((entry, idx) => (
                                    <tr key={entry.faculty_id || idx} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-4 py-3.5 sm:px-8 sm:py-5 text-[10px] font-black text-gray-300">{idx + 1}</td>
                                        <td className="px-4 py-3.5 sm:px-8 sm:py-5">
                                            <div className="flex items-center gap-2.5 sm:gap-3">
                                                <div className="w-8 h-8 sm:w-9 sm:h-9 bg-maroon/5 rounded-xl flex items-center justify-center text-maroon font-black text-xs uppercase shrink-0">
                                                    {(entry.trainer_name || '?').charAt(0)}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-xs font-black text-gray-800 uppercase tracking-tight whitespace-nowrap">{entry.trainer_name}</p>
                                                    <p className="text-[9px] font-bold text-gray-400 lowercase truncate">{entry.trainer_email}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3.5 sm:px-8 sm:py-5 text-[10px] font-bold text-gray-500 uppercase tracking-widest whitespace-nowrap">
                                            {entry.department || '—'}
                                        </td>
                                        <td className="px-4 py-3.5 sm:px-8 sm:py-5 whitespace-nowrap">
                                            <span className={`px-3 py-1 sm:px-4 sm:py-1.5 text-[8px] sm:text-[9px] font-black rounded-lg uppercase tracking-widest ${badgeFor(entry.status)}`}>
                                                {entry.status || 'Pending'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3.5 sm:px-8 sm:py-5">
                                            {renderStatusButtons(entry.status, (status) => setEntryStatus(entry.faculty_id, status))}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <div className="bg-white rounded-2xl sm:rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-4 sm:px-8 sm:py-5 border-b border-gray-50">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-maroon/5 rounded-xl flex items-center justify-center text-maroon shrink-0">
                            <CalendarRange className="w-4 h-4" />
                        </div>
                        <div>
                            <h2 className="text-xs font-black text-gray-800 uppercase tracking-tight">Attendance Summary</h2>
                            <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">{summaryWindow}</p>
                        </div>
                    </div>
                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">
                        {summary.trainers?.length || 0} trainer{(summary.trainers?.length || 0) === 1 ? '' : 's'} tracked
                    </span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-gray-50/50 border-b border-gray-100">
                                {['Trainer', 'Department', 'Present', 'Late', 'Excused', 'Sick', 'Absent', 'Attendance'].map(header => (
                                    <th key={header} className="px-4 py-3.5 sm:px-6 sm:py-5 text-left text-[9px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">{header}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {(summary.trainers || []).length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-4 py-14 text-center">
                                        <div className="flex flex-col items-center gap-3 opacity-40">
                                            <CalendarRange className="w-12 h-12 text-gray-300" />
                                            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400">No trainer records in this window</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : summary.trainers.map((trainer) => (
                                <tr key={trainer.trainer_email || trainer.trainer_name} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="px-4 py-3.5 sm:px-6 sm:py-5 text-xs font-black text-gray-800 uppercase tracking-tight whitespace-nowrap">{trainer.trainer_name}</td>
                                    <td className="px-4 py-3.5 sm:px-6 sm:py-5 text-[10px] font-bold text-gray-500 uppercase tracking-widest whitespace-nowrap">{trainer.department || '—'}</td>
                                    <td className="px-4 py-3.5 sm:px-6 sm:py-5 text-[10px] font-black text-green-600">{trainer.present}</td>
                                    <td className="px-4 py-3.5 sm:px-6 sm:py-5 text-[10px] font-black text-amber-500">{trainer.late}</td>
                                    <td className="px-4 py-3.5 sm:px-6 sm:py-5 text-[10px] font-black text-violet-600">{trainer.excused}</td>
                                    <td className="px-4 py-3.5 sm:px-6 sm:py-5 text-[10px] font-black text-sky-600">{trainer.sick}</td>
                                    <td className="px-4 py-3.5 sm:px-6 sm:py-5 text-[10px] font-black text-rose-500">{trainer.absent}</td>
                                    <td className="px-4 py-3.5 sm:px-6 sm:py-5 whitespace-nowrap">
                                        <div className="flex items-center gap-2">
                                            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black ${trainer.below_threshold ? 'bg-red-50 text-red-600' : 'bg-green-100 text-green-700'}`}>
                                                {trainer.percentage}%
                                            </span>
                                            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{trainer.band}</span>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
