import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { financeAPI, coursesAPI } from '../services/api';
import {
    DollarSign, Users, CheckCircle2, Clock, AlertCircle, Calendar,
    Filter, Search, RefreshCw, FileDown, Plus, X, Award, ChevronRight,
    TrendingUp, BarChart3, PieChart as PieIcon, ListFilter, CreditCard
} from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import toast from 'react-hot-toast';

const fmt = (n) => Number(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const STATUS_CONFIG = {
    Paid: { style: 'bg-emerald-50 text-emerald-700 border-emerald-100', icon: CheckCircle2 },
    Partial: { style: 'bg-amber-50 text-amber-700 border-amber-100', icon: Clock },
    'Not Paid': { style: 'bg-rose-50 text-rose-700 border-rose-100', icon: AlertCircle },
};

const StatusBadge = ({ status }) => {
    const current = STATUS_CONFIG[status] || STATUS_CONFIG['Not Paid'];
    const Icon = current.icon;
    return (
        <span className={`inline-flex items-center gap-1 text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-wider border ${current.style}`}>
            <Icon className="w-3 h-3" />
            {status}
        </span>
    );
};

export default function MonthlyFeeTracker() {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState('overview');
    const [loading, setLoading] = useState(true);
    const [initializing, setInitializing] = useState(false);

    // Filters
    const now = new Date();
    const [filterYear, setFilterYear] = useState(now.getFullYear());
    const [filterMonth, setFilterMonth] = useState(now.getMonth() + 1);
    const [filterStatus, setFilterStatus] = useState('');
    const [filterDept, setFilterDept] = useState('');
    const [filterCourse, setFilterCourse] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const searchInputRef = useRef(null);
    const searchWrapperRef = useRef(null);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [suggestionIndex, setSuggestionIndex] = useState(-1);
    const [allRecords, setAllRecords] = useState([]); // full unfiltered list for suggestions

    // Data
    const [dashboardStats, setDashboardStats] = useState({
        total_students: 0,
        paid_count: 0,
        unpaid_count: 0,
        partial_count: 0,
        total_due: 0,
        total_paid: 0,
        total_pending: 0
    });
    const [records, setRecords] = useState([]);
    const [courses, setCourses] = useState([]);
    const [departments, setDepartments] = useState([]);

    // Modal State
    const [showPayModal, setShowPayModal] = useState(false);
    const [selectedRecord, setSelectedRecord] = useState(null);
    const [payAmount, setPayAmount] = useState('');
    const [payMethod, setPayMethod] = useState('M-Pesa');
    const [payRef, setPayRef] = useState('');
    const [payRemarks, setPayRemarks] = useState('');
    const [submittingPayment, setSubmittingPayment] = useState(false);

    // Months list
    const months = [
        { val: 1, name: 'January' }, { val: 2, name: 'February' }, { val: 3, name: 'March' },
        { val: 4, name: 'April' }, { val: 5, name: 'May' }, { val: 6, name: 'June' },
        { val: 7, name: 'July' }, { val: 8, name: 'August' }, { val: 9, name: 'September' },
        { val: 10, name: 'October' }, { val: 11, name: 'November' }, { val: 12, name: 'December' }
    ];

    const currentMonthName = months.find(m => m.val === filterMonth)?.name || '';

    // Helper to parse duration to months (matches backend logic)
    const parseDurationToMonths = (durationStr) => {
        if (!durationStr) return 0;
        const cleanStr = String(durationStr).toLowerCase().trim();
        if (/yr|year/.test(cleanStr)) {
            const match = cleanStr.match(/(\d+)/);
            return (match ? parseInt(match[0], 10) : 1) * 12;
        }
        if (/month|mths?|\bmo\b/.test(cleanStr)) {
            const match = cleanStr.match(/(\d+)/);
            return match ? parseInt(match[0], 10) : 1;
        }
        if (/week|wks?/.test(cleanStr)) {
            const match = cleanStr.match(/(\d+)/);
            const weeks = match ? parseInt(match[0], 10) : 1;
            return Math.max(1, Math.round(weeks / 4.33));
        }
        const numericOnly = cleanStr.match(/^(\d+)$/);
        if (numericOnly) {
            return parseInt(cleanStr, 10);
        }
        return 0;
    };

    // Fetch initial setup data
    useEffect(() => {
        const fetchMeta = async () => {
            try {
                const cList = await coursesAPI.getAll();
                const allC = cList.data || cList || [];
                const eligibleCourses = allC.filter(c => parseDurationToMonths(c.duration) >= 4);
                setCourses(eligibleCourses);
                
                // Unique departments from courses
                const depts = [...new Set(eligibleCourses.map(c => c.department).filter(Boolean))];
                setDepartments(depts);
            } catch (err) {
                console.error('Error fetching course metadata:', err);
            }
        };
        fetchMeta();
    }, []);

    // Fetch tracker data based on filters
    const fetchData = async () => {
        setLoading(true);
        try {
            // 1. Fetch dashboard/overview status
            const statsRes = await financeAPI.getMonthlyStatus({
                year: filterYear,
                month: filterMonth,
                status: filterStatus,
                department: filterDept,
                course: filterCourse,
                search: debouncedSearch
            });
            setDashboardStats(statsRes.data || statsRes);

            // 2. Fetch detailed records
            const recordsRes = await financeAPI.getMonthlyTracking({
                year: filterYear,
                month: filterMonth,
                status: filterStatus,
                department: filterDept,
                course: filterCourse,
                search: debouncedSearch
            });
            setRecords(recordsRes.data || recordsRes);
            // Only refresh the suggestions pool when no filters are active
            if (!debouncedSearch && !filterStatus && !filterDept && !filterCourse) {
                setAllRecords(recordsRes.data || recordsRes);
            }
        } catch (err) {
            console.error('Error fetching tracker data:', err);
            toast.error('Failed to load tracking data.');
        } finally {
            setLoading(false);
        }
    };

    // Debounce search — waits 300ms after user stops typing before hitting the API
    useEffect(() => {
        const timer = setTimeout(() => { setDebouncedSearch(searchQuery); setSuggestionIndex(-1); }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    useEffect(() => {
        fetchData();
    }, [filterYear, filterMonth, filterStatus, filterDept, filterCourse, debouncedSearch]);

    // Ctrl+K / Cmd+K shortcut to focus search field
    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                searchInputRef.current?.focus();
                setShowSuggestions(true);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Close dropdown on click outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (searchWrapperRef.current && !searchWrapperRef.current.contains(e.target)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Suggestions from already-loaded records (no extra API call needed)
    const suggestions = searchQuery.trim().length > 0
        ? allRecords.filter(r => {
            const q = searchQuery.toLowerCase();
            return (
                r.student_name?.toLowerCase().includes(q) ||
                r.student_id?.toString().toLowerCase().includes(q)
            );
          }).filter((r, i, arr) => arr.findIndex(x => x.student_name === r.student_name) === i) // unique names
            .slice(0, 8)
        : [];

    const handleSuggestionKeyDown = (e) => {
        if (!showSuggestions || suggestions.length === 0) return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSuggestionIndex(i => Math.min(i + 1, suggestions.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSuggestionIndex(i => Math.max(i - 1, 0));
        } else if (e.key === 'Enter' && suggestionIndex >= 0) {
            e.preventDefault();
            setSearchQuery(suggestions[suggestionIndex].student_name);
            setShowSuggestions(false);
            setSuggestionIndex(-1);
        } else if (e.key === 'Escape') {
            setSearchQuery('');
            setShowSuggestions(false);
        }
    };

    const handleInitialize = async () => {
        setInitializing(true);
        try {
            await financeAPI.initMonthlyRecords({ year: filterYear, month: filterMonth });
            toast.success('Successfully initialized monthly tracking records.');
            fetchData();
        } catch (err) {
            console.error(err);
            toast.error('Failed to initialize monthly records.');
        } finally {
            setInitializing(false);
        }
    };

    const handleOpenPayModal = (record) => {
        setSelectedRecord(record);
        setPayAmount(record.balance || '');
        setPayMethod('M-Pesa');
        setPayRef('');
        setPayRemarks('');
        setShowPayModal(true);
    };

    const handleRecordPayment = async (e) => {
        e.preventDefault();
        if (!payAmount || parseFloat(payAmount) <= 0) {
            toast.error('Please enter a valid amount.');
            return;
        }

        setSubmittingPayment(true);
        try {
            await financeAPI.recordMonthlyPayment({
                student_id: selectedRecord.student_id,
                amount: parseFloat(payAmount),
                method: payMethod,
                transaction_ref: payRef,
                year: selectedRecord.year,
                month: selectedRecord.month,
                remarks: payRemarks
            });
            toast.success('Payment recorded successfully.');
            setShowPayModal(false);
            fetchData();
        } catch (err) {
            console.error(err);
            toast.error('Failed to record payment.');
        } finally {
            setSubmittingPayment(false);
        }
    };

    const handleExport = async (format) => {
        try {
            const fileName = `monthly_fee_report_${filterMonth}_${filterYear}.${format === 'excel' ? 'xlsx' : 'pdf'}`;
            toast.loading(`Generating ${format.toUpperCase()} export...`, { id: 'exporting' });
            
            await financeAPI.exportMonthlyReport({
                year: filterYear,
                month: filterMonth,
                status: filterStatus,
                department: filterDept,
                course: filterCourse,
                format
            }, fileName);

            toast.success('Export completed successfully!', { id: 'exporting' });
        } catch (err) {
            console.error(err);
            toast.error('Failed to export report.', { id: 'exporting' });
        }
    };

    // Recharts setup
    const pieData = [
        { name: 'Paid', value: dashboardStats.paid_count || 0, color: '#10B981' },
        { name: 'Partial', value: dashboardStats.partial_count || 0, color: '#F59E0B' },
        { name: 'Not Paid', value: dashboardStats.unpaid_count || 0, color: '#EF4444' }
    ].filter(d => d.value > 0);

    const barData = [
        { name: 'Total Due', amount: dashboardStats.total_due || 0 },
        { name: 'Total Paid', amount: dashboardStats.total_paid || 0 },
        { name: 'Pending Balance', amount: dashboardStats.total_pending || 0 }
    ];

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <p className="text-[10px] font-black text-maroon/40 uppercase tracking-[0.4em] mb-1">Accounts & Finance</p>
                    <h1 className="text-3xl font-black text-maroon uppercase tracking-tight flex items-center gap-3">
                        <TrendingUp className="w-8 h-8 text-gold" />
                        Monthly Fee Tracker
                    </h1>
                </div>
                <div className="flex gap-3 w-full md:w-auto">
                    <button
                        onClick={handleInitialize}
                        disabled={initializing}
                        className="flex-1 md:flex-none bg-white border border-gray-100 rounded-2xl shadow-sm px-6 py-3.5 text-[9px] font-black uppercase tracking-widest text-maroon flex items-center justify-center gap-2 hover:bg-gray-50 transition-all disabled:opacity-50"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${initializing ? 'animate-spin' : ''}`} />
                        Sync {currentMonthName} Records
                    </button>
                </div>
            </div>

            {/* Controls Filter Bar */}
            <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-xl grid grid-cols-2 md:grid-cols-6 gap-4">
                <div className="flex flex-col gap-1.5 col-span-2 md:col-span-1">
                    <label className="text-[8px] font-black text-gray-400 uppercase tracking-wider">Year</label>
                    <select
                        value={filterYear}
                        onChange={(e) => setFilterYear(parseInt(e.target.value))}
                        className="w-full bg-gray-50 border-none rounded-xl text-xs font-bold py-3 px-4 focus:ring-2 focus:ring-maroon/20 transition-all"
                    >
                        {[filterYear - 1, filterYear, filterYear + 1].map(y => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>
                </div>
                <div className="flex flex-col gap-1.5 col-span-2 md:col-span-1">
                    <label className="text-[8px] font-black text-gray-400 uppercase tracking-wider">Month</label>
                    <select
                        value={filterMonth}
                        onChange={(e) => setFilterMonth(parseInt(e.target.value))}
                        className="w-full bg-gray-50 border-none rounded-xl text-xs font-bold py-3 px-4 focus:ring-2 focus:ring-maroon/20 transition-all"
                    >
                        {months.map(m => (
                            <option key={m.val} value={m.val}>{m.name}</option>
                        ))}
                    </select>
                </div>
                <div className="flex flex-col gap-1.5 col-span-2 md:col-span-1">
                    <label className="text-[8px] font-black text-gray-400 uppercase tracking-wider">Department</label>
                    <select
                        value={filterDept}
                        onChange={(e) => setFilterDept(e.target.value)}
                        className="w-full bg-gray-50 border-none rounded-xl text-xs font-bold py-3 px-4 focus:ring-2 focus:ring-maroon/20 transition-all"
                    >
                        <option value="">All Departments</option>
                        {departments.map(d => (
                            <option key={d} value={d}>{d}</option>
                        ))}
                    </select>
                </div>
                <div className="flex flex-col gap-1.5 col-span-2 md:col-span-1">
                    <label className="text-[8px] font-black text-gray-400 uppercase tracking-wider">Course</label>
                    <select
                        value={filterCourse}
                        onChange={(e) => setFilterCourse(e.target.value)}
                        className="w-full bg-gray-50 border-none rounded-xl text-xs font-bold py-3 px-4 focus:ring-2 focus:ring-maroon/20 transition-all"
                    >
                        <option value="">All Courses</option>
                        {courses.map(c => (
                            <option key={c.id} value={c.name}>{c.name}</option>
                        ))}
                    </select>
                </div>
                <div className="flex flex-col gap-1.5 col-span-2 md:col-span-1">
                    <label className="text-[8px] font-black text-gray-400 uppercase tracking-wider">Payment Status</label>
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="w-full bg-gray-50 border-none rounded-xl text-xs font-bold py-3 px-4 focus:ring-2 focus:ring-maroon/20 transition-all"
                    >
                        <option value="">All Statuses</option>
                        <option value="Paid">Paid</option>
                        <option value="Partial">Partial</option>
                        <option value="Not Paid">Not Paid</option>
                    </select>
                </div>
                <div className="flex flex-col gap-1.5 col-span-2 md:col-span-1">
                    <label className="text-[8px] font-black text-gray-400 uppercase tracking-wider flex items-center justify-between">
                        <span>Search</span>
                        <span className="text-[7px] font-bold text-gray-300 bg-gray-100 px-1.5 py-0.5 rounded-md hidden md:inline">Ctrl+K</span>
                    </label>
                    <div ref={searchWrapperRef} className="relative">
                        <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 transition-colors z-10 ${searchQuery ? 'text-maroon' : 'text-gray-400'}`} />
                        <input
                            ref={searchInputRef}
                            type="text"
                            placeholder="Student ID / Name..."
                            value={searchQuery}
                            onChange={(e) => { setSearchQuery(e.target.value); setShowSuggestions(true); }}
                            onFocus={() => setShowSuggestions(true)}
                            onKeyDown={handleSuggestionKeyDown}
                            className="w-full pl-9 pr-8 py-3 bg-gray-50 border-none rounded-xl text-xs font-bold focus:ring-2 focus:ring-maroon/20 transition-all"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => { setSearchQuery(''); setShowSuggestions(false); searchInputRef.current?.focus(); }}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-700 rounded-full hover:bg-gray-200 transition-all z-10"
                                title="Clear search"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        )}

                        {/* Autocomplete Dropdown */}
                        {showSuggestions && suggestions.length > 0 && (
                            <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-100 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                <div className="px-3 py-2 border-b border-gray-50 flex items-center justify-between">
                                    <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Suggestions</span>
                                    <span className="text-[8px] font-bold text-gray-300">{suggestions.length} match{suggestions.length !== 1 ? 'es' : ''}</span>
                                </div>
                                {suggestions.map((r, idx) => {
                                    const statusCfg = STATUS_CONFIG[r.status] || STATUS_CONFIG['Not Paid'];
                                    return (
                                        <button
                                            key={r.id}
                                            onMouseDown={(e) => {
                                                e.preventDefault();
                                                setSearchQuery(r.student_name);
                                                setShowSuggestions(false);
                                                setSuggestionIndex(-1);
                                            }}
                                            className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors border-b border-gray-50 last:border-0 ${
                                                idx === suggestionIndex ? 'bg-maroon/5' : 'hover:bg-gray-50'
                                            }`}
                                        >
                                            {/* Avatar */}
                                            <div className="w-8 h-8 rounded-xl bg-maroon/10 border border-maroon/10 flex items-center justify-center shrink-0">
                                                <span className="text-[10px] font-black text-maroon/50">{r.student_name?.[0]?.toUpperCase()}</span>
                                            </div>
                                            {/* Info */}
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-black text-gray-800 truncate">
                                                    {r.student_name.split(new RegExp(`(${searchQuery})`, 'gi')).map((part, i) =>
                                                        part.toLowerCase() === searchQuery.toLowerCase()
                                                            ? <span key={i} className="text-maroon bg-gold/20 rounded px-0.5">{part}</span>
                                                            : <span key={i}>{part}</span>
                                                    )}
                                                </p>
                                                <p className="text-[9px] text-gray-400 font-mono mt-0.5 truncate">
                                                    {r.student_id} · {r.student_course}
                                                </p>
                                            </div>
                                            {/* Payment Status badge */}
                                            <span className={`text-[7px] font-black uppercase px-2 py-0.5 rounded-full border shrink-0 ${statusCfg.style}`}>
                                                {r.status}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Active Filters + Result Count Meta Bar */}
            {(debouncedSearch || filterStatus || filterDept || filterCourse) && !loading && (
                <div className="flex items-center gap-3 px-1 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex items-center gap-2 text-[10px] font-bold">
                        <span className="text-gray-400 uppercase tracking-wider">Results:</span>
                        <span className="bg-maroon text-gold px-3 py-1 rounded-full font-black">{records.length}</span>
                        {debouncedSearch && (
                            <span className="text-gray-400">
                                for <span className="text-maroon font-black">"{debouncedSearch}"</span>
                            </span>
                        )}
                    </div>
                    <button
                        onClick={() => { setSearchQuery(''); setFilterStatus(''); setFilterDept(''); setFilterCourse(''); }}
                        className="text-[9px] font-black text-rose-400 hover:text-rose-600 uppercase tracking-wider flex items-center gap-1 transition-colors"
                    >
                        <X className="w-3 h-3" /> Clear All Filters
                    </button>
                </div>
            )}

            {/* Navigation Tabs */}
            <div className="flex gap-2 p-1 bg-gray-100 rounded-2xl w-fit">
                {[
                    { id: 'overview', label: 'Overview & Charts', icon: PieIcon },
                    { id: 'table', label: 'Status Matrix', icon: ListFilter },
                    { id: 'reports', label: 'Reports & Export', icon: FileDown }
                ].map(t => (
                    <button
                        key={t.id}
                        onClick={() => setActiveTab(t.id)}
                        className={`px-5 py-2.5 rounded-xl flex items-center gap-2 text-[9px] font-black uppercase tracking-wider transition-all ${
                            activeTab === t.id ? 'bg-white text-maroon shadow-sm' : 'text-gray-400 hover:text-maroon'
                        }`}
                    >
                        <t.icon className="w-3.5 h-3.5" />
                        {t.label}
                    </button>
                ))}
            </div>

            {/* Tab Contents */}
            {loading ? (
                <div className="py-24 text-center">
                    <RefreshCw className="w-8 h-8 animate-spin text-maroon mx-auto mb-4" />
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Loading Tracker Data...</p>
                </div>
            ) : (
                <>
                    {activeTab === 'overview' && (
                        <div className="space-y-8 animate-in slide-in-from-bottom-3 duration-500">
                            {/* Stats Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-lg relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 opacity-20 rounded-full -mr-12 -mt-12 group-hover:scale-120 transition-all" />
                                    <Users className="w-8 h-8 text-blue-500 mb-4" />
                                    <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Eligible Students</p>
                                    <p className="text-2xl font-black text-gray-800 tracking-tight">{dashboardStats.total_students || 0}</p>
                                    <p className="text-[9px] text-gray-400 font-bold mt-1">Courses ≥ 4 Months</p>
                                </div>
                                <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-lg relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 opacity-20 rounded-full -mr-12 -mt-12 group-hover:scale-120 transition-all" />
                                    <CheckCircle2 className="w-8 h-8 text-emerald-500 mb-4" />
                                    <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Fully Paid This Month</p>
                                    <p className="text-2xl font-black text-emerald-600 tracking-tight">{dashboardStats.paid_count || 0}</p>
                                    <p className="text-[9px] text-gray-400 font-bold mt-1">Cleared monthly dues</p>
                                </div>
                                <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-lg relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 w-24 h-24 bg-rose-50 opacity-20 rounded-full -mr-12 -mt-12 group-hover:scale-120 transition-all" />
                                    <AlertCircle className="w-8 h-8 text-rose-500 mb-4" />
                                    <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Not Paid This Month</p>
                                    <p className="text-2xl font-black text-rose-600 tracking-tight">{dashboardStats.unpaid_count || 0}</p>
                                    <p className="text-[9px] text-gray-400 font-bold mt-1">Outstanding collections</p>
                                </div>
                                <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-lg relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 w-24 h-24 bg-amber-50 opacity-20 rounded-full -mr-12 -mt-12 group-hover:scale-120 transition-all" />
                                    <Clock className="w-8 h-8 text-amber-500 mb-4" />
                                    <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Partially Paid</p>
                                    <p className="text-2xl font-black text-amber-600 tracking-tight">{dashboardStats.partial_count || 0}</p>
                                    <p className="text-[9px] text-gray-400 font-bold mt-1">Incomplete payments</p>
                                </div>
                            </div>

                            {/* Charts Block */}
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                                <div className="lg:col-span-5 bg-white rounded-3xl p-8 border border-gray-100 shadow-lg flex flex-col justify-center items-center">
                                    <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-6">Payment Ratio Distribution</h3>
                                    {pieData.length > 0 ? (
                                        <div className="w-full h-64 relative flex items-center justify-center">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie
                                                        data={pieData}
                                                        cx="50%"
                                                        cy="50%"
                                                        innerRadius={60}
                                                        outerRadius={80}
                                                        paddingAngle={4}
                                                        dataKey="value"
                                                    >
                                                        {pieData.map((entry, index) => (
                                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                                        ))}
                                                    </Pie>
                                                    <Tooltip />
                                                </PieChart>
                                            </ResponsiveContainer>
                                            <div className="absolute text-center flex flex-col items-center">
                                                <span className="text-3xl font-black text-maroon">{dashboardStats.total_students || 0}</span>
                                                <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Total Students</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="h-64 flex items-center justify-center text-center opacity-30">
                                            <div>
                                                <AlertCircle className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                                                <p className="text-[10px] font-black uppercase tracking-widest">No Distribution Data Available</p>
                                            </div>
                                        </div>
                                    )}
                                    <div className="flex gap-6 mt-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 bg-[#10B981] rounded-full" />
                                            <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Paid ({dashboardStats.paid_count})</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 bg-[#F59E0B] rounded-full" />
                                            <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Partial ({dashboardStats.partial_count})</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 bg-[#EF4444] rounded-full" />
                                            <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Not Paid ({dashboardStats.unpaid_count})</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="lg:col-span-7 bg-white rounded-3xl p-8 border border-gray-100 shadow-lg">
                                    <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-6">Financial Allocation (KSh)</h3>
                                    <div className="w-full h-64">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={barData}>
                                                <XAxis dataKey="name" stroke="#9CA3AF" fontSize={10} tickLine={false} />
                                                <YAxis stroke="#9CA3AF" fontSize={10} tickLine={false} />
                                                <Tooltip formatter={(value) => [`KSh ${value.toLocaleString()}`, '']} />
                                                <Bar dataKey="amount" radius={[8, 8, 0, 0]}>
                                                    <Cell fill="#3B82F6" />
                                                    <Cell fill="#10B981" />
                                                    <Cell fill="#EF4444" />
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'table' && (
                        <div className="space-y-6 animate-in slide-in-from-right-3 duration-500">
                            <div className="bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-gray-50 border-b border-gray-100">
                                                <th className="px-6 py-4.5 text-[9px] font-black text-gray-400 uppercase tracking-widest">Student Details</th>
                                                <th className="px-6 py-4.5 text-[9px] font-black text-gray-400 uppercase tracking-widest">Course & Dept</th>
                                                <th className="px-6 py-4.5 text-[9px] font-black text-gray-400 uppercase tracking-widest text-right">Monthly Due</th>
                                                <th className="px-6 py-4.5 text-[9px] font-black text-gray-400 uppercase tracking-widest text-right">Amount Paid</th>
                                                <th className="px-6 py-4.5 text-[9px] font-black text-gray-400 uppercase tracking-widest text-right">Pending Balance</th>
                                                <th className="px-6 py-4.5 text-[9px] font-black text-gray-400 uppercase tracking-widest text-center">Status</th>
                                                <th className="px-6 py-4.5 text-[9px] font-black text-gray-400 uppercase tracking-widest text-center">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {records.length === 0 ? (
                                                <tr>
                                                    <td colSpan="7" className="px-6 py-16 text-center text-gray-400 text-xs font-bold uppercase tracking-widest">
                                                        No records found matching filters.
                                                    </td>
                                                </tr>
                                            ) : (
                                                records.map((rec) => (
                                                    <tr key={rec.id} className="hover:bg-gray-50/50 transition-colors">
                                                        <td className="px-6 py-4.5">
                                                            <div className="flex flex-col">
                                                                <span className="text-xs font-bold text-gray-800">{rec.student_name}</span>
                                                                <span className="text-[10px] text-gray-400 font-mono mt-0.5">{rec.student_id}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4.5">
                                                            <div className="flex flex-col">
                                                                <span className="text-xs text-gray-600">{rec.student_course}</span>
                                                                <span className="text-[10px] text-gray-400 font-bold mt-0.5 uppercase tracking-wider">{rec.student_department} | {rec.student_intake || 'N/A'}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4.5 text-right text-xs font-bold text-gray-800">
                                                            KSh {fmt(rec.amount_due)}
                                                        </td>
                                                        <td className="px-6 py-4.5 text-right text-xs font-bold text-emerald-600">
                                                            KSh {fmt(rec.amount_paid)}
                                                        </td>
                                                        <td className="px-6 py-4.5 text-right text-xs font-bold text-rose-500">
                                                            KSh {fmt(rec.balance)}
                                                        </td>
                                                        <td className="px-6 py-4.5 text-center">
                                                            <StatusBadge status={rec.status} />
                                                        </td>
                                                        <td className="px-6 py-4.5 text-center">
                                                            {rec.status !== 'Paid' ? (
                                                                <button
                                                                    onClick={() => handleOpenPayModal(rec)}
                                                                    className="px-4 py-2 bg-maroon text-gold text-[9px] font-black uppercase tracking-wider rounded-xl shadow hover:bg-maroon/90 transition-all"
                                                                >
                                                                    Record Pay
                                                                </button>
                                                            ) : (
                                                                <span className="text-[9px] font-black uppercase tracking-wider text-emerald-600 bg-emerald-50 border border-emerald-100 px-3 py-1.5 rounded-xl">
                                                                    Cleared
                                                                </span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'reports' && (
                        <div className="space-y-6 animate-in slide-in-from-left-3 duration-500">
                            <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-xl space-y-8">
                                <div>
                                    <h3 className="text-xs font-black text-gray-800 uppercase tracking-widest">Report & Document Generation Hub</h3>
                                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Export structured fee statements to PDF or Excel formats</p>
                                </div>
                                <div className="flex flex-wrap gap-4 pt-4">
                                    <button
                                        onClick={() => handleExport('pdf')}
                                        className="bg-maroon text-gold px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-3 shadow-lg hover:bg-maroon/90 hover:scale-[1.02] transition-all"
                                    >
                                        <FileDown className="w-4 h-4" /> Export Report (PDF)
                                    </button>
                                    <button
                                        onClick={() => handleExport('excel')}
                                        className="bg-emerald-600 text-white px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-3 shadow-lg hover:bg-emerald-700 hover:scale-[1.02] transition-all"
                                    >
                                        <FileDown className="w-4 h-4" /> Export Report (Excel)
                                    </button>
                                </div>
                                <div className="bg-gray-50 border border-gray-100 rounded-2xl p-6 text-gray-500 text-xs">
                                    <h4 className="font-bold text-gray-700 mb-2 uppercase tracking-wide">Applied Filter Summary:</h4>
                                    <ul className="list-disc pl-4 space-y-1">
                                        <li>Period: {currentMonthName} {filterYear}</li>
                                        {filterDept && <li>Department: {filterDept}</li>}
                                        {filterCourse && <li>Course: {filterCourse}</li>}
                                        {filterStatus && <li>Status: {filterStatus}</li>}
                                        {searchQuery && <li>Search: "{searchQuery}"</li>}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* Record Payment Modal */}
            {showPayModal && selectedRecord && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-300">
                    <div className="bg-white rounded-[2rem] border border-gray-100 shadow-2xl w-full max-w-md overflow-hidden relative animate-in zoom-in-95 duration-300">
                        <button
                            onClick={() => setShowPayModal(false)}
                            className="absolute right-6 top-6 p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                        <form onSubmit={handleRecordPayment} className="p-8 space-y-6">
                            <div>
                                <h3 className="text-base font-black text-gray-800 uppercase tracking-tight">Record Monthly Fee</h3>
                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Submit cash/digital receipt payment for this month</p>
                            </div>

                            <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 space-y-2 text-xs">
                                <div className="flex justify-between"><span className="text-gray-400">Student:</span><span className="font-bold text-gray-800">{selectedRecord.student_name}</span></div>
                                <div className="flex justify-between"><span className="text-gray-400">Course:</span><span className="font-bold text-gray-600 text-right max-w-[200px] truncate">{selectedRecord.student_course}</span></div>
                                <div className="flex justify-between"><span className="text-gray-400">Month:</span><span className="font-bold text-maroon">{selectedRecord.month_label}</span></div>
                                <div className="flex justify-between pt-2 border-t border-gray-200 font-bold"><span className="text-gray-600">Pending Balance:</span><span className="text-rose-500">KSh {fmt(selectedRecord.balance)}</span></div>
                            </div>

                            <div className="space-y-4">
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-wider">Amount Paid (KSh)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        required
                                        value={payAmount}
                                        onChange={(e) => setPayAmount(e.target.value)}
                                        className="w-full bg-gray-50 border-none rounded-xl text-sm font-bold py-3 px-4 focus:ring-2 focus:ring-maroon/20 transition-all"
                                    />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-wider">Payment Method</label>
                                    <select
                                        value={payMethod}
                                        onChange={(e) => setPayMethod(e.target.value)}
                                        className="w-full bg-gray-50 border-none rounded-xl text-xs font-bold py-3 px-4 focus:ring-2 focus:ring-maroon/20 transition-all"
                                    >
                                        <option value="M-Pesa">M-Pesa</option>
                                        <option value="Bank">Bank Transfer</option>
                                        <option value="Cash">Cash</option>
                                        <option value="Cheque">Cheque</option>
                                    </select>
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-wider">Transaction Reference</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. QRS12345XYZ"
                                        value={payRef}
                                        onChange={(e) => setPayRef(e.target.value)}
                                        className="w-full bg-gray-50 border-none rounded-xl text-sm font-bold py-3 px-4 focus:ring-2 focus:ring-maroon/20 transition-all"
                                    />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-wider">Remarks / Notes</label>
                                    <textarea
                                        rows="2"
                                        value={payRemarks}
                                        onChange={(e) => setPayRemarks(e.target.value)}
                                        className="w-full bg-gray-50 border-none rounded-xl text-xs font-bold py-3 px-4 focus:ring-2 focus:ring-maroon/20 transition-all"
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={submittingPayment}
                                className="w-full py-4 bg-maroon text-gold text-[10px] font-black uppercase tracking-widest rounded-2xl shadow-lg hover:bg-maroon/90 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                            >
                                <CreditCard className="w-4 h-4" />
                                {submittingPayment ? 'Submitting...' : 'Confirm Payment'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
