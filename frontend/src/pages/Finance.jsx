import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { financeAPI, studentsAPI } from '../services/api';
import {
    CreditCard, TrendingUp, AlertCircle, DollarSign, Plus, X,
    FileDown, Printer, Eye, CheckCircle2, Clock, BarChart3,
    ArrowUpRight, ShieldCheck, Banknote, Users, Activity,
    ChevronRight, Receipt, Wallet, PiggyBank, AlertTriangle
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
    manual_total_due: '',
    manual_total_paid: '',
    manual_balance: ''
};

const fmt = (n) => Number(n || 0).toLocaleString();

const StatusBadge = ({ status }) => {
    const map = {
        Paid: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
        Partial: 'bg-amber-50 text-amber-700 border border-amber-200',
        Pending: 'bg-red-50 text-red-600 border border-red-200',
        Overdue: 'bg-rose-50 text-rose-700 border border-rose-200',
    };
    return (
        <span className={`text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest ${map[status] || map.Pending}`}>
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

    const handlePrint = () => window.print();

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
                <div>
                    <p className="text-[10px] font-black text-maroon/30 uppercase tracking-[0.3em] mb-1">Beautex Technical College</p>
                    <h1 className="text-2xl sm:text-3xl font-black text-maroon uppercase tracking-tight">My Fee Account</h1>
                    <div className="w-12 h-0.5 bg-gold mt-2" />
                    <p className="text-xs text-maroon/40 font-bold mt-1">Personal Finance Summary</p>
                </div>
                <button
                    onClick={() => alert('M-Pesa: Dial *334# → Paybill 123456\nAccount: Your Student ID')}
                    className="w-full sm:w-auto bg-maroon text-gold px-6 py-3 rounded-2xl flex items-center justify-center gap-2 shadow-xl hover:scale-105 hover:bg-maroon/90 transition-all border border-gold/20 cursor-pointer"
                >
                    <CreditCard className="w-4 h-4" />
                    <span className="text-xs font-black uppercase tracking-widest">Pay via M-Pesa</span>
                </button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                {[
                    {
                        label: 'Total Fee', value: totalDue, color: 'text-gray-800',
                        bg: 'bg-gray-50', icon: Wallet, iconColor: 'text-gray-500',
                        sub: 'Programme fee total'
                    },
                    {
                        label: 'Amount Paid', value: totalPaid, color: 'text-emerald-700',
                        bg: 'bg-emerald-50', icon: CheckCircle2, iconColor: 'text-emerald-500',
                        sub: 'Payments received'
                    },
                    {
                        label: 'Fee Balance', value: balance, color: balance > 0 ? 'text-red-600' : 'text-emerald-600',
                        bg: balance > 0 ? 'bg-red-50' : 'bg-emerald-50',
                        icon: balance > 0 ? AlertTriangle : ShieldCheck,
                        iconColor: balance > 0 ? 'text-red-500' : 'text-emerald-500',
                        sub: balance > 0 ? 'Outstanding amount' : 'Fully settled!'
                    },
                ].map((card, i) => (
                    <div key={i} className="bg-white rounded-[2rem] border border-gray-100 shadow-lg hover:-translate-y-1 transition-all p-6 sm:p-7">
                        <div className="flex items-center justify-between mb-5">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">{card.label}</p>
                            <div className={`w-10 h-10 ${card.bg} rounded-2xl flex items-center justify-center`}>
                                <card.icon className={`w-5 h-5 ${card.iconColor}`} />
                            </div>
                        </div>
                        <div className="flex items-baseline gap-1 mb-2">
                            <span className="text-[10px] font-black text-maroon/30 uppercase">KSh</span>
                            <span className={`text-3xl font-black tracking-tighter ${card.color}`}>{fmt(card.value)}</span>
                        </div>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{card.sub}</p>
                    </div>
                ))}
            </div>

            {/* Progress Bar */}
            <div className="bg-white rounded-[2rem] border border-gray-100 shadow-lg p-6 sm:p-8">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-5">
                    <div>
                        <h3 className="text-xs font-black text-gray-800 uppercase tracking-[0.2em]">Payment Progress</h3>
                        <p className="text-[10px] text-gray-400 font-bold mt-0.5">
                            {progress.toFixed(1)}% of total fees paid
                        </p>
                    </div>
                    <StatusBadge status={status} />
                </div>
                <div className="relative w-full bg-gray-100 rounded-full h-4 overflow-hidden">
                    <div
                        className={`h-4 rounded-full transition-all duration-1000 ease-out ${progress >= 100 ? 'bg-emerald-500' : progress > 50 ? 'bg-amber-500' : 'bg-maroon'}`}
                        style={{ width: `${progress}%` }}
                    />
                </div>
                <div className="flex justify-between text-[10px] font-black text-gray-400 uppercase tracking-widest mt-3">
                    <span>KSh 0</span>
                    <span>KSh {fmt(totalDue)}</span>
                </div>
                {status !== 'Paid' && balance > 0 && (
                    <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-3">
                        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                        <p className="text-[10px] font-bold text-amber-700">
                            You have an outstanding balance of <strong>KSh {fmt(balance)}</strong>. Please clear your fees to avoid academic disruptions.
                        </p>
                    </div>
                )}
                {status === 'Paid' && (
                    <div className="mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                        <p className="text-[10px] font-bold text-emerald-700">
                            Your fee account is fully settled. Thank you!
                        </p>
                    </div>
                )}
            </div>

            {/* Payment History */}
            <div className="bg-white rounded-[2rem] border border-gray-100 shadow-lg overflow-hidden">
                <div className="px-6 sm:px-8 py-5 border-b border-gray-50 flex justify-between items-center">
                    <div>
                        <h3 className="text-xs font-black text-gray-800 uppercase tracking-[0.2em]">Payment History</h3>
                        <p className="text-[10px] text-gray-400 font-bold mt-0.5">{payments.length} transaction{payments.length !== 1 ? 's' : ''} recorded</p>
                    </div>
                    <button
                        onClick={handlePrint}
                        className="flex items-center gap-1.5 text-[10px] font-black text-maroon uppercase tracking-widest hover:bg-maroon/5 px-3 py-2 rounded-xl transition-colors"
                    >
                        <Printer className="w-3.5 h-3.5" /> Print
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-gray-50/70">
                                <th className="px-6 sm:px-8 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest">#</th>
                                <th className="px-6 sm:px-8 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest">Date</th>
                                <th className="px-6 sm:px-8 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest">Reference</th>
                                <th className="px-6 sm:px-8 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest">Method</th>
                                <th className="px-6 sm:px-8 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest text-right">Amount</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {payments.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-8 py-16 text-center">
                                        <Receipt className="w-10 h-10 text-gray-100 mx-auto mb-3" />
                                        <p className="text-xs font-bold text-gray-300 uppercase tracking-widest">No payments recorded yet</p>
                                    </td>
                                </tr>
                            ) : payments.map((p, idx) => (
                                <tr key={p.id || idx} className="hover:bg-gray-50/70 transition-colors">
                                    <td className="px-6 sm:px-8 py-4 text-[10px] font-black text-gray-300">{idx + 1}</td>
                                    <td className="px-6 sm:px-8 py-4 text-xs font-bold text-gray-500">{new Date(p.payment_date).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                                    <td className="px-6 sm:px-8 py-4 text-xs font-black font-mono text-gray-700 uppercase">{p.transaction_ref}</td>
                                    <td className="px-6 sm:px-8 py-4">
                                        <span className="text-[9px] font-black px-2.5 py-1 bg-maroon/5 text-maroon rounded-lg uppercase tracking-widest">{p.method}</span>
                                    </td>
                                    <td className="px-6 sm:px-8 py-4 text-xs font-black text-emerald-700 text-right">KSh {fmt(p.amount)}</td>
                                </tr>
                            ))}
                        </tbody>
                        {payments.length > 0 && (
                            <tfoot>
                                <tr className="bg-maroon/[0.03] border-t-2 border-maroon/10">
                                    <td colSpan="4" className="px-6 sm:px-8 py-4 text-[10px] font-black text-maroon uppercase tracking-widest">Total Paid</td>
                                    <td className="px-6 sm:px-8 py-4 text-sm font-black text-maroon text-right">KSh {fmt(totalPaid)}</td>
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
function AdminFinanceView({ analytics, payments, studentFees, allStudents, onRecord, onViewReport }) {
    const [activeTab, setActiveTab] = useState('payments');
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
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
                <div>
                    <p className="text-[10px] font-black text-maroon/30 uppercase tracking-[0.3em] mb-1">Beautex Technical College</p>
                    <h1 className="text-2xl sm:text-3xl font-black text-maroon uppercase tracking-tight">Finance Centre</h1>
                    <div className="w-12 h-0.5 bg-gold mt-2" />
                    <p className="text-xs text-maroon/40 font-bold mt-1">Revenue Monitoring & Payment Registry</p>
                </div>
                <div className="flex flex-wrap gap-2 sm:gap-3 w-full sm:w-auto">
                    <button
                        onClick={() => window.print()}
                        className="flex-1 sm:flex-none bg-white border border-gray-200 text-maroon px-4 sm:px-5 py-3 rounded-2xl flex items-center justify-center gap-2 shadow-sm hover:bg-gray-50 transition-all font-black text-[10px] uppercase tracking-widest"
                    >
                        <Printer className="w-4 h-4" /> Print
                    </button>
                    <button
                        onClick={onRecord}
                        className="flex-1 sm:flex-none bg-maroon text-gold px-4 sm:px-6 py-3 rounded-2xl flex items-center justify-center gap-2 shadow-xl hover:bg-maroon/90 transition-all font-black text-[10px] uppercase tracking-widest border border-gold/20"
                    >
                        <Plus className="w-4 h-4" /> Record Payment
                    </button>
                </div>
            </div>

            {/* Analytics Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {[
                    { label: 'Expected Revenue', value: `KSh ${fmt(summary.total_revenue_expected)}`, icon: TrendingUp, bg: 'bg-blue-50', iconColor: 'text-blue-500', sub: 'Total fee obligations', trend: null },
                    { label: 'Total Collected', value: `KSh ${fmt(summary.total_revenue_collected)}`, icon: Banknote, bg: 'bg-emerald-50', iconColor: 'text-emerald-500', sub: `${collectionRate}% collection rate`, trend: 'up' },
                    { label: 'Outstanding', value: `KSh ${fmt(summary.total_outstanding)}`, icon: AlertCircle, bg: 'bg-red-50', iconColor: 'text-red-500', sub: 'Pending clearance', trend: null },
                    { label: 'Pending Accounts', value: summary.pending_accounts || 0, icon: Users, bg: 'bg-amber-50', iconColor: 'text-amber-500', sub: 'Students with balances', trend: null },
                ].map((stat, i) => (
                    <div key={i} className="bg-white rounded-[2rem] border border-gray-100 shadow-lg hover:-translate-y-1 transition-all p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div className={`w-11 h-11 ${stat.bg} rounded-2xl flex items-center justify-center`}>
                                <stat.icon className={`w-5 h-5 ${stat.iconColor}`} />
                            </div>
                            {stat.trend === 'up' && (
                                <div className="flex items-center gap-1 bg-emerald-50 text-emerald-600 px-2 py-1 rounded-lg">
                                    <ArrowUpRight className="w-3 h-3" />
                                    <span className="text-[9px] font-black">{collectionRate}%</span>
                                </div>
                            )}
                        </div>
                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">{stat.label}</p>
                        <p className="text-xl font-black text-gray-800 tracking-tight">{stat.value}</p>
                        <p className="text-[10px] text-gray-400 font-bold mt-1">{stat.sub}</p>
                    </div>
                ))}
            </div>

            {/* Collection Progress */}
            <div className="bg-white rounded-[2rem] border border-gray-100 shadow-lg p-6 sm:p-8">
                <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-maroon" />
                        <h3 className="text-xs font-black text-gray-800 uppercase tracking-[0.2em]">Collection Rate</h3>
                    </div>
                    <span className="text-sm font-black text-maroon">{collectionRate}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                    <div
                        className="h-3 rounded-full bg-gradient-to-r from-maroon to-gold transition-all duration-1000"
                        style={{ width: `${collectionRate}%` }}
                    />
                </div>
                <div className="flex justify-between text-[9px] font-black text-gray-400 uppercase tracking-widest mt-2">
                    <span>KSh 0</span>
                    <span>Target: KSh {fmt(summary.total_revenue_expected)}</span>
                </div>
            </div>

            {/* Tabs + Search */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-0">
                <div className="flex gap-1">
                    {[
                        { key: 'payments', label: 'Payment Registry', icon: Receipt },
                        { key: 'accounts', label: 'Student Accounts', icon: Users },
                    ].map(tab => (
                        <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                            className={`flex items-center gap-2 px-5 py-3 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all ${activeTab === tab.key ? 'border-maroon text-maroon' : 'border-transparent text-gray-400 hover:text-maroon'}`}>
                            <tab.icon className="w-3.5 h-3.5" />
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Search + Filter Bar */}
            <div className="flex flex-col sm:flex-row gap-3">
                <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search by name or reference..."
                    className="flex-1 px-5 py-3 bg-white border border-gray-200 rounded-2xl text-xs font-bold text-gray-700 outline-none focus:ring-2 focus:ring-maroon/10 placeholder-gray-300"
                />
                {activeTab === 'accounts' && (
                    <select
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value)}
                        className="px-5 py-3 bg-white border border-gray-200 rounded-2xl text-xs font-bold text-gray-700 outline-none focus:ring-2 focus:ring-maroon/10"
                    >
                        <option value="all">All Statuses</option>
                        <option value="Paid">Paid</option>
                        <option value="Partial">Partial</option>
                        <option value="Pending">Pending</option>
                        <option value="Overdue">Overdue</option>
                    </select>
                )}
            </div>

            {/* Payment Registry */}
            {activeTab === 'payments' && (
                <div className="bg-white rounded-[2rem] border border-gray-100 shadow-lg overflow-hidden">
                    <div className="px-6 sm:px-8 py-5 border-b border-gray-50">
                        <h3 className="text-xs font-black text-gray-800 uppercase tracking-[0.2em]">Global Payment Registry</h3>
                        <p className="text-[10px] text-gray-400 font-bold mt-0.5">{filteredPayments.length} transactions</p>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-gray-50/70">
                                    {['Student', 'Reference', 'Category', 'Method', 'Recorded By', 'Date', 'Amount', 'Action'].map(h => (
                                        <th key={h} className={`px-6 sm:px-8 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest ${h === 'Amount' ? 'text-right' : h === 'Action' ? 'text-center' : ''}`}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {filteredPayments.length === 0 ? (
                                    <tr><td colSpan="7" className="px-8 py-16 text-center">
                                        <Activity className="w-10 h-10 text-gray-100 mx-auto mb-3" />
                                        <p className="text-xs font-bold text-gray-300 uppercase tracking-widest">No payments found</p>
                                    </td></tr>
                                ) : filteredPayments.map((p, idx) => (
                                    <tr key={p._id || p.id || idx} className="hover:bg-gray-50/70 transition-colors">
                                        <td className="px-6 sm:px-8 py-4">
                                            <div className="flex flex-col">
                                                <span className="text-xs font-black text-gray-800">{p.student_name || '—'}</span>
                                                <span className="text-[9px] text-gray-400 font-bold uppercase">{p.student_id}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 sm:px-8 py-4 text-[10px] font-black font-mono text-gray-600 uppercase">{p.transaction_ref}</td>
                                        <td className="px-6 sm:px-8 py-4">
                                            <span className="text-[9px] font-black px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg uppercase tracking-widest">{p.category || 'Tuition Fee'}</span>
                                        </td>
                                        <td className="px-6 sm:px-8 py-4">
                                            <span className="text-[9px] font-black px-2.5 py-1 bg-maroon/5 text-maroon rounded-lg uppercase tracking-widest">{p.method}</span>
                                        </td>
                                        <td className="px-6 sm:px-8 py-4 text-[10px] font-bold text-gray-400">{p.recorded_by}</td>
                                        <td className="px-6 sm:px-8 py-4 text-[10px] font-bold text-gray-500">{new Date(p.payment_date).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                                        <td className="px-6 sm:px-8 py-4 text-xs font-black text-emerald-700 text-right">KSh {fmt(p.amount)}</td>
                                        <td className="px-6 sm:px-8 py-4 text-center">
                                            <button onClick={() => onViewReport({ type: 'payment', ...p })}
                                                className="p-2 hover:bg-maroon/5 rounded-xl transition-colors group" title="View Receipt">
                                                <Eye className="w-4 h-4 text-maroon/30 group-hover:text-maroon" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Student Accounts */}
            {activeTab === 'accounts' && (
                <div className="bg-white rounded-[2rem] border border-gray-100 shadow-lg overflow-hidden">
                    <div className="px-6 sm:px-8 py-5 border-b border-gray-50 flex justify-between items-center">
                        <div>
                            <h3 className="text-xs font-black text-gray-800 uppercase tracking-[0.2em]">Student Fee Accounts</h3>
                            <p className="text-[10px] text-gray-400 font-bold mt-0.5">{filteredFees.length} accounts</p>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-gray-50/70">
                                    {['Student', 'Course', 'Total Fee', 'Paid', 'Balance', 'Progress', 'Status', 'Action'].map(h => (
                                        <th key={h} className={`px-5 sm:px-7 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest ${['Total Fee', 'Paid', 'Balance'].includes(h) ? 'text-right' : h === 'Action' ? 'text-center' : ''}`}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {filteredFees.length === 0 ? (
                                    <tr><td colSpan="8" className="px-8 py-16 text-center">
                                        <PiggyBank className="w-10 h-10 text-gray-100 mx-auto mb-3" />
                                        <p className="text-xs font-bold text-gray-300 uppercase tracking-widest">No accounts found</p>
                                    </td></tr>
                                ) : filteredFees.map((f, idx) => {
                                    const pct = f.total_due > 0 ? Math.min((f.total_paid / f.total_due) * 100, 100) : 0;
                                    return (
                                        <tr key={f.student_id || idx} className="hover:bg-gray-50/70 transition-colors">
                                            <td className="px-5 sm:px-7 py-4 text-xs font-black text-gray-800">{f.student_name || f.student_id}</td>
                                            <td className="px-5 sm:px-7 py-4 text-[10px] font-bold text-gray-500 uppercase">{f.course || '—'}</td>
                                            <td className="px-5 sm:px-7 py-4 text-xs font-bold text-gray-700 text-right">KSh {fmt(f.total_due)}</td>
                                            <td className="px-5 sm:px-7 py-4 text-xs font-bold text-emerald-600 text-right">KSh {fmt(f.total_paid)}</td>
                                            <td className={`px-5 sm:px-7 py-4 text-xs font-black text-right ${f.balance > 0 ? 'text-red-500' : 'text-emerald-600'}`}>KSh {fmt(f.balance)}</td>
                                            <td className="px-5 sm:px-7 py-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-20 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                                                        <div className={`h-1.5 rounded-full ${pct >= 100 ? 'bg-emerald-500' : pct > 50 ? 'bg-amber-500' : 'bg-red-400'}`} style={{ width: `${pct}%` }} />
                                                    </div>
                                                    <span className="text-[9px] font-black text-gray-400">{pct.toFixed(0)}%</span>
                                                </div>
                                            </td>
                                            <td className="px-5 sm:px-7 py-4"><StatusBadge status={f.status} /></td>
                                            <td className="px-5 sm:px-7 py-4 text-center">
                                                <button onClick={() => onViewReport({ type: 'account', ...f })}
                                                    className="p-2 hover:bg-maroon/5 rounded-xl transition-colors group" title="View Statement">
                                                    <Eye className="w-4 h-4 text-maroon/30 group-hover:text-maroon" />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
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
                    onRecord={() => setShowModal(true)}
                    onViewReport={setViewingReport}
                />
            )}

            {/* Record Payment Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-md flex items-center justify-center p-4 z-50">
                    <div className="bg-white border border-maroon/10 rounded-[2.5rem] p-8 sm:p-10 max-w-lg w-full shadow-2xl relative">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-maroon via-gold to-maroon rounded-t-[2.5rem]" />
                        <div className="flex justify-between items-center mb-8">
                            <div>
                                <h2 className="text-xl font-black text-maroon uppercase tracking-tight">Record Payment</h2>
                                <div className="w-10 h-0.5 bg-gold mt-2" />
                                <p className="text-[10px] text-maroon/30 font-black uppercase tracking-widest mt-1">Finance Registry Entry</p>
                            </div>
                            <button onClick={() => setShowModal(false)} className="p-2 hover:bg-maroon/5 rounded-full transition-colors">
                                <X className="w-5 h-5 text-maroon/30" />
                            </button>
                        </div>
                        <form onSubmit={handleRecordPayment} className="space-y-4">
                            {/* Selected Student Info Reference */}
                            {paymentForm.student_id && (() => {
                                const fee = studentFees.find(f => f.student_id === paymentForm.student_id);
                                if (!fee) return null;
                                return (
                                    <div className="flex justify-between items-center p-4 bg-emerald-50 rounded-2xl border border-emerald-100 mb-2">
                                        <div>
                                            <p className="text-[8px] font-black text-emerald-600 uppercase tracking-widest">Current Balance</p>
                                            <p className="text-sm font-black text-emerald-700">KSh {fmt(fee.balance)}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[8px] font-black text-emerald-600 uppercase tracking-widest text-right">Progress</p>
                                            <p className="text-[10px] font-bold text-emerald-700">{fee.total_due > 0 ? ((fee.total_paid / fee.total_due) * 100).toFixed(0) : 0}% Paid</p>
                                        </div>
                                    </div>
                                );
                            })()}

                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-maroon/50 uppercase tracking-widest ml-1">Student *</label>
                                <select value={paymentForm.student_id}
                                    onChange={e => setPaymentForm({ ...paymentForm, student_id: e.target.value })}
                                    className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold text-gray-800 outline-none focus:ring-2 focus:ring-maroon/10" required>
                                    <option value="">Select Student</option>
                                    {allStudents.map(s => (
                                        <option key={s.id} value={s.id}>{s.name} — {s.id}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-maroon/50 uppercase tracking-widest ml-1">Amount (KSh) *</label>
                                    <input type="number" min="1" value={paymentForm.amount}
                                        onChange={e => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                                        className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold text-gray-800 outline-none focus:ring-2 focus:ring-maroon/10"
                                        placeholder="e.g. 5000" required />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-maroon/50 uppercase tracking-widest ml-1">Method *</label>
                                    <select value={paymentForm.method}
                                        onChange={e => setPaymentForm({ ...paymentForm, method: e.target.value })}
                                        className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold text-gray-800 outline-none focus:ring-2 focus:ring-maroon/10">
                                        {['M-Pesa', 'Bank Transfer', 'Cash', 'Cheque'].map(m => <option key={m}>{m}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-maroon/50 uppercase tracking-widest ml-1">Transaction Reference *</label>
                                <input type="text" value={paymentForm.transaction_ref}
                                    onChange={e => setPaymentForm({ ...paymentForm, transaction_ref: e.target.value })}
                                    className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold font-mono text-gray-800 outline-none focus:ring-2 focus:ring-maroon/10"
                                    placeholder="e.g. QAB12345XY" required />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-maroon/50 uppercase tracking-widest ml-1">Fee Category *</label>
                                    <select value={paymentForm.category}
                                        onChange={e => setPaymentForm({ ...paymentForm, category: e.target.value })}
                                        className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold text-gray-800 outline-none focus:ring-2 focus:ring-maroon/10">
                                        {['Tuition Fee', 'Registration', 'Exam Fee', 'Uniform', 'Hostel', 'Graduation', 'Library', 'Other'].map(c => <option key={c}>{c}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-maroon/50 uppercase tracking-widest ml-1">Semester/Period *</label>
                                    <input type="text" value={paymentForm.semester}
                                        onChange={e => setPaymentForm({ ...paymentForm, semester: e.target.value })}
                                        className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold text-gray-800 outline-none focus:ring-2 focus:ring-maroon/10"
                                        placeholder="e.g. Semester 1 or Term 2" required />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-maroon/50 uppercase tracking-widest ml-1">Academic Year *</label>
                                <input type="text" value={paymentForm.academic_year}
                                    onChange={e => setPaymentForm({ ...paymentForm, academic_year: e.target.value })}
                                    className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold text-gray-800 outline-none focus:ring-2 focus:ring-maroon/10"
                                    placeholder="2023/2024" />
                            </div>

                            <div className="grid grid-cols-3 gap-3 p-4 bg-maroon/5 rounded-[2rem] border border-maroon/10">
                                <div className="space-y-1">
                                    <label className="text-[9px] font-black text-maroon/60 uppercase tracking-widest ml-1">Total Fee</label>
                                    <input type="number" value={paymentForm.manual_total_due}
                                        onChange={e => setPaymentForm({ ...paymentForm, manual_total_due: e.target.value })}
                                        className="w-full px-4 py-3 bg-white border border-gray-100 rounded-xl text-xs font-bold text-gray-800 outline-none focus:ring-2 focus:ring-maroon/10"
                                        placeholder="Manual Fee" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[9px] font-black text-maroon/60 uppercase tracking-widest ml-1">Fee Paid</label>
                                    <input type="number" value={paymentForm.manual_total_paid}
                                        onChange={e => setPaymentForm({ ...paymentForm, manual_total_paid: e.target.value })}
                                        className="w-full px-4 py-3 bg-white border border-gray-100 rounded-xl text-xs font-bold text-gray-800 outline-none focus:ring-2 focus:ring-maroon/10"
                                        placeholder="Total Paid" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[9px] font-black text-maroon/60 uppercase tracking-widest ml-1">Balance</label>
                                    <input type="number" value={paymentForm.manual_balance}
                                        onChange={e => setPaymentForm({ ...paymentForm, manual_balance: e.target.value })}
                                        className="w-full px-4 py-3 bg-white border border-gray-100 rounded-xl text-xs font-bold text-gray-800 outline-none focus:ring-2 focus:ring-maroon/10"
                                        placeholder="Current Bal" />
                                </div>
                                <p className="col-span-3 text-[8px] text-maroon/40 font-bold italic text-center">* Leave blank for automatic calculation based on payment amount.</p>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-maroon/50 uppercase tracking-widest ml-1">Additional Remarks</label>
                                <textarea value={paymentForm.remarks}
                                    onChange={e => setPaymentForm({ ...paymentForm, remarks: e.target.value })}
                                    className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-xs font-bold text-gray-800 outline-none focus:ring-2 focus:ring-maroon/10 min-h-[80px]"
                                    placeholder="Any additional details..." />
                            </div>
                            <button type="submit" disabled={saving}
                                className="w-full bg-maroon text-gold py-4 rounded-2xl font-black text-sm uppercase tracking-[0.2em] hover:bg-maroon/90 shadow-xl transition-all border border-gold/20 disabled:opacity-60 flex items-center justify-center gap-2">
                                {saving ? (<><div className="animate-spin w-4 h-4 border-2 border-gold/40 border-t-gold rounded-full" /> Recording...</>) : (<><CheckCircle2 className="w-4 h-4" /> Record Payment</>)}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* View Report Modal */}
            {viewingReport && (
                <div className="fixed inset-0 bg-maroon/50 backdrop-blur-md flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-[2.5rem] p-8 sm:p-10 max-w-xl w-full shadow-2xl relative max-h-[90vh] flex flex-col overflow-hidden">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-maroon via-gold to-maroon rounded-t-[2.5rem]" />
                        <div className="flex justify-between items-center mb-6 shrink-0">
                            <div>
                                <h2 className="text-xl font-black text-maroon uppercase tracking-tight">
                                    {viewingReport.type === 'payment' ? 'Transaction Receipt' : 'Account Statement'}
                                </h2>
                                <div className="w-10 h-0.5 bg-gold mt-2" />
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => handleDownload(viewingReport, viewingReport.type === 'payment' ? 'Receipt' : 'Statement')} className="p-2 bg-maroon/5 hover:bg-maroon hover:text-white rounded-xl transition-all" title="Download PDF">
                                    <FileDown className="w-5 h-5" />
                                </button>
                                <button onClick={() => { setPrintingReport({ data: viewingReport, title: viewingReport.type === 'payment' ? 'Receipt' : 'Statement' }); setTimeout(() => { window.print(); setPrintingReport(null); }, 800); }} className="p-2 bg-maroon/5 hover:bg-maroon hover:text-white rounded-xl transition-all" title="Print">
                                    <Printer className="w-5 h-5" />
                                </button>
                                <button onClick={() => setViewingReport(null)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                                    <X className="w-5 h-5 text-gray-400" />
                                </button>
                            </div>
                        </div>
                        <div className="overflow-y-auto space-y-6 pr-1">
                            <div className="flex flex-col items-center pb-6 border-b border-maroon/5">
                                <img src="/logo.jpg" alt="Logo" className="w-16 h-16 mb-3 object-contain" onError={e => e.target.style.display = 'none'} />
                                <h3 className="text-sm font-black text-maroon uppercase text-center">Beautex Technical Training College</h3>
                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Finance Department • Official Document</p>
                            </div>
                            <div className="grid grid-cols-2 gap-5">
                                {[
                                    { label: 'Student Name', value: viewingReport.student_name || viewingReport.student_id },
                                    { label: 'Student ID', value: viewingReport.student_id },
                                    ...(viewingReport.type === 'payment' ? [
                                        { label: 'Reference No.', value: viewingReport.transaction_ref, mono: true },
                                        { label: 'Payment Method', value: viewingReport.method },
                                        { label: 'Payment Date', value: new Date(viewingReport.payment_date).toLocaleDateString('en-KE', { day: '2-digit', month: 'long', year: 'numeric' }) },
                                        { label: 'Fee Category', value: viewingReport.category },
                                        { label: 'Semester/Period', value: viewingReport.semester },
                                        { label: 'Academic Year', value: viewingReport.academic_year },
                                        { label: 'Recorded By', value: viewingReport.recorded_by },
                                        { label: 'Remarks', value: viewingReport.remarks },
                                    ] : [
                                        { label: 'Course Program', value: viewingReport.course },
                                        { label: 'Account Status', value: viewingReport.status },
                                        { label: 'Total Fee Due', value: `KSh ${fmt(viewingReport.total_due)}` },
                                        { label: 'Total Paid', value: `KSh ${fmt(viewingReport.total_paid)}` },
                                    ])
                                ].map((item, i) => (
                                    <div key={i}>
                                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">{item.label}</p>
                                        <p className={`text-sm font-black text-gray-800 uppercase ${item.mono ? 'font-mono' : ''}`}>{item.value || '—'}</p>
                                    </div>
                                ))}
                            </div>
                            <div className="bg-gradient-to-br from-maroon to-maroon/80 p-6 rounded-2xl text-white">
                                <p className="text-[10px] font-black uppercase tracking-widest text-white/60 mb-2">
                                    {viewingReport.type === 'payment' ? 'Amount Received' : 'Outstanding Balance'}
                                </p>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-lg font-black text-gold">KSh</span>
                                    <span className="text-4xl font-black tracking-tighter text-gold">
                                        {fmt(viewingReport.type === 'payment' ? viewingReport.amount : viewingReport.balance)}
                                    </span>
                                </div>
                            </div>
                            <div className="text-center pt-4 border-t border-maroon/5">
                                <p className="text-[8px] text-gray-400 uppercase tracking-widest leading-relaxed">
                                    Contact: 0708247557 | Email: beautexcollege01@gmail.com<br />
                                    Computer-generated document. © {new Date().getFullYear()} Beautex Technical Training College
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Hidden Print Capture Area */}
            {printingReport && (
                <div className="fixed inset-0 bg-white z-[-1] pointer-events-none opacity-0">
                    <div id="finance-report-capture" className="p-10 w-[210mm] min-h-[297mm] bg-white text-maroon font-serif">
                        <div className="border-4 border-double border-maroon p-10 min-h-full flex flex-col justify-between">
                            <div>
                                <div className="text-center mb-10 pb-10 border-b-2 border-maroon">
                                    <img src="/logo.jpg" alt="Logo" className="w-24 h-24 mx-auto mb-4 object-contain" />
                                    <h1 className="text-2xl font-black uppercase tracking-widest">Beautex Technical Training College</h1>
                                    <p className="text-xs font-bold text-gray-500 tracking-[0.3em] uppercase mt-2 italic">Official Finance Document</p>
                                </div>
                                <div className="mb-10">
                                    <h2 className="text-xl font-black uppercase mb-6">{printingReport.title}</h2>
                                    <div className="grid grid-cols-2 gap-8">
                                        <div>
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Generated Date</p>
                                            <p className="text-sm font-bold">{new Date().toLocaleDateString()}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Reference</p>
                                            <p className="text-sm font-bold uppercase">BTTC-FIN-{Math.random().toString(36).substring(7).toUpperCase()}</p>
                                        </div>
                                    </div>
                                </div>
                                {Array.isArray(printingReport.data) ? (
                                    <table className="w-full text-left border-collapse border border-maroon/10">
                                        <thead>
                                            <tr className="bg-maroon/5">
                                                {Object.keys(printingReport.data[0] || {}).filter(k => !['_id', 'id', 'type'].includes(k)).map(key => (
                                                    <th key={key} className="p-3 border border-maroon/10 text-[10px] font-black uppercase">{key.replace(/_/g, ' ')}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {printingReport.data.map((row, i) => (
                                                <tr key={i}>
                                                    {Object.entries(row).filter(([k]) => !['_id', 'id', 'type'].includes(k)).map(([k, v]) => (
                                                        <td key={k} className="p-3 border border-maroon/10 text-[10px]">
                                                            {typeof v === 'string' && v.includes('T') && !isNaN(Date.parse(v)) ? new Date(v).toLocaleDateString() : (typeof v === 'number' ? v.toLocaleString() : String(v || '—'))}
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                ) : (
                                    <div className="space-y-6">
                                        <div className="grid grid-cols-2 gap-8 py-6 border-y border-maroon/10">
                                            {Object.entries(printingReport.data).filter(([k]) => !['_id', 'id', 'type'].includes(k)).map(([k, v]) => (
                                                <div key={k}>
                                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{k.replace(/_/g, ' ')}</p>
                                                    <p className="text-sm font-bold uppercase">{typeof v === 'string' && v.includes('T') && !isNaN(Date.parse(v)) ? new Date(v).toLocaleDateString() : (typeof v === 'number' ? v.toLocaleString() : String(v || '—'))}</p>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="bg-maroon/5 p-8 text-center border-2 border-maroon border-dashed">
                                            <p className="text-[10px] font-black uppercase mb-2">Total Amount</p>
                                            <p className="text-4xl font-black">KSh {fmt(printingReport.data.amount || printingReport.data.balance)}</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="text-center pt-10 border-t border-maroon mt-10">
                                <p className="text-xs font-black uppercase tracking-widest mb-2">Beautex Technical Training College</p>
                                <p className="text-[8px] text-gray-400 uppercase tracking-[0.2em]">Contact: 0708247557 | Email: beautexcollege01@gmail.com | © {new Date().getFullYear()}</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
