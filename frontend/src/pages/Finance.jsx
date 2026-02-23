import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { financeAPI, studentsAPI } from '../services/api';
import { CreditCard, TrendingUp, AlertCircle, CheckCircle, Download, Plus, X, DollarSign, Printer } from 'lucide-react';

const EMPTY_PAYMENT = { student_id: '', amount: '', method: 'M-Pesa', transaction_ref: '' };

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
    const [activeTab, setActiveTab] = useState('payments');

    useEffect(() => {
        if (user?.role === 'student') {
            fetchStudentData();
        } else {
            fetchAdminData();
        }
    }, [user]);

    const fetchStudentData = async () => {
        try {
            const studentId = user.studentId || user.id;
            const [feeRes, payRes] = await Promise.all([
                financeAPI.getStudentFees(studentId).catch(() => ({ data: null })),
                financeAPI.getPayments(studentId).catch(() => ({ data: [] }))
            ]);
            setStudentFee(feeRes.data);
            setPayments(Array.isArray(payRes.data) ? payRes.data : []);
        } catch (error) {
            console.error('Error fetching student finance:', error);
        } finally {
            setLoading(false);
        }
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
        } catch (error) {
            console.error('Error fetching admin finance:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleRecordPayment = async (e) => {
        e.preventDefault();
        if (!paymentForm.student_id || !paymentForm.amount || !paymentForm.transaction_ref) {
            alert('Please fill in all required fields.');
            return;
        }
        try {
            setSaving(true);
            await financeAPI.recordPayment({
                ...paymentForm,
                amount: parseFloat(paymentForm.amount)
            });
            setShowModal(false);
            setPaymentForm(EMPTY_PAYMENT);
            fetchAdminData();
            alert('Payment recorded successfully!');
        } catch (error) {
            alert(error.response?.data?.error || 'Failed to record payment.');
        } finally {
            setSaving(false);
        }
    };

    const handleExportReport = () => {
        const rows = [
            ['Student', 'Reference', 'Method', 'Recorded By', 'Amount (KSh)', 'Date'],
            ...payments.map(p => [
                p.student_name || p.student_id,
                p.transaction_ref,
                p.method,
                p.recorded_by,
                p.amount,
                new Date(p.payment_date).toLocaleDateString()
            ])
        ];
        const csv = rows.map(r => r.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `finance-report-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-maroon"></div>
        </div>
    );

    // Student View
    if (user?.role === 'student') {
        return (
            <div className="space-y-6 animate-in fade-in duration-700">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-8 gap-4">
                    <div>
                        <p className="text-[10px] font-black text-maroon/30 uppercase tracking-[0.3em] mb-1">Beautex Training Centre</p>
                        <h1 className="text-2xl sm:text-3xl font-black text-maroon uppercase tracking-tight">My Fee Account</h1>
                        <div className="w-12 h-0.5 bg-gold mt-2" />
                    </div>
                    <button
                        onClick={() => alert('M-Pesa integration: Dial *334# and use Paybill 123456, Account: ' + (user.studentId || user.id))}
                        className="w-full sm:w-auto bg-maroon text-gold px-6 py-3 rounded-2xl flex items-center justify-center gap-2 shadow-xl hover:scale-105 transition-transform cursor-pointer border border-gold/20"
                    >
                        <CreditCard className="w-4 h-4" />
                        <span className="text-xs font-black uppercase tracking-widest">Pay with M-Pesa</span>
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[
                        { label: 'Total Amount Due', value: studentFee?.total_due || 0, color: 'text-maroon' },
                        { label: 'Total Amount Paid', value: studentFee?.total_paid || 0, color: 'text-green-600' },
                        { label: 'Current Balance', value: studentFee?.balance || 0, color: 'text-red-600' },
                    ].map((item, i) => (
                        <div key={i} className="bg-white p-6 sm:p-8 rounded-[2rem] border border-gray-100 shadow-xl">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">{item.label}</p>
                            <div className="flex items-baseline gap-1">
                                <span className="text-xs font-black text-maroon/40 uppercase">KSh</span>
                                <h3 className={`text-4xl font-black tracking-tighter ${item.color}`}>
                                    {(item.value || 0).toLocaleString()}
                                </h3>
                            </div>
                        </div>
                    ))}
                </div>

                {studentFee && (
                    <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-center gap-3">
                        <span className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest ${studentFee.status === 'Paid' ? 'bg-green-100 text-green-700' :
                            studentFee.status === 'Partial' ? 'bg-yellow-100 text-yellow-700' :
                                'bg-red-100 text-red-700'
                            }`}>
                            {studentFee.status}
                        </span>
                        <span className="text-xs font-bold text-gray-500">
                            {studentFee.status === 'Paid' ? 'Your fee account is fully settled.' :
                                studentFee.status === 'Partial' ? 'Partial payment received. Please clear the balance.' :
                                    'No payments recorded yet.'}
                        </span>
                    </div>
                )}

                <div className="table-container custom-scrollbar mt-8">
                    <div className="px-8 py-6 border-b border-gray-50 flex justify-between items-center">
                        <h3 className="text-xs font-black text-gray-800 uppercase tracking-[0.2em]">Payment History</h3>
                        <button
                            onClick={() => window.print()}
                            className="text-[10px] font-black text-maroon uppercase tracking-widest hover:underline flex items-center gap-1"
                        >
                            <Printer className="w-3 h-3" /> Print Receipt
                        </button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-gray-50/50">
                                    <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Date</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Transaction Ref</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Method</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Amount</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {payments.map(p => (
                                    <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-8 py-4 text-xs font-bold text-gray-500">{new Date(p.payment_date).toLocaleDateString()}</td>
                                        <td className="px-8 py-4 text-xs font-black text-gray-800">{p.transaction_ref}</td>
                                        <td className="px-8 py-4">
                                            <span className="text-[9px] font-black px-2 py-1 bg-gray-100 rounded-lg uppercase tracking-widest">{p.method}</span>
                                        </td>
                                        <td className="px-8 py-4 text-xs font-black text-gray-800 text-right">KSh {Number(p.amount).toLocaleString()}</td>
                                    </tr>
                                ))}
                                {payments.length === 0 && (
                                    <tr>
                                        <td colSpan="4" className="px-8 py-12 text-center text-xs font-bold text-gray-300 uppercase tracking-widest">No payments recorded</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    }

    // Admin/SuperAdmin View
    const summary = analytics?.summary || {};
    return (
        <div className="space-y-6 animate-in fade-in duration-700">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-8 gap-4">
                <div>
                    <p className="text-[10px] font-black text-maroon/30 uppercase tracking-[0.3em] mb-1">Beautex Training Centre</p>
                    <h1 className="text-2xl sm:text-3xl font-black text-maroon uppercase tracking-tight">Finance Center</h1>
                    <div className="w-12 h-0.5 bg-gold mt-2" />
                    <p className="text-xs text-maroon/40 font-bold mt-1">Revenue Monitoring & Payment Registry</p>
                </div>
                <div className="flex flex-wrap gap-2 sm:gap-3 w-full sm:w-auto">
                    <button
                        onClick={handleExportReport}
                        className="flex-1 sm:flex-none bg-white border border-gray-200 text-maroon px-4 sm:px-6 py-3 rounded-2xl flex items-center justify-center gap-2 shadow-sm hover:bg-gray-50 transition-all font-black text-[10px] uppercase tracking-widest"
                    >
                        <Download className="w-4 h-4" /> Export CSV
                    </button>
                    <button
                        onClick={() => setShowModal(true)}
                        className="flex-1 sm:flex-none bg-maroon text-gold px-4 sm:px-6 py-3 rounded-2xl flex items-center justify-center gap-2 shadow-xl hover:bg-maroon/90 transition-all font-black text-[10px] uppercase tracking-widest border border-gold/20"
                    >
                        <Plus className="w-4 h-4" /> Record Payment
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: 'Expected Revenue', value: summary.total_revenue_expected, icon: TrendingUp, color: 'text-gray-800', prefix: 'KSh ' },
                    { label: 'Collected', value: summary.total_revenue_collected, icon: DollarSign, color: 'text-green-600', prefix: 'KSh ' },
                    { label: 'Outstanding', value: summary.total_outstanding, icon: AlertCircle, color: 'text-red-500', prefix: 'KSh ' },
                    { label: 'Pending Accounts', value: summary.pending_accounts, icon: CreditCard, color: 'text-orange-500', prefix: '' }
                ].map((stat, i) => (
                    <div key={i} className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-xl group hover:-translate-y-1 transition-all">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-3 bg-gray-50 rounded-2xl">
                                <stat.icon className={`w-5 h-5 ${stat.color}`} />
                            </div>
                        </div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{stat.label}</p>
                        <h3 className={`text-2xl font-black tracking-tighter ${stat.color}`}>
                            {stat.prefix}{(stat.value || 0).toLocaleString()}
                        </h3>
                    </div>
                ))}
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-gray-100">
                {['payments', 'accounts'].map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab)}
                        className={`px-6 py-3 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all ${activeTab === tab ? 'border-maroon text-maroon' : 'border-transparent text-gray-400 hover:text-maroon'
                            }`}>
                        {tab === 'payments' ? 'Payment Registry' : 'Student Accounts'}
                    </button>
                ))}
            </div>

            {/* Payment Registry Table */}
            {activeTab === 'payments' && (
                <div className="table-container custom-scrollbar">
                    <div className="px-8 py-6 border-b border-gray-50">
                        <h3 className="text-xs font-black text-gray-800 uppercase tracking-[0.2em]">Global Payment Registry</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-gray-50/50">
                                    <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Student</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Reference</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Method</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Recorded By</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Date</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Amount</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {payments.map(p => (
                                    <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-8 py-4">
                                            <div className="flex flex-col">
                                                <span className="text-xs font-black text-gray-800">{p.student_name || p.student_id}</span>
                                                <span className="text-[9px] text-gray-400 font-bold uppercase">{p.student_id}</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-4 text-[10px] font-black font-mono text-gray-500 uppercase">{p.transaction_ref}</td>
                                        <td className="px-8 py-4">
                                            <span className="text-[9px] font-black px-2 py-1 bg-maroon/5 text-maroon rounded-lg uppercase tracking-widest">{p.method}</span>
                                        </td>
                                        <td className="px-8 py-4 text-[10px] font-bold text-gray-400">{p.recorded_by}</td>
                                        <td className="px-8 py-4 text-[10px] font-bold text-gray-400">{new Date(p.payment_date).toLocaleDateString()}</td>
                                        <td className="px-8 py-4 text-xs font-black text-gray-800 text-right">KSh {Number(p.amount).toLocaleString()}</td>
                                    </tr>
                                ))}
                                {payments.length === 0 && (
                                    <tr>
                                        <td colSpan="6" className="px-8 py-16 text-center text-xs font-bold text-gray-300 uppercase tracking-widest">No payments recorded yet</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Student Accounts Table */}
            {activeTab === 'accounts' && (
                <div className="table-container custom-scrollbar">
                    <div className="px-8 py-6 border-b border-gray-50">
                        <h3 className="text-xs font-black text-gray-800 uppercase tracking-[0.2em]">Student Fee Accounts</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-gray-50/50">
                                    <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Student</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Course</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Total Due</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Paid</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Balance</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {studentFees.map(f => (
                                    <tr key={f.student_id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-8 py-4 text-xs font-black text-gray-800">{f.student_name || f.student_id}</td>
                                        <td className="px-8 py-4 text-[10px] font-bold text-gray-500 uppercase">{f.course}</td>
                                        <td className="px-8 py-4 text-xs font-bold text-gray-700 text-right">KSh {Number(f.total_due || 0).toLocaleString()}</td>
                                        <td className="px-8 py-4 text-xs font-bold text-green-600 text-right">KSh {Number(f.total_paid || 0).toLocaleString()}</td>
                                        <td className="px-8 py-4 text-xs font-bold text-red-500 text-right">KSh {Number(f.balance || 0).toLocaleString()}</td>
                                        <td className="px-8 py-4">
                                            <span className={`text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest ${f.status === 'Paid' ? 'bg-green-100 text-green-700' :
                                                f.status === 'Partial' ? 'bg-yellow-100 text-yellow-700' :
                                                    'bg-red-100 text-red-700'
                                                }`}>{f.status || 'Unpaid'}</span>
                                        </td>
                                    </tr>
                                ))}
                                {studentFees.length === 0 && (
                                    <tr>
                                        <td colSpan="6" className="px-8 py-16 text-center text-xs font-bold text-gray-300 uppercase tracking-widest">No fee accounts found</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {showModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 z-50">
                    <div className="bg-white border border-maroon/10 rounded-2xl sm:rounded-[2.5rem] p-6 sm:p-10 max-w-lg w-full shadow-2xl relative max-h-[95vh] flex flex-col">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-maroon via-gold to-maroon opacity-60 rounded-t-[2.5rem]" />
                        <div className="flex justify-between items-center mb-8">
                            <div>
                                <h2 className="text-2xl font-black text-maroon uppercase tracking-tight">Record Payment</h2>
                                <div className="w-10 h-0.5 bg-gold mt-2" />
                                <p className="text-[10px] text-maroon/30 font-black uppercase tracking-widest mt-1">Finance Registry Entry</p>
                            </div>
                            <button onClick={() => setShowModal(false)} className="p-2 hover:bg-maroon/5 rounded-full transition-colors">
                                <X className="w-6 h-6 text-maroon/30" />
                            </button>
                        </div>

                        <form onSubmit={handleRecordPayment} className="space-y-5">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-maroon/40 uppercase tracking-widest ml-1">Student *</label>
                                <select
                                    value={paymentForm.student_id}
                                    onChange={e => setPaymentForm({ ...paymentForm, student_id: e.target.value })}
                                    className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-maroon font-bold outline-none focus:ring-2 focus:ring-maroon/10"
                                    required
                                >
                                    <option value="">Select Student</option>
                                    {allStudents.map(s => (
                                        <option key={s.id} value={s.id}>{s.name} — {s.id}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-5">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-maroon/40 uppercase tracking-widest ml-1">Amount (KSh) *</label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={paymentForm.amount}
                                        onChange={e => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                                        className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-maroon font-bold outline-none focus:ring-2 focus:ring-maroon/10"
                                        placeholder="e.g. 5000"
                                        required
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-maroon/40 uppercase tracking-widest ml-1">Method *</label>
                                    <select
                                        value={paymentForm.method}
                                        onChange={e => setPaymentForm({ ...paymentForm, method: e.target.value })}
                                        className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-maroon font-bold outline-none focus:ring-2 focus:ring-maroon/10"
                                    >
                                        <option value="M-Pesa">M-Pesa</option>
                                        <option value="Bank Transfer">Bank Transfer</option>
                                        <option value="Cash">Cash</option>
                                        <option value="Cheque">Cheque</option>
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-maroon/40 uppercase tracking-widest ml-1">Transaction Reference *</label>
                                <input
                                    type="text"
                                    value={paymentForm.transaction_ref}
                                    onChange={e => setPaymentForm({ ...paymentForm, transaction_ref: e.target.value })}
                                    className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-maroon font-bold outline-none focus:ring-2 focus:ring-maroon/10 font-mono"
                                    placeholder="e.g. QAB12345XY"
                                    required
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={saving}
                                className="w-full bg-maroon text-gold py-5 rounded-2xl font-black text-sm uppercase tracking-[0.2em] hover:bg-maroon/90 shadow-xl transition-all border border-gold/20 disabled:opacity-60"
                            >
                                {saving ? 'Recording...' : 'Record Payment'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
