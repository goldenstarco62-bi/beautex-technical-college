import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { financeAPI, studentsAPI } from '../services/api';
import {
    CreditCard, TrendingUp, AlertCircle, DollarSign, Plus, X,
    FileDown, Printer, Eye, CheckCircle2, Clock, BarChart3,
    ArrowUpRight, ShieldCheck, Banknote, Users, Activity,
    ChevronRight, Receipt, Wallet, PiggyBank, AlertTriangle, Settings, Trash2, Pencil, RefreshCcw
} from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const EMPTY_PAYMENT = {
    student_id: '',
    amount: '',
    method: 'M-Pesa',
    transaction_ref: '',
    category: 'Tuition Fee',
    semester: '',
    academic_year: new Date().getFullYear().toString(),
    remarks: '',
    phone: ''
};

const fmt = (n) => Number(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const StatusBadge = ({ status }) => {
    const config = {
        Paid: { style: 'bg-emerald-50 text-emerald-700 border-emerald-100', icon: CheckCircle2 },
        Partial: { style: 'bg-amber-50 text-amber-700 border-amber-100', icon: Clock },
        Pending: { style: 'bg-red-50 text-red-600 border-red-100', icon: AlertCircle },
        Overdue: { style: 'bg-rose-50 text-rose-700 border-rose-100', icon: AlertCircle },
    };
    const current = config[status] || config.Pending;
    const Icon = current.icon;

    return (
        <span className={`inline-flex items-center gap-1.5 text-[8px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest border transition-all ${current.style}`}>
            <Icon className="w-3 h-3" />
            {status || 'Unpaid'}
        </span>
    );
};

// ─── STUDENT VIEW ────────────────────────────────────────────────────────────
function StudentFinanceView({ studentFee, payments }) {
    const totalDue = studentFee?.total_due || 0;
    const totalPaid = studentFee?.total_paid || 0;
    const balance = studentFee?.balance ?? (totalDue - totalPaid);
    const progress = totalDue > 0 ? Math.min((totalPaid / totalDue) * 100, 100) : 0;
    const status = studentFee?.status || 'Pending';

    // Group payments by category for breakdown
    const categoryTotals = payments.reduce((acc, p) => {
        const cat = p.category || 'Tuition Fee';
        acc[cat] = (acc[cat] || 0) + (p.amount || 0);
        return acc;
    }, {});

    const handlePrint = () => window.print();

    // Radial Progress Calculation
    const radius = 70;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (progress / 100) * circumference;

    return (
        <div className="space-y-10 animate-in fade-in duration-700">
            {/* Page Title & Quick Action */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <p className="text-[10px] font-black text-maroon/40 uppercase tracking-[0.4em] mb-2">Accounts Management</p>
                    <h1 className="text-3xl sm:text-4xl font-black text-maroon uppercase tracking-tight flex items-center gap-3">
                        <Wallet className="w-8 h-8 text-gold" />
                        Finance Hub
                    </h1>
                </div>
                <div className="flex gap-3 w-full md:w-auto">
                    <button
                        onClick={handlePrint}
                        className="flex-1 md:flex-none px-5 py-3.5 bg-white border border-gray-100 rounded-[1.5rem] shadow-sm hover:bg-gray-50 transition-all font-black text-[10px] uppercase tracking-widest text-maroon flex items-center justify-center gap-2"
                    >
                        <Printer className="w-4 h-4" /> Print Statement
                    </button>
                    <button
                        onClick={() => alert('M-Pesa: Dial *334# → Paybill 123456\nAccount: Your Student ID')}
                        className="flex-1 md:flex-none bg-maroon text-gold px-8 py-3.5 rounded-[1.5rem] flex items-center justify-center gap-3 shadow-2xl hover:bg-maroon/90 hover:scale-[1.02] transition-all border border-gold/10 font-black text-[10px] uppercase tracking-widest"
                    >
                        <CreditCard className="w-4 h-4" /> Make Payment
                    </button>
                </div>
            </div>

            {/* Main Stats with Radial Progress */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 sticky top-0 md:relative">
                {/* Visual Overview Card */}
                <div className="lg:col-span-8 bg-white rounded-[3rem] border border-maroon/5 shadow-2xl p-8 sm:p-12 flex flex-col md:flex-row items-center gap-12 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-maroon/5 rounded-full -mr-32 -mt-32 blur-3xl" />
                    <div className="absolute bottom-0 left-0 w-48 h-48 bg-gold/5 rounded-full -ml-24 -mb-24 blur-2xl" />

                    {/* Radial Progress */}
                    <div className="relative w-48 h-48 shrink-0 flex items-center justify-center">
                        <svg className="w-full h-full -rotate-90">
                            <circle cx="96" cy="96" r={radius} className="fill-none stroke-gray-100 stroke-[16px]" />
                            <circle cx="96" cy="96" r={radius}
                                className={`fill-none stroke-[16px] transition-all duration-[1.5s] ease-in-out ${progress >= 100 ? 'stroke-emerald-500' : progress > 50 ? 'stroke-gold' : 'stroke-maroon'}`}
                                strokeDasharray={circumference}
                                strokeDashoffset={offset}
                                strokeLinecap="round"
                            />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                            <span className="text-4xl font-black text-maroon tracking-tighter">{progress.toFixed(0)}%</span>
                            <span className="text-[8px] font-black text-maroon/40 uppercase tracking-widest">Completed</span>
                        </div>
                    </div>

                    <div className="flex-1 space-y-6 text-center md:text-left z-10 w-full">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <StatusBadge status={status} />
                                <h3 className="text-xl font-black text-gray-800 uppercase tracking-tight mt-3">Account Liquidity</h3>
                                <p className="text-xs text-gray-400 font-bold">Total financial obligation summary</p>
                            </div>
                            <div className="text-right hidden md:block">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">Last Payment</p>
                                <p className="text-sm font-black text-maroon mt-1">
                                    {payments.length > 0 ? new Date(payments[0].payment_date).toLocaleDateString('en-KE', { day: '2-digit', month: 'short' }) : 'None Recorded'}
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-4 border-t border-maroon/5">
                            <div>
                                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Fee</p>
                                <p className="text-sm font-black text-gray-800 tracking-tight leading-none">KSh {fmt(totalDue)}</p>
                            </div>
                            <div>
                                <p className="text-[9px] font-black text-emerald-600/60 uppercase tracking-widest mb-1">Paid</p>
                                <p className="text-sm font-black text-emerald-600 tracking-tight leading-none">KSh {fmt(totalPaid)}</p>
                            </div>
                            <div className="col-span-2 sm:col-span-1 border-t sm:border-t-0 sm:border-l border-maroon/10 pt-4 sm:pt-0 sm:pl-6">
                                <p className="text-[9px] font-black text-red-500 uppercase tracking-widest mb-1">Balance</p>
                                <p className={`text-lg font-black tracking-tighter leading-none ${balance > 0 ? 'text-red-500' : 'text-emerald-600'}`}>KSh {fmt(balance)}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Strategic Allocation Sidebar */}
                <div className="lg:col-span-4 bg-maroon rounded-[3.5rem] p-10 text-white shadow-[0_24px_48px_-12px_rgba(0,0,0,0.3)] relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-full h-full opacity-5 pointer-events-none bg-[radial-gradient(circle_at_50%_0%,#daa520_0%,transparent_70%)]" />
                    <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-maroon/20 rounded-full blur-3xl group-hover:bg-maroon/30 transition-all duration-1000" />

                    <div className="relative z-10">
                        <div className="flex justify-between items-center mb-10">
                            <div>
                                <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-gold/60">Registry Breakdown</h4>
                                <h3 className="text-lg font-black uppercase tracking-tight text-white mt-1">Official Allocations</h3>
                            </div>
                            <div className="w-10 h-10 bg-white/5 rounded-2xl flex items-center justify-center border border-white/10">
                                <Activity className="w-5 h-5 text-gold" />
                            </div>
                        </div>

                        <div className="space-y-8">
                            {Object.entries(categoryTotals).map(([cat, val], i) => {
                                const ratio = (val / totalPaid) * 100;
                                return (
                                    <div key={i} className="group/item">
                                        <div className="flex justify-between items-end mb-3">
                                            <div>
                                                <p className="text-[9px] font-black text-white/40 uppercase tracking-widest mb-1">{cat}</p>
                                                <p className="text-xs font-black text-white tracking-widest">KSh {fmt(val)}</p>
                                            </div>
                                            <p className="text-[10px] font-black text-gold/80">{ratio.toFixed(1)}%</p>
                                        </div>
                                        <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                                            <div
                                                className="bg-gradient-to-r from-maroon via-gold to-gold h-full rounded-full transition-all duration-1000 delay-300"
                                                style={{ width: `${ratio}%` }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                            {Object.keys(categoryTotals).length === 0 && (
                                <div className="py-20 text-center">
                                    <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/5 opacity-50">
                                        <Receipt className="w-6 h-6 text-white/20" />
                                    </div>
                                    <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em]">No financial data detected</p>
                                </div>
                            )}
                        </div>

                        {balance > 0 && (
                            <div className="mt-12 p-6 bg-red-950/30 rounded-3xl border border-red-500/20 backdrop-blur-md animate-pulse">
                                <div className="flex items-start gap-4">
                                    <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
                                    <div>
                                        <p className="text-[10px] font-black text-red-400 uppercase tracking-widest leading-none">Status: Arrears Detected</p>
                                        <p className="text-[9px] font-bold text-white/40 mt-2 uppercase leading-relaxed">
                                            Balance of <span className="text-white font-black">KSh {fmt(balance)}</span> must be settled promptly.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Payment History Table */}
            <div className="bg-white rounded-[3rem] border border-maroon/5 shadow-2xl overflow-hidden">
                <div className="px-8 sm:px-12 py-8 border-b border-gray-50 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div>
                        <h3 className="text-xs font-black text-gray-800 uppercase tracking-[0.3em]">Transaction Registry</h3>
                        <p className="text-[10px] text-gray-400 font-bold mt-1 uppercase tracking-widest">{payments.length} verified record{payments.length !== 1 ? 's' : ''}</p>
                    </div>
                    <div className="flex gap-2">
                        <span className="px-4 py-2 bg-emerald-50 text-emerald-700 text-[9px] font-black rounded-xl uppercase tracking-widest">Official History</span>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-gray-50/50">
                                <th className="px-8 sm:px-12 py-5 text-[9px] font-black text-gray-400 uppercase tracking-widest">Status</th>
                                <th className="px-8 sm:px-12 py-5 text-[9px] font-black text-gray-400 uppercase tracking-widest text-center">Date / Year</th>
                                <th className="px-8 sm:px-12 py-5 text-[9px] font-black text-gray-400 uppercase tracking-widest text-center">Reference</th>
                                <th className="px-8 sm:px-12 py-5 text-[9px] font-black text-gray-400 uppercase tracking-widest text-center">Method</th>
                                <th className="px-8 sm:px-12 py-5 text-[9px] font-black text-gray-400 uppercase tracking-widest text-right">Credit (KSh)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {payments.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-12 py-24 text-center">
                                        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-maroon/5">
                                            <Receipt className="w-8 h-8 text-gray-200" />
                                        </div>
                                        <p className="text-xs font-black text-gray-300 uppercase tracking-widest">No verified payments found</p>
                                    </td>
                                </tr>
                            ) : payments.map((p, idx) => (
                                <tr key={p._id || p.id || idx} className="hover:bg-gray-50/70 transition-all group">
                                    <td className="px-8 sm:px-12 py-6">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-500">
                                                <ShieldCheck className="w-4 h-4" />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-black text-gray-800 uppercase">{p.category || 'Tuition Fee'}</span>
                                                <span className="text-[8px] text-gray-400 font-bold uppercase">{p.semester || 'Academic Fee'}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-8 sm:px-12 py-6 text-center">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-black text-gray-600">{new Date(p.payment_date).toLocaleDateString('en-KE', { day: '2-digit', month: 'short' })}</span>
                                            <span className="text-[8px] text-gray-400 font-bold">{p.academic_year || '2024'}</span>
                                        </div>
                                    </td>
                                    <td className="px-8 sm:px-12 py-6 text-center">
                                        <span className="text-[10px] font-black font-mono text-gray-500 uppercase tracking-tighter bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">{p.transaction_ref}</span>
                                    </td>
                                    <td className="px-8 sm:px-12 py-6 text-center">
                                        <span className="text-[8px] font-black px-3 py-1.5 bg-maroon/5 text-maroon rounded-lg uppercase tracking-[0.2em]">{p.method}</span>
                                    </td>
                                    <td className="px-8 sm:px-12 py-6 text-right">
                                        <span className="text-sm font-black text-emerald-700 tracking-tight">KSh {fmt(p.amount)}</span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        {payments.length > 0 && (
                            <tfoot>
                                <tr className="bg-maroon/[0.02] border-t-2 border-maroon/10">
                                    <td colSpan="4" className="px-8 sm:px-12 py-6 text-[10px] font-black text-maroon uppercase tracking-[0.3em]">Aggregate Payments Received</td>
                                    <td className="px-8 sm:px-12 py-6 text-lg font-black text-maroon text-right tracking-tight">KSh {fmt(totalPaid)}</td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>
        </div>
    );
}

// ─── ADMIN VIEW ───────────────────────────────────────────────────────────────
function AdminFinanceView({ analytics, payments, studentFees, allStudents, onRecord, onViewReport, onEditPayment, onDeletePayment, onEditFee, fetchAdminData }) {
    const [activeTab, setActiveTab] = useState('overview');
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const summary = analytics?.summary || {};

    const filteredFees = studentFees.filter(f => {
        const matchSearch = !search || (f.student_name || '').toLowerCase().includes(search.toLowerCase()) || (f.student_id || '').toLowerCase().includes(search.toLowerCase());
        const matchStatus = statusFilter === 'all' || f.status === statusFilter;
        return matchSearch && matchStatus;
    });

    const filteredPayments = payments.filter(p =>
        !search || (p.student_name || '').toLowerCase().includes(search.toLowerCase()) || (p.transaction_ref || '').toLowerCase().includes(search.toLowerCase())
    );

    const collectionRate = summary.total_revenue_expected > 0
        ? ((summary.total_revenue_collected / summary.total_revenue_expected) * 100).toFixed(1)
        : 0;

    return (
        <div className="space-y-10 animate-in fade-in duration-700">
            {/* Command Header */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <ShieldCheck className="w-4 h-4 text-gold" />
                        <p className="text-[10px] font-black text-maroon/40 uppercase tracking-[0.4em]">Administrative Finance Portal</p>
                    </div>
                    <h1 className="text-3xl sm:text-4xl font-black text-maroon uppercase tracking-tight">Finance Command</h1>
                </div>
                <div className="flex flex-wrap gap-3 w-full lg:w-auto">
                    <button
                        onClick={() => window.print()}
                        className="flex-1 lg:flex-none px-6 py-4 bg-white border border-gray-100 rounded-[1.5rem] shadow-sm hover:bg-gray-50 transition-all font-black text-[10px] uppercase tracking-widest text-maroon flex items-center justify-center gap-2"
                    >
                        <Printer className="w-4 h-4" /> Global Export
                    </button>
                    <button
                        onClick={onRecord}
                        className="flex-1 lg:flex-none bg-maroon text-gold px-8 py-4 rounded-[1.5rem] flex items-center justify-center gap-3 shadow-2xl hover:bg-maroon/90 hover:scale-[1.02] transition-all border border-gold/10 font-black text-[10px] uppercase tracking-widest"
                    >
                        <Plus className="w-4 h-4" /> Record Payment
                    </button>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex flex-wrap gap-2 p-1.5 bg-gray-100/50 rounded-[2rem] w-fit">
                {[
                    { id: 'overview', label: 'Overview', icon: BarChart3 },
                    { id: 'payments', label: 'Payment Registry', icon: Receipt },
                    { id: 'accounts', label: 'Student Accounts', icon: Users },
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`px-6 py-3 rounded-[1.5rem] flex items-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab.id
                            ? 'bg-white text-maroon shadow-sm border border-maroon/5 scale-105'
                            : 'text-gray-400 hover:text-maroon hover:bg-white/50'
                            }`}
                    >
                        <tab.icon className="w-3.5 h-3.5" />
                        {tab.label}
                    </button>
                ))}
            </div>

            {activeTab === 'overview' && (
                <div className="space-y-8 animate-in slide-in-from-bottom-5 duration-700">
                    {/* Key Metrics */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {[
                            { label: 'Projected Revenue', value: summary.total_revenue_expected, sub: 'Gross Obligations', icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50' },
                            { label: 'Net Collected', value: summary.total_revenue_collected, sub: `${collectionRate}% Success Rate`, icon: Banknote, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                            { label: 'Total Receivables', value: summary.total_outstanding, sub: 'Outstanding Balances', icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-50' },
                            { label: 'Active Debtors', value: summary.pending_accounts || 0, sub: 'Incomplete Accounts', icon: Users, color: 'text-amber-600', bg: 'bg-amber-50', noFmt: true },
                        ].map((stat, i) => (
                            <div key={i} className="bg-white rounded-[2.5rem] p-8 border border-gray-100 shadow-xl relative overflow-hidden group">
                                <div className={`absolute top-0 right-0 w-24 h-24 ${stat.bg} opacity-20 rounded-full -mr-12 -mt-12 transition-transform group-hover:scale-150 duration-700`} />
                                <div className={`w-12 h-12 ${stat.bg} rounded-2xl flex items-center justify-center mb-6`}>
                                    <stat.icon className={`w-6 h-6 ${stat.color}`} />
                                </div>
                                <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">{stat.label}</p>
                                <p className={`text-2xl font-black tracking-tight ${stat.color}`}>
                                    {stat.noFmt ? stat.value : `KSh ${fmt(stat.value)}`}
                                </p>
                                <p className="text-[10px] text-gray-400 font-bold mt-1">{stat.sub}</p>
                            </div>
                        ))}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                        {/* Collection Progress & Strategic Breakdown */}
                        <div className="lg:col-span-8 space-y-8">
                            <div className="bg-white rounded-[3.5rem] border border-gray-100 shadow-2xl p-8 sm:p-12 overflow-hidden relative">
                                <div className="absolute top-0 right-0 w-96 h-96 bg-maroon/5 rounded-full -mr-48 -mt-48 blur-3xl opacity-50" />

                                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-8 mb-12">
                                    <div>
                                        <h3 className="text-sm font-black text-gray-800 uppercase tracking-[0.4em] flex items-center gap-3 mb-2">
                                            <TrendingUp className="w-4 h-4 text-maroon" /> Collection Velocity
                                        </h3>
                                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Aggregate Registry Health Index</p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={async () => {
                                                try {
                                                    await financeAPI.syncLedger();
                                                    fetchAdminData();
                                                    alert('Financial Registry Synchronized!');
                                                } catch (e) { alert('Sync Failed'); }
                                            }}
                                            className="px-6 py-4 bg-maroon/5 hover:bg-maroon hover:text-white rounded-[2rem] border border-maroon/10 text-maroon text-[9px] font-black uppercase tracking-widest flex items-center gap-2 transition-all shadow-sm"
                                        >
                                            <RefreshCcw className="w-3 h-3" /> Synchronize Registry
                                        </button>
                                        <div className="flex items-center gap-6 bg-gray-50 px-6 py-4 rounded-3xl border border-gray-100">
                                            <div className="text-right">
                                                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Success Margin</p>
                                                <p className="text-lg font-black text-maroon tracking-tighter">{collectionRate}%</p>
                                            </div>
                                            <div className="w-px h-10 bg-gray-200" />
                                            <div className="text-right">
                                                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Verified Inflow</p>
                                                <p className="text-lg font-black text-emerald-600 tracking-tighter">KSh {fmt(summary.total_revenue_collected)}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-12 relative z-10">
                                    <div>
                                        <div className="w-full bg-gray-100 rounded-full h-6 overflow-hidden shadow-inner p-1">
                                            <div
                                                className="h-full rounded-full bg-gradient-to-r from-maroon via-maroon to-gold shadow-lg transition-all duration-1000 relative group"
                                                style={{ width: `${collectionRate}%` }}
                                            >
                                                <div className="absolute inset-0 bg-white/20 animate-pulse" />
                                            </div>
                                        </div>
                                        <div className="flex justify-between mt-4">
                                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Base Liability: 0</p>
                                            <p className="text-[9px] font-black text-maroon uppercase tracking-widest">Target: KSh {fmt(summary.total_revenue_expected)}</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
                                        {[
                                            { label: 'Asset Liquidity', val: 'KSh ' + fmt(summary.total_revenue_collected), color: 'text-emerald-700', icon: Wallet, bg: 'bg-emerald-50' },
                                            { label: 'Outstanding Asset', val: 'KSh ' + fmt(summary.total_outstanding), color: 'text-red-600', icon: Receipt, bg: 'bg-red-50' },
                                            { label: 'Revenue Velocity', val: `${summary.velocity >= 0 ? '+' : ''}${summary.velocity || 0}%`, color: 'text-amber-600', icon: Activity, bg: 'bg-amber-50' }
                                        ].map((item, i) => (
                                            <div key={i} className="flex items-center gap-4">
                                                <div className={`w-10 h-10 ${item.bg} rounded-xl flex items-center justify-center ${item.color} shadow-sm`}>
                                                    <item.icon className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">{item.label}</p>
                                                    <p className={`text-xs font-black uppercase tracking-tight ${item.color}`}>{item.val}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Recent Protocol Feed */}
                        <div className="lg:col-span-4 bg-white rounded-[3.5rem] border border-gray-100 shadow-2xl p-10 flex flex-col h-full relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-full opacity-5 pointer-events-none bg-[radial-gradient(circle_at_100%_100%,#800000_0%,transparent_50%)]" />
                            <div className="flex justify-between items-center mb-10 relative z-10">
                                <div>
                                    <h3 className="text-[10px] font-black text-gray-800 uppercase tracking-[0.4em] mb-1">Financial Stream</h3>
                                    <p className="text-[8px] text-gray-400 font-bold uppercase tracking-widest">Real-time Node Entry</p>
                                </div>
                                <Clock className="w-5 h-5 text-maroon/20" />
                            </div>

                            <div className="space-y-6 flex-1 relative z-10">
                                {payments.slice(0, 6).map((p, i) => (
                                    <div
                                        key={i}
                                        className="flex items-center gap-4 group cursor-pointer hover:bg-gray-50 p-3 -mx-3 rounded-2xl transition-all border border-transparent hover:border-gray-100"
                                        onClick={() => onViewReport(p)}
                                    >
                                        <div className="w-10 h-10 bg-gray-50 group-hover:bg-white rounded-xl flex items-center justify-center shrink-0 shadow-sm transition-colors overflow-hidden">
                                            {p.student_photo ? (
                                                <img src={p.student_photo} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="text-maroon font-black text-[10px] uppercase">{p.student_name?.charAt(0) || 'S'}</div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[10px] font-black text-gray-800 truncate uppercase mb-0.5">{p.student_name}</p>
                                            <div className="flex justify-between items-center">
                                                <p className="text-[9px] font-bold text-emerald-600">KSh {fmt(p.amount)}</p>
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); onEditPayment(p); }}
                                                        className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-amber-100 text-amber-600 rounded-lg transition-all"
                                                    >
                                                        <Pencil className="w-3 h-3" />
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); onDeletePayment(p.id || p._id); }}
                                                        className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-100 text-red-600 rounded-lg transition-all"
                                                    >
                                                        <Trash2 className="w-3 h-3" />
                                                    </button>
                                                    <p className="text-[8px] font-black text-gray-300 uppercase shrink-0">{new Date(p.payment_date).toLocaleDateString()}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {payments.length === 0 && (
                                    <div className="flex-1 flex flex-col items-center justify-center py-20 text-center opacity-20">
                                        <Activity className="w-12 h-12 mb-4" />
                                        <p className="text-[10px] font-black uppercase tracking-widest">Quiescent Ledger</p>
                                    </div>
                                )}
                            </div>

                            <button
                                onClick={() => setActiveTab('payments')}
                                className="w-full mt-10 py-5 bg-maroon text-gold rounded-[1.5rem] text-[9px] font-black uppercase tracking-[0.2em] shadow-xl hover:bg-maroon/90 shadow-maroon/20 transition-all flex items-center justify-center gap-3 group relative z-10"
                            >
                                <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                                Audit Full Registry
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'payments' && (
                <div className="space-y-6 animate-in slide-in-from-right-5 duration-700">
                    <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-2xl p-8 flex flex-col md:flex-row gap-4 justify-between items-center">
                        <div className="relative w-full md:w-96">
                            <Activity className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search Reference, Student Name, or ID..."
                                className="w-full pl-12 pr-6 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-maroon/20 text-xs font-black uppercase tracking-widest placeholder:text-gray-300 transition-all"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                        <div className="flex gap-4">
                            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest bg-gray-100 px-4 py-2 rounded-full flex items-center gap-2">
                                <Receipt className="w-3 h-3" /> {filteredPayments.length} Entries Found
                            </span>
                        </div>
                    </div>

                    <div className="bg-white rounded-[3rem] border border-gray-100 shadow-2xl overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-gray-50/70 border-b border-gray-100">
                                        <th className="px-10 py-6 text-[9px] font-black text-gray-400 uppercase tracking-[0.2em]">Student Account</th>
                                        <th className="px-10 py-6 text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] text-center">Protocol / Ref</th>
                                        <th className="px-10 py-6 text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] text-center">Method</th>
                                        <th className="px-10 py-6 text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] text-right">Credit (KSh)</th>
                                        <th className="px-10 py-6 text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] text-right">Receipt</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {filteredPayments.map((p, i) => (
                                        <tr key={p.id || i} className="hover:bg-gray-50/50 transition-all group">
                                            <td className="px-10 py-6">
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-black text-gray-800 uppercase tracking-tight group-hover:text-maroon transition-colors">{p.student_name || p.student_id}</span>
                                                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">{p.student_id}</span>
                                                </div>
                                            </td>
                                            <td className="px-10 py-6 text-center">
                                                <div className="flex flex-col items-center">
                                                    <span className="text-[10px] font-black font-mono text-gray-500 uppercase bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">{p.transaction_ref}</span>
                                                    <span className="text-[8px] text-gray-400 font-bold uppercase tracking-tighter mt-1">{new Date(p.payment_date).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                                </div>
                                            </td>
                                            <td className="px-10 py-6 text-center">
                                                <span className="text-[9px] font-black px-3 py-1.5 bg-maroon/5 text-maroon rounded-lg uppercase tracking-widest">{p.method}</span>
                                            </td>
                                            <td className="px-10 py-6 text-right">
                                                <span className="text-sm font-black text-emerald-700 tracking-tight">KSh {fmt(p.amount)}</span>
                                            </td>
                                            <td className="px-10 py-6 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <button onClick={() => onViewReport({ ...p, type: 'payment' })} className="p-2.5 bg-maroon/5 hover:bg-maroon hover:text-white rounded-xl transition-all shadow-sm">
                                                        <Eye className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button onClick={() => onEditPayment(p)} className="p-2.5 bg-amber-50 hover:bg-amber-500 hover:text-white rounded-xl transition-all shadow-sm text-amber-600">
                                                        <Pencil className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button onClick={() => onDeletePayment(p.id || p._id)} className="p-2.5 bg-red-50 hover:bg-red-500 hover:text-white rounded-xl transition-all shadow-sm text-red-600">
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredPayments.length === 0 && (
                                        <tr>
                                            <td colSpan="5" className="px-10 py-24 text-center">
                                                <Receipt className="w-12 h-12 text-gray-100 mx-auto mb-4" />
                                                <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest">No matching transactions found</p>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'accounts' && (
                <div className="space-y-6 animate-in slide-in-from-left-5 duration-700">
                    <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-2xl p-8 flex flex-col lg:flex-row gap-6 justify-between items-center">
                        <div className="relative w-full lg:w-96">
                            <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search by Student Name or ID..."
                                className="w-full pl-12 pr-6 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-maroon/20 text-xs font-black uppercase tracking-widest placeholder:text-gray-300 transition-all"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {['all', 'Paid', 'Partial', 'Pending', 'Overdue'].map(status => (
                                <button
                                    key={status}
                                    onClick={() => setStatusFilter(status)}
                                    className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${statusFilter === status
                                        ? 'bg-maroon text-gold shadow-lg shadow-maroon/20'
                                        : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                                        }`}
                                >
                                    {status}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredFees.map((fee, i) => {
                            const progress = fee.total_due > 0 ? (fee.total_paid / fee.total_due) * 100 : 0;
                            return (
                                <div key={fee.id || i} className="bg-white rounded-[2.5rem] border border-gray-100 shadow-xl overflow-hidden group hover:-translate-y-1 transition-all">
                                    <div className="p-8">
                                        <div className="flex justify-between items-start mb-6">
                                            <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center text-maroon group-hover:bg-maroon group-hover:text-gold transition-colors">
                                                <Users className="w-6 h-6" />
                                            </div>
                                            <StatusBadge status={fee.status} />
                                        </div>
                                        <h4 className="text-sm font-black text-gray-800 uppercase tracking-tight mb-0.5 truncate group-hover:text-maroon transition-colors">{fee.student_name}</h4>
                                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-6">{fee.student_id}</p>

                                        <div className="space-y-4">
                                            <div>
                                                <div className="flex justify-between text-[9px] font-black uppercase tracking-widest mb-2">
                                                    <span className="text-gray-400">Payment Progress</span>
                                                    <span className="text-maroon">{progress.toFixed(0)}%</span>
                                                </div>
                                                <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                                                    <div
                                                        className={`h-1.5 rounded-full transition-all duration-1000 ${progress >= 100 ? 'bg-emerald-500' : progress > 50 ? 'bg-amber-500' : 'bg-maroon'}`}
                                                        style={{ width: `${progress}%` }}
                                                    />
                                                </div>
                                            </div>

                                            <div className="flex justify-between items-end pt-4 border-t border-gray-50">
                                                <div>
                                                    <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Current Balance</p>
                                                    <p className={`text-lg font-black tracking-tighter ${fee.balance > 0 ? 'text-red-500' : 'text-emerald-600'}`}>KSh {fmt(fee.balance)}</p>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => onViewReport({ ...fee, type: 'status' })}
                                                        className="p-3 bg-gray-50 hover:bg-maroon hover:text-white rounded-2xl transition-all shadow-sm"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => onEditFee(fee)}
                                                        className="p-3 bg-amber-50 hover:bg-amber-500 hover:text-white rounded-2xl transition-all shadow-sm text-amber-600"
                                                    >
                                                        <Pencil className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    {filteredFees.length === 0 && (
                        <div className="bg-white rounded-[3rem] p-24 text-center border border-gray-100 shadow-2xl">
                            <Users className="w-16 h-16 text-gray-100 mx-auto mb-6" />
                            <p className="text-xs font-black text-gray-300 uppercase tracking-[0.3em]">No student accounts match your filter</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function Finance() {
    const { user } = useAuth();
    const [analytics, setAnalytics] = useState(null);
    const [studentFee, setStudentFee] = useState(null);
    const [payments, setPayments] = useState([]);
    const [allStudents, setAllStudents] = useState([]);
    const [studentFees, setStudentFees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [paymentForm, setPaymentForm] = useState(EMPTY_PAYMENT);
    const [saving, setSaving] = useState(false);
    const [viewingReport, setViewingReport] = useState(null);
    const [printingReport, setPrintingReport] = useState(null);
    const [editingRecord, setEditingRecord] = useState(null); // {type: 'payment' | 'fee', data: any }

    useEffect(() => {
        user?.role === 'student' ? fetchStudentData() : fetchAdminData();
    }, [user]);

    const fetchStudentData = async () => {
        try {
            const studentId = user.student_id || user.studentId || user.id;
            const [feeRes, payRes] = await Promise.all([
                financeAPI.getStudentFees(studentId).catch(() => ({ data: null })),
                financeAPI.getPayments(studentId).catch(() => ({ data: [] }))
            ]);
            setStudentFee(feeRes.data);
            setPayments(Array.isArray(payRes.data) ? payRes.data : []);
        } catch (e) {
            console.error('Error fetching student finance:', e);
        } finally { setLoading(false); }
    };

    const fetchAdminData = async () => {
        try {
            const [analyticsRes, paymentsRes, studentsRes, feesRes] = await Promise.all([
                financeAPI.getAnalytics().catch(() => ({ data: null })),
                financeAPI.getPayments().catch(() => ({ data: [] })),
                studentsAPI.getAll().catch(() => ({ data: [] })),
                financeAPI.getAllStudentFees().catch(() => ({ data: [] }))
            ]);
            setAnalytics(analyticsRes.data);
            setPayments(Array.isArray(paymentsRes.data) ? paymentsRes.data : []);
            setAllStudents(Array.isArray(studentsRes.data) ? studentsRes.data : []);
            setStudentFees(Array.isArray(feesRes.data) ? feesRes.data : []);
        } catch (e) {
            console.error('Error fetching admin finance:', e);
        } finally { setLoading(false); }
    };

    const handleRecordPayment = async (e) => {
        e.preventDefault();
        if (!paymentForm.student_id || !paymentForm.amount || !paymentForm.transaction_ref) {
            alert('Please fill in all required fields.');
            return;
        }
        try {
            setSaving(true);
            await financeAPI.recordPayment({ ...paymentForm, amount: parseFloat(paymentForm.amount) });
            setShowModal(false);
            setPaymentForm(EMPTY_PAYMENT);
            fetchAdminData();
            alert('Payment recorded successfully!');
        } catch (error) {
            alert(error.response?.data?.error || 'Failed to record payment.');
        } finally { setSaving(false); }
    };

    const handleUpdateRecord = async (e) => {
        e.preventDefault();
        try {
            setSaving(true);
            const { type, data } = editingRecord;
            const id = data.id || data._id;

            if (type === 'payment') {
                await financeAPI.updatePayment(id, data);
            } else {
                // For fees, use student_id or id
                await financeAPI.updateStudentFee(data.student_id || id, data);
            }

            setEditingRecord(null);
            fetchAdminData();
            alert('Record updated successfully!');
        } catch (error) {
            alert(error.response?.data?.error || 'Failed to update record.');
        } finally { setSaving(false); }
    };

    const handleDeleteRecord = async (type, id) => {
        if (!window.confirm('Are you absolutely sure? This action cannot be undone.')) return;
        try {
            setSaving(true);
            if (type === 'payment') {
                await financeAPI.deletePayment(id);
            }
            fetchAdminData();
            alert('Record deleted successfully!');
        } catch (error) {
            alert(error.response?.data?.error || 'Failed to delete record.');
        } finally { setSaving(false); }
    };

    const handleDownload = async (data, title) => {
        setPrintingReport({ data, title });
        setTimeout(async () => {
            const element = document.getElementById('finance-report-capture');
            if (!element) return;
            try {
                const canvas = await html2canvas(element, { scale: 3, useCORS: true, backgroundColor: '#ffffff', windowWidth: 794 });
                const imgData = canvas.toDataURL('image/png');
                const pdf = new jsPDF('p', 'mm', 'a4');
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const imgProps = pdf.getImageProperties(imgData);
                const ratio = imgProps.height / imgProps.width;
                pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, Math.min(pdfWidth * ratio, pdf.internal.pageSize.getHeight()));
                pdf.save(`${title.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`);
            } catch (err) {
                console.error(err);
                alert('Download failed. Please try printing instead.');
            } finally { setPrintingReport(null); }
        }, 800);
    };

    if (loading) return (
        <div className="flex flex-col items-center justify-center h-64 gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-maroon" />
            <p className="text-[10px] font-black text-maroon/40 uppercase tracking-widest">Loading Finance Data...</p>
        </div>
    );

    return (
        <>
            {user?.role === 'student' ? (
                <StudentFinanceView studentFee={studentFee} payments={payments} />
            ) : (
                <AdminFinanceView
                    analytics={analytics}
                    payments={payments}
                    studentFees={studentFees}
                    allStudents={allStudents}
                    fetchAdminData={fetchAdminData}
                    onRecord={() => setShowModal(true)}
                    onViewReport={setViewingReport}
                    onEditPayment={(p) => setEditingRecord({ type: 'payment', data: { ...p } })}
                    onEditFee={(f) => setEditingRecord({ type: 'fee', data: { ...f } })}
                    onDeletePayment={(id) => handleDeleteRecord('payment', id)}
                />
            )}

            {showModal && (
                <div className="fixed inset-0 bg-maroon/60 backdrop-blur-xl flex items-center justify-center p-4 z-50 animate-in fade-in duration-500">
                    <div className="bg-white border border-white/20 rounded-[3.5rem] max-h-[92vh] max-w-2xl w-full shadow-[0_32px_128px_-16px_rgba(0,0,0,0.4)] relative flex flex-col overflow-hidden">
                        {/* Premium Header Decoration */}
                        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-maroon via-gold to-maroon" />

                        <div className="px-10 py-8 flex justify-between items-center bg-gray-50/50 border-b border-gray-100">
                            <div>
                                <div className="flex items-center gap-3 mb-1">
                                    <div className="w-8 h-8 bg-maroon text-gold rounded-xl flex items-center justify-center shadow-lg transform -rotate-12">
                                        <ShieldCheck className="w-4 h-4" />
                                    </div>
                                    <h2 className="text-xl font-black text-maroon uppercase tracking-tight">Record Financial Entry</h2>
                                </div>
                                <p className="text-[10px] text-gray-400 font-black uppercase tracking-[0.3em] ml-11">Official Ledger Integration</p>
                            </div>
                            <button onClick={() => setShowModal(false)} className="p-4 hover:bg-red-50 text-gray-300 hover:text-red-500 rounded-3xl transition-all">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto px-10 py-10">
                            <form onSubmit={handleRecordPayment} className="space-y-8">
                                {/* Student Selection & Health Check */}
                                <div className="space-y-4">
                                    <label className="text-[10px] font-black text-maroon/40 uppercase tracking-[0.2em] ml-2">Secure Student Identification</label>
                                    <div className="relative group">
                                        <Users className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300 group-focus-within:text-maroon transition-colors" />
                                        <select
                                            value={paymentForm.student_id}
                                            onChange={e => setPaymentForm({ ...paymentForm, student_id: e.target.value })}
                                            className="w-full pl-16 pr-8 py-5 bg-gray-50 border-2 border-transparent rounded-[2rem] text-sm font-black text-gray-800 outline-none focus:border-maroon/10 focus:bg-white focus:ring-4 focus:ring-maroon/5 transition-all appearance-none cursor-pointer"
                                            required
                                        >
                                            <option value="">Search Registry for Student ID...</option>
                                            {allStudents.map(s => (
                                                <option key={s.id} value={s.id}>{s.name} — {s.id}</option>
                                            ))}
                                        </select>
                                        <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none">
                                            <div className="w-6 h-6 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 rotate-90">
                                                <Receipt className="w-3 h-3" />
                                            </div>
                                        </div>
                                    </div>

                                    {paymentForm.student_id && (() => {
                                        const fee = studentFees.find(f => f.student_id === paymentForm.student_id);
                                        if (!fee) return null;
                                        return (
                                            <div className="grid grid-cols-2 gap-4 animate-in slide-in-from-top-4 duration-500">
                                                <div className="p-6 bg-emerald-50/50 rounded-3xl border border-emerald-100/50 backdrop-blur-sm">
                                                    <p className="text-[8px] font-black text-emerald-600 uppercase tracking-widest mb-1 leading-none">Net Outstanding</p>
                                                    <p className="text-xl font-black text-emerald-700 tracking-tighter">KSh {fmt(fee.balance)}</p>
                                                </div>
                                                <div className="p-6 bg-maroon/5 rounded-3xl border border-maroon/10">
                                                    <p className="text-[8px] font-black text-maroon/60 uppercase tracking-widest mb-1 leading-none">Clearance Status</p>
                                                    <div className="flex items-center gap-2">
                                                        <div className="flex-1 bg-gray-200 rounded-full h-1.5 overflow-hidden">
                                                            <div className="bg-maroon h-full" style={{ width: `${fee.total_due > 0 ? (fee.total_paid / fee.total_due) * 100 : 0}%` }} />
                                                        </div>
                                                        <span className="text-[10px] font-black text-maroon">{fee.total_due > 0 ? ((fee.total_paid / fee.total_due) * 100).toFixed(0) : 0}%</span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>

                                {/* Transaction Parameters */}
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-maroon/40 uppercase tracking-widest ml-2">Allocation Amount</label>
                                        <div className="relative">
                                            <span className="absolute left-6 top-1/2 -translate-y-1/2 text-xs font-black text-gray-400">KSh</span>
                                            <input
                                                type="number" min="1"
                                                value={paymentForm.amount}
                                                onChange={e => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                                                className="w-full pl-16 pr-8 py-5 bg-gray-50 border-2 border-transparent rounded-[2rem] text-sm font-black text-gray-800 outline-none focus:border-maroon/10 focus:bg-white focus:ring-4 focus:ring-maroon/5 transition-all"
                                                placeholder="0.00"
                                                required
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-maroon/40 uppercase tracking-widest ml-2">Payment Protocol</label>
                                        <select
                                            value={paymentForm.method}
                                            onChange={e => setPaymentForm({ ...paymentForm, method: e.target.value })}
                                            className="w-full px-8 py-5 bg-gray-50 border-2 border-transparent rounded-[2rem] text-sm font-black text-gray-800 outline-none focus:border-maroon/10 focus:bg-white focus:ring-4 focus:ring-maroon/5 transition-all appearance-none cursor-pointer"
                                        >
                                            {['M-Pesa', 'Bank Transfer', 'Cash', 'Cheque'].map(m => <option key={m}>{m}</option>)}
                                        </select>
                                    </div>
                                </div>

                                {paymentForm.method === 'M-Pesa' && (
                                    <div className="p-8 bg-emerald-50 rounded-[2.5rem] border border-emerald-100 animate-in zoom-in-95 duration-300">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="w-10 h-10 bg-emerald-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
                                                <Activity className="w-5 h-5 animate-pulse" />
                                            </div>
                                            <div>
                                                <p className="text-xs font-black text-emerald-900 uppercase">M-Pesa STK Push Integration</p>
                                                <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-tighter">Enter donor/student phone for PIN prompt</p>
                                            </div>
                                        </div>
                                        <input
                                            type="text"
                                            value={paymentForm.phone}
                                            onChange={e => setPaymentForm({ ...paymentForm, phone: e.target.value })}
                                            className="w-full px-8 py-5 bg-white border-2 border-emerald-100 rounded-[2rem] text-sm font-black text-emerald-900 outline-none focus:ring-4 focus:ring-emerald-500/10 transition-all placeholder:text-emerald-200"
                                            placeholder="2547XXXXXXXX"
                                        />
                                    </div>
                                )}

                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-maroon/40 uppercase tracking-widest ml-2">Network Reference / Protocol ID</label>
                                    <input
                                        type="text"
                                        value={paymentForm.transaction_ref}
                                        onChange={e => setPaymentForm({ ...paymentForm, transaction_ref: e.target.value })}
                                        className="w-full px-8 py-5 bg-gray-50 border-2 border-transparent rounded-[2rem] text-sm font-black font-mono text-gray-800 outline-none focus:border-maroon/10 focus:bg-white focus:ring-4 focus:ring-maroon/5 transition-all text-center tracking-widest"
                                        placeholder="e.g. BTC-992-XPA"
                                        required
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-maroon/40 uppercase tracking-widest ml-2">Fee Category</label>
                                        <select
                                            value={paymentForm.category}
                                            onChange={e => setPaymentForm({ ...paymentForm, category: e.target.value })}
                                            className="w-full px-8 py-5 bg-gray-50 border-2 border-transparent rounded-[2rem] text-sm font-black text-gray-800 outline-none focus:border-maroon/10 focus:bg-white focus:ring-4 focus:ring-maroon/5 transition-all appearance-none cursor-pointer"
                                        >
                                            {['Tuition Fee', 'Registration', 'Exam Fee', 'Uniform', 'Hostel', 'Graduation', 'Library', 'Other'].map(c => <option key={c}>{c}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-maroon/40 uppercase tracking-widest ml-2">Session Identifier</label>
                                        <input
                                            type="text"
                                            value={paymentForm.semester}
                                            onChange={e => setPaymentForm({ ...paymentForm, semester: e.target.value })}
                                            className="w-full px-8 py-5 bg-gray-50 border-2 border-transparent rounded-[2rem] text-sm font-black text-gray-800 outline-none focus:border-maroon/10 focus:bg-white focus:ring-4 focus:ring-maroon/5 transition-all"
                                            placeholder="Term 3 / Sem 1"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-maroon/40 uppercase tracking-widest ml-2">Ledger Annotations & Remarks</label>
                                    <textarea
                                        value={paymentForm.remarks}
                                        onChange={e => setPaymentForm({ ...paymentForm, remarks: e.target.value })}
                                        className="w-full px-8 py-5 bg-gray-50 border-2 border-transparent rounded-[2.5rem] text-xs font-bold text-gray-600 outline-none focus:border-maroon/10 focus:bg-white focus:ring-4 focus:ring-maroon/5 transition-all min-h-[120px] resize-none"
                                        placeholder="Add any administrative context or bank details..."
                                    />
                                </div>
                            </form>
                        </div>

                        {/* Sticky Action Footer */}
                        <div className="px-10 py-8 border-t border-gray-100 bg-gray-50/80 backdrop-blur-md">
                            <button
                                type="submit"
                                onClick={handleRecordPayment}
                                disabled={saving}
                                className="w-full group bg-maroon text-gold py-6 rounded-[2.5rem] font-black text-sm uppercase tracking-[0.3em] hover:bg-maroon/90 shadow-2xl shadow-maroon/20 transition-all border border-gold/20 disabled:opacity-60 overflow-hidden relative"
                            >
                                <span className={`flex items-center justify-center gap-3 transition-all duration-500 ${saving ? 'opacity-0 scale-90' : 'opacity-100 scale-100'}`}>
                                    <ShieldCheck className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                                    {paymentForm.method === 'M-Pesa' ? 'Execute PIN Prompt' : 'Commit to Ledger'}
                                </span>
                                {saving && (
                                    <div className="absolute inset-0 flex items-center justify-center gap-3 bg-maroon">
                                        <div className="animate-spin w-5 h-5 border-2 border-gold/40 border-t-gold rounded-full" />
                                        <span className="animate-pulse">Synchronizing Entry...</span>
                                    </div>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Record Modal */}
            {editingRecord && (
                <div className="fixed inset-0 bg-maroon/60 backdrop-blur-xl flex items-center justify-center p-4 z-50">
                    <div className="bg-white border border-white/20 rounded-[3.5rem] max-h-[92vh] max-w-2xl w-full shadow-2xl relative flex flex-col overflow-hidden">
                        <div className="px-10 py-8 flex justify-between items-center bg-gray-50/50 border-b border-gray-100">
                            <div>
                                <h2 className="text-xl font-black text-maroon uppercase tracking-tight">Edit Financial Record</h2>
                                <p className="text-[10px] text-gray-400 font-black uppercase tracking-[0.3em]">
                                    Registry Adjustment Protocol
                                    {editingRecord.data.student_name && ` • ${editingRecord.data.student_name} (${editingRecord.data.student_id})`}
                                </p>
                            </div>
                            <button onClick={() => setEditingRecord(null)} className="p-4 hover:bg-red-50 text-gray-300 hover:text-red-500 rounded-3xl transition-all">
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto px-10 py-10">
                            <form onSubmit={handleUpdateRecord} className="space-y-6">
                                {editingRecord.type === 'payment' ? (
                                    <>
                                        <div className="grid grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-maroon/40 uppercase tracking-widest">Amount</label>
                                                <input
                                                    type="number"
                                                    value={editingRecord.data.amount}
                                                    onChange={e => setEditingRecord({ ...editingRecord, data: { ...editingRecord.data, amount: e.target.value } })}
                                                    className="w-full px-6 py-4 bg-gray-50 rounded-2xl text-sm font-black outline-none focus:ring-2 focus:ring-maroon/10 focus:bg-white transition-all"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-maroon/40 uppercase tracking-widest">Protocol</label>
                                                <select
                                                    value={editingRecord.data.method}
                                                    onChange={e => setEditingRecord({ ...editingRecord, data: { ...editingRecord.data, method: e.target.value } })}
                                                    className="w-full px-6 py-4 bg-gray-50 rounded-2xl text-sm font-black outline-none focus:ring-2 focus:ring-maroon/10 focus:bg-white transition-all"
                                                >
                                                    {['M-Pesa', 'Bank Transfer', 'Cash', 'Cheque'].map(m => <option key={m}>{m}</option>)}
                                                </select>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-maroon/40 uppercase tracking-widest">Category</label>
                                            <select
                                                value={editingRecord.data.category}
                                                onChange={e => setEditingRecord({ ...editingRecord, data: { ...editingRecord.data, category: e.target.value } })}
                                                className="w-full px-6 py-4 bg-gray-50 rounded-2xl text-sm font-black outline-none focus:ring-2 focus:ring-maroon/10 focus:bg-white transition-all"
                                            >
                                                {['Tuition Fee', 'Registration', 'Exam Fee', 'Uniform', 'Hostel', 'Graduation', 'Library', 'Other'].map(c => <option key={c}>{c}</option>)}
                                            </select>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-maroon/40 uppercase tracking-widest">Reference</label>
                                            <input
                                                type="text"
                                                value={editingRecord.data.transaction_ref}
                                                onChange={e => setEditingRecord({ ...editingRecord, data: { ...editingRecord.data, transaction_ref: e.target.value } })}
                                                className="w-full px-6 py-4 bg-gray-50 rounded-2xl text-sm font-black font-mono outline-none focus:ring-2 focus:ring-maroon/10 focus:bg-white transition-all"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-maroon/40 uppercase tracking-widest">Remarks</label>
                                            <textarea
                                                value={editingRecord.data.remarks}
                                                onChange={e => setEditingRecord({ ...editingRecord, data: { ...editingRecord.data, remarks: e.target.value } })}
                                                className="w-full px-6 py-4 bg-gray-50 rounded-2xl text-xs font-bold min-h-[100px] outline-none focus:ring-2 focus:ring-maroon/10 focus:bg-white transition-all resize-none"
                                            />
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="grid grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-maroon/40 uppercase tracking-widest">Total Due</label>
                                                <input
                                                    type="number"
                                                    value={editingRecord.data.total_due}
                                                    onChange={e => {
                                                        const due = parseFloat(e.target.value) || 0;
                                                        setEditingRecord({
                                                            ...editingRecord,
                                                            data: {
                                                                ...editingRecord.data,
                                                                total_due: due,
                                                                balance: due - (editingRecord.data.total_paid || 0)
                                                            }
                                                        });
                                                    }}
                                                    className="w-full px-6 py-4 bg-gray-50 rounded-2xl text-sm font-black outline-none focus:ring-2 focus:ring-maroon/10 focus:bg-white transition-all"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-maroon/40 uppercase tracking-widest">Total Paid</label>
                                                <input
                                                    type="number"
                                                    value={editingRecord.data.total_paid}
                                                    onChange={e => {
                                                        const paid = parseFloat(e.target.value) || 0;
                                                        setEditingRecord({
                                                            ...editingRecord,
                                                            data: {
                                                                ...editingRecord.data,
                                                                total_paid: paid,
                                                                balance: (editingRecord.data.total_due || 0) - paid
                                                            }
                                                        });
                                                    }}
                                                    className="w-full px-6 py-4 bg-gray-50 rounded-2xl text-sm font-black outline-none focus:ring-2 focus:ring-maroon/10 focus:bg-white transition-all"
                                                />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-maroon/40 uppercase tracking-widest">Net Balance</label>
                                                <input
                                                    type="number"
                                                    value={editingRecord.data.balance}
                                                    readOnly
                                                    className="w-full px-6 py-4 bg-gray-100 rounded-2xl text-sm font-black text-gray-500 outline-none"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-maroon/40 uppercase tracking-widest">Account Status</label>
                                                <select
                                                    value={editingRecord.data.status}
                                                    onChange={e => setEditingRecord({ ...editingRecord, data: { ...editingRecord.data, status: e.target.value } })}
                                                    className="w-full px-6 py-4 bg-gray-50 rounded-2xl text-sm font-black outline-none focus:ring-2 focus:ring-maroon/10 focus:bg-white transition-all"
                                                >
                                                    {['Paid', 'Partial', 'Pending', 'Overdue'].map(s => <option key={s}>{s}</option>)}
                                                </select>
                                            </div>
                                        </div>
                                    </>
                                )}
                                <div className="pt-6 border-t border-gray-100">
                                    <button
                                        type="submit"
                                        disabled={saving}
                                        className="w-full bg-maroon text-gold py-5 rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] shadow-xl hover:bg-maroon/90 transition-all border border-gold/10 disabled:opacity-50"
                                    >
                                        {saving ? 'Processing adjustment...' : 'Confirm Adjustments'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* View Report Modal */}
            {viewingReport && (
                <div className="fixed inset-0 bg-maroon/40 backdrop-blur-xl flex items-center justify-center p-4 z-50 animate-in fade-in duration-300">
                    <div className="bg-white rounded-[3rem] max-w-2xl w-full shadow-2xl relative max-h-[90vh] flex flex-col overflow-hidden border border-white/20">
                        {/* Modal Header Controls */}
                        <div className="px-10 py-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-maroon text-gold rounded-2xl flex items-center justify-center shadow-lg">
                                    <ShieldCheck className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-maroon uppercase tracking-widest leading-none">
                                        {viewingReport.type === 'payment' ? 'Official Receipt' : 'Account Statement'}
                                    </h3>
                                    <p className="text-[9px] text-gray-400 font-bold uppercase tracking-tighter mt-1">Registry No: {viewingReport._id || viewingReport.id}</p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleDownload(viewingReport, viewingReport.type === 'payment' ? 'Receipt' : 'Statement')}
                                    className="p-3 bg-white hover:bg-maroon hover:text-gold rounded-xl transition-all shadow-sm text-maroon border border-gray-100"
                                    title="Download Document"
                                >
                                    <FileDown className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={() => setViewingReport(null)}
                                    className="p-3 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-2xl transition-all"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {/* Document Area */}
                        <div id="printable-report" className="flex-1 overflow-y-auto p-12 sm:p-16 bg-white relative">
                            {/* Watermark Overlay */}
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03] rotate-[-35deg] select-none">
                                <span className="text-9xl font-black text-maroon uppercase tracking-[0.2em] border-[20px] border-maroon p-10 rounded-[5rem]">VERIFIED</span>
                            </div>

                            <div className="space-y-12 relative z-10">
                                {/* Institutional Identity */}
                                <div className="text-center mb-12">
                                    <p className="text-[10px] font-black text-maroon/40 uppercase tracking-[0.6em] mb-2 leading-none">Beautex Technical College</p>
                                    <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tight">Financial Services Division</h2>
                                    <div className="w-16 h-1 bg-gold mx-auto mt-4 rounded-full" />
                                </div>

                                {/* Summary Grid */}
                                <div className="grid grid-cols-2 gap-12">
                                    <div className="space-y-8">
                                        <div>
                                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2 leading-none">Recipient Account</p>
                                            <p className="text-sm font-black text-gray-800 uppercase leading-none">{viewingReport.student_name || viewingReport.student_id}</p>
                                            <p className="text-[10px] font-bold text-maroon uppercase mt-1">ID: {viewingReport.student_id}</p>
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2 leading-none">Academic Cycle</p>
                                            <p className="text-[10px] font-black text-gray-700 uppercase leading-none">{viewingReport.semester || 'Official Period'}</p>
                                            <p className="text-[10px] font-black text-gray-500 uppercase mt-1">{viewingReport.academic_year || '2024'}</p>
                                        </div>
                                    </div>
                                    <div className="text-right space-y-8">
                                        <div>
                                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2 leading-none">Transaction Protocol</p>
                                            <p className="text-[10px] font-black font-mono text-gray-800 uppercase tracking-widest bg-gray-50 px-3 py-1.5 rounded-lg inline-block border border-gray-100 leading-none">
                                                {viewingReport.transaction_ref}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2 leading-none">Issuance Date</p>
                                            <p className="text-[10px] font-black text-gray-700 uppercase leading-none">
                                                {new Date(viewingReport.payment_date || new Date()).toLocaleDateString('en-KE', { day: '2-digit', month: 'long', year: 'numeric' })}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Financial Detail Table */}
                                <div className="border-t-2 border-b-2 border-gray-50 py-10">
                                    <div className="flex justify-between items-center mb-8">
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest font-serif italic">Description of Services / Charges</p>
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Aggregate Amount</p>
                                    </div>
                                    <div className="flex justify-between items-end">
                                        <div className="space-y-2">
                                            <h4 className="text-lg font-black text-gray-800 uppercase tracking-tight leading-none">{viewingReport.category || 'Tuition Fee'}</h4>
                                            <div className="flex gap-3">
                                                <span className="text-[9px] font-black px-2 py-1 bg-maroon/5 text-maroon rounded-lg uppercase">Method: {viewingReport.method}</span>
                                                <span className="text-[9px] font-black px-2 py-1 bg-gray-50 text-gray-400 rounded-lg uppercase">Auth: {viewingReport.recorded_by || 'System'}</span>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-3xl font-black text-emerald-600 tracking-tighter leading-none">
                                                <span className="text-sm mr-1">KSh</span>
                                                {fmt(viewingReport.type === 'payment' ? viewingReport.amount : viewingReport.balance)}
                                            </p>
                                            <p className="text-[8px] font-black text-emerald-600/50 uppercase tracking-widest mt-2">{viewingReport.type === 'payment' ? 'Credit Applied' : 'Balance Outstanding'}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Remarks & Metadata */}
                                {viewingReport.remarks && (
                                    <div className="p-6 bg-gray-50/50 rounded-[2rem] border border-gray-100 flex items-start gap-4">
                                        <div className="w-8 h-8 bg-white rounded-xl flex items-center justify-center text-gray-400 shrink-0 border border-gray-100">
                                            <Activity className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1 leading-none">Internal Registry Remarks</p>
                                            <p className="text-[10px] font-bold text-gray-600 italic leading-relaxed">{viewingReport.remarks}</p>
                                        </div>
                                    </div>
                                )}

                                {/* Institutional Validation */}
                                <div className="flex flex-col sm:flex-row justify-between items-end gap-10 pt-10">
                                    <div className="space-y-4 max-w-xs">
                                        <div className="flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                                            <p className="text-[8px] font-black text-emerald-600 uppercase tracking-widest">Statistically Validated</p>
                                        </div>
                                        <p className="text-[8px] font-bold text-gray-300 uppercase leading-relaxed tracking-wider">
                                            This document is generated by the BTTC automated finance registry. Total verified through secure banking protocols. Accuracy is guaranteed as of generation time.
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <div className="mb-4 inline-block relative">
                                            <div className="font-serif italic text-3xl text-maroon/10 select-none pb-2">Institutional-Seal</div>
                                            <div className="absolute bottom-0 right-0 w-24 h-0.5 bg-maroon/10" />
                                        </div>
                                        <p className="text-[9px] font-black text-gray-800 uppercase tracking-[0.3em] leading-none">Registrar of Accounts</p>
                                        <p className="text-[8px] font-bold text-maroon/30 mt-2 tracking-tighter italic font-mono uppercase">
                                            {viewingReport.id?.substring(0, 8) || 'SYSTEM'}-AUTH-SECURE
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer Actions */}
                        <div className="px-10 py-8 border-t border-gray-100 flex gap-4 bg-gray-50/50">
                            <button
                                onClick={() => setViewingReport(null)}
                                className="flex-1 px-8 py-4 bg-white border border-gray-200 text-gray-400 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:text-red-500 hover:border-red-100 transition-all"
                            >
                                Close Ledger
                            </button>
                            <button
                                onClick={() => handleDownload(viewingReport, viewingReport.type === 'payment' ? 'Receipt' : 'Statement')}
                                className="flex-1 px-8 py-4 bg-maroon text-gold rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl hover:bg-maroon/90 hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
                            >
                                <Printer className="w-4 h-4" /> Finalize & Export
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Hidden Institutional Document Capture Area */}
            {printingReport && (
                <div className="fixed inset-0 bg-white z-[-1] pointer-events-none opacity-0 overflow-hidden">
                    <div id="finance-report-capture" className="w-[800px] bg-white text-[#1a1a1a] font-sans p-[60px] relative">
                        {/* Decorative Institutional Border */}
                        <div className="absolute inset-0 border-[20px] border-gray-50 opacity-50" />
                        <div className="absolute top-10 left-10 right-10 bottom-10 border border-maroon/10" />

                        <div className="relative z-10 h-full flex flex-col">
                            {/* Document Header */}
                            <div className="flex justify-between items-start mb-[60px] pb-[40px] border-b-2 border-maroon">
                                <div className="flex items-center gap-[20px]">
                                    <img src="/logo.jpg" alt="Logo" className="w-[80px] h-[80px] object-contain" />
                                    <div>
                                        <h1 className="text-[20px] font-black uppercase tracking-[0.2em] text-maroon leading-tight">Beautex Technical<br />Training College</h1>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.3em] mt-2">Department of Financial Registry</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="bg-maroon text-gold px-6 py-3 rounded-xl inline-block mb-3">
                                        <p className="text-[12px] font-black uppercase tracking-widest">{printingReport.title}</p>
                                    </div>
                                    <p className="text-[10px] font-black text-gray-800 uppercase tracking-widest">Verified Document</p>
                                </div>
                            </div>

                            {/* Document Meta */}
                            <div className="grid grid-cols-2 gap-[40px] mb-[60px]">
                                <div className="space-y-[20px]">
                                    <div>
                                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">Authenticated Recipient</p>
                                        <p className="text-[16px] font-black text-gray-800 uppercase">{printingReport.data.student_name || 'Registry Entity'}</p>
                                        <p className="text-[11px] font-bold text-maroon uppercase mt-1">ID: {printingReport.data.student_id}</p>
                                    </div>
                                    <div>
                                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">Protocol Reference</p>
                                        <p className="text-[12px] font-black font-mono text-gray-800 uppercase tracking-widest bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">{printingReport.data.transaction_ref || 'INTERNAL-RECORD'}</p>
                                    </div>
                                </div>
                                <div className="text-right space-y-[20px]">
                                    <div>
                                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">Issuance Context</p>
                                        <p className="text-[11px] font-black text-gray-800 uppercase">{printingReport.data.semester || 'Official Period'}</p>
                                        <p className="text-[11px] font-black text-gray-500 uppercase mt-1">{printingReport.data.academic_year || '2024 Cycle'}</p>
                                    </div>
                                    <div>
                                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">Transmission Date</p>
                                        <p className="text-[11px] font-black text-gray-800 uppercase">{new Date().toLocaleDateString('en-KE', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Financial Core Breakdown */}
                            <div className="flex-1">
                                <div className="border-t-2 border-b-2 border-gray-50 py-[40px] mb-[40px]">
                                    <div className="flex justify-between items-center mb-[20px]">
                                        <p className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] italic font-serif">Financial Allocation Category</p>
                                        <p className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em]">Validated Amount</p>
                                    </div>
                                    <div className="flex justify-between items-end">
                                        <div>
                                            <p className="text-[18px] font-black text-gray-900 uppercase tracking-tight">{printingReport.data.category || 'Institutional Obligations'}</p>
                                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-2">Method: {printingReport.data.method || 'Internal Transfer'}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[32px] font-black text-emerald-600 tracking-tighter leading-none"><span className="text-[14px] mr-1">KSh</span>{fmt(printingReport.data.amount || printingReport.data.balance || 0)}</p>
                                            <p className="text-[9px] font-black text-emerald-600/50 uppercase tracking-widest mt-2">Authenticated Receipt</p>
                                        </div>
                                    </div>
                                </div>

                                {printingReport.data.remarks && (
                                    <div className="p-6 bg-gray-50/50 rounded-2xl border border-gray-100 mb-[40px]">
                                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">Official Annotated Remarks</p>
                                        <p className="text-[11px] font-bold text-gray-600 italic leading-relaxed">"{printingReport.data.remarks}"</p>
                                    </div>
                                )}
                            </div>

                            {/* Verification Footer */}
                            <div className="pt-[40px] border-t border-maroon/20 flex justify-between items-end">
                                <div className="max-w-[300px]">
                                    <p className="text-[8px] font-bold text-gray-300 uppercase leading-relaxed tracking-wider mb-4">
                                        This is a computer-verified institutional document. Total sums been audited through the College Central Registry Service.
                                        Accuracy of this document is guaranteed as of the transmission date provided.
                                    </p>
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                                        <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Secure Registry Entry Verified</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="mb-4">
                                        <p className="font-serif italic text-[24px] text-maroon/10 select-none border-b border-maroon/10 inline-block px-10 pb-2">RegistrarSeal</p>
                                    </div>
                                    <p className="text-[10px] font-black text-gray-800 uppercase tracking-[0.3em] leading-none">Office of the Registrar</p>
                                    <p className="text-[8px] font-bold text-maroon/30 mt-2 tracking-tighter italic font-mono uppercase">BTTC-FIN-SECURE-{Math.random().toString(36).substr(2, 6).toUpperCase()}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
