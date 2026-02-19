import { useEffect, useState } from 'react';
import { academicAPI } from '../services/api';
import { Building2, Calendar, Plus, Trash2, Edit, CheckCircle2, X } from 'lucide-react';

const EMPTY_DEPT = { name: '', head_of_department: '', description: '' };
const EMPTY_PERIOD = { name: '', start_date: '', end_date: '' };

export default function AcademicMaster() {
    const [departments, setDepartments] = useState([]);
    const [periods, setPeriods] = useState([]);
    const [loading, setLoading] = useState(true);

    const [showDeptModal, setShowDeptModal] = useState(false);
    const [editingDept, setEditingDept] = useState(null);
    const [deptForm, setDeptForm] = useState(EMPTY_DEPT);
    const [savingDept, setSavingDept] = useState(false);

    const [showPeriodModal, setShowPeriodModal] = useState(false);
    const [periodForm, setPeriodForm] = useState(EMPTY_PERIOD);
    const [savingPeriod, setSavingPeriod] = useState(false);

    useEffect(() => { fetchData(); }, []);

    const fetchData = async (silent = false) => {
        try {
            if (!silent) setLoading(true);
            const [deptRes, periodRes] = await Promise.all([
                academicAPI.getDepartments().catch(() => ({ data: [] })),
                academicAPI.getPeriods().catch(() => ({ data: [] }))
            ]);
            setDepartments(Array.isArray(deptRes.data) ? deptRes.data : []);
            setPeriods(Array.isArray(periodRes.data) ? periodRes.data : []);
        } catch (error) {
            console.error('Error fetching academic data:', error);
        } finally {
            if (!silent) setLoading(false);
        }
    };

    const handleActivatePeriod = async (id) => {
        try {
            await academicAPI.activatePeriod(id);
            fetchData(true);
        } catch (error) {
            alert('Failed to activate period.');
        }
    };

    const openNewDept = () => {
        setEditingDept(null);
        setDeptForm(EMPTY_DEPT);
        setShowDeptModal(true);
    };

    const openEditDept = (dept) => {
        setEditingDept(dept);
        setDeptForm({ name: dept.name, head_of_department: dept.head_of_department || '', description: dept.description || '' });
        setShowDeptModal(true);
    };

    const handleDeptSubmit = async (e) => {
        e.preventDefault();
        if (!deptForm.name.trim()) { alert('Department name is required.'); return; }
        try {
            setSavingDept(true);
            await academicAPI.createDepartment(deptForm);
            setShowDeptModal(false);
            setDeptForm(EMPTY_DEPT);
            fetchData(true);
        } catch (error) {
            alert(error.response?.data?.error || 'Failed to save department.');
        } finally {
            setSavingDept(false);
        }
    };

    const handlePeriodSubmit = async (e) => {
        e.preventDefault();
        if (!periodForm.name || !periodForm.start_date || !periodForm.end_date) {
            alert('Please fill in all period fields.');
            return;
        }
        try {
            setSavingPeriod(true);
            await academicAPI.createPeriod(periodForm);
            setShowPeriodModal(false);
            setPeriodForm(EMPTY_PERIOD);
            fetchData(true);
        } catch (error) {
            alert(error.response?.data?.error || 'Failed to create academic period.');
        } finally {
            setSavingPeriod(false);
        }
    };

    if (loading) return (
        <div className="flex items-center justify-center min-h-[400px]">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-maroon"></div>
        </div>
    );

    const activePeriod = periods.find(p => p.is_active);

    return (
        <div className="space-y-12 animate-in fade-in duration-700 pb-12">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                    <p className="text-[10px] font-black text-maroon/30 uppercase tracking-[0.3em] mb-1">Beautex Training Centre</p>
                    <h1 className="text-3xl font-black text-maroon uppercase tracking-tight">Academic Master</h1>
                    <div className="w-12 h-0.5 bg-gold mt-2" />
                    <p className="text-xs text-maroon/40 font-bold mt-1">Campus Infrastructure & Timeline Management</p>
                </div>
                {activePeriod && (
                    <div className="bg-green-50 border border-green-200 rounded-2xl px-5 py-3 flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                        <span className="text-xs font-black text-green-700 uppercase tracking-widest">Active: {activePeriod.name}</span>
                    </div>
                )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: 'Departments', value: departments.length },
                    { label: 'Academic Periods', value: periods.length },
                    { label: 'Active Period', value: activePeriod ? activePeriod.name : 'None' },
                    { label: 'Completed Periods', value: periods.filter(p => p.status === 'Completed').length },
                ].map((s, i) => (
                    <div key={i} className="bg-white border border-maroon/8 rounded-2xl p-5 shadow-sm">
                        <p className="text-2xl font-black text-maroon">{s.value}</p>
                        <p className="text-[9px] font-black text-maroon/30 uppercase tracking-widest mt-1">{s.label}</p>
                    </div>
                ))}
            </div>

            {/* Departments */}
            <section>
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xs font-black text-maroon uppercase tracking-[0.3em] flex items-center gap-2">
                        <Building2 className="w-4 h-4" /> Departments ({departments.length})
                    </h2>
                    <button
                        onClick={openNewDept}
                        className="bg-maroon text-gold px-5 py-2.5 rounded-xl flex items-center gap-2 font-black text-[10px] uppercase tracking-widest hover:bg-maroon/90 shadow-lg transition-all border border-gold/20"
                    >
                        <Plus className="w-3.5 h-3.5" /> New Department
                    </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {departments.map(dept => (
                        <div key={dept.id} className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-xl group hover:-translate-y-1 transition-all">
                            <h3 className="text-xl font-black text-maroon mb-2 truncate">{dept.name}</h3>
                            <p className="text-[10px] font-black text-gold uppercase tracking-widest mb-4">HOD: {dept.head_of_department || 'Unassigned'}</p>
                            <p className="text-xs text-gray-400 line-clamp-2 font-medium mb-6 italic">"{dept.description || 'No description provided'}"</p>
                            <div className="flex justify-between items-center pt-6 border-t border-gray-50">
                                <span className="text-[9px] font-bold text-gray-300 uppercase tracking-widest">
                                    Since {dept.created_at ? new Date(dept.created_at).getFullYear() : '—'}
                                </span>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => openEditDept(dept)}
                                        className="p-2 text-gray-300 hover:text-maroon transition-colors"
                                        title="Edit Department"
                                    >
                                        <Edit className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                    {departments.length === 0 && (
                        <div className="col-span-3 py-16 text-center bg-gray-50 rounded-[2rem] border border-dashed border-gray-200 flex flex-col items-center gap-3">
                            <Building2 className="w-8 h-8 text-gray-300" />
                            <p className="text-xs font-black text-gray-300 uppercase tracking-[0.2em]">No departments defined yet</p>
                            <button onClick={openNewDept} className="text-[10px] font-black text-maroon underline uppercase tracking-widest mt-1">
                                Add First Department
                            </button>
                        </div>
                    )}
                </div>
            </section>

            {/* Academic Periods */}
            <section>
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xs font-black text-maroon uppercase tracking-[0.3em] flex items-center gap-2">
                        <Calendar className="w-4 h-4" /> Academic Timeline ({periods.length})
                    </h2>
                    <button
                        onClick={() => { setPeriodForm(EMPTY_PERIOD); setShowPeriodModal(true); }}
                        className="bg-maroon text-gold px-5 py-2.5 rounded-xl flex items-center gap-2 font-black text-[10px] uppercase tracking-widest hover:bg-maroon/90 shadow-lg transition-all border border-gold/20"
                    >
                        <Plus className="w-3.5 h-3.5" /> New Period
                    </button>
                </div>
                <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-2xl overflow-hidden">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-gray-50/50">
                                <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Period Name</th>
                                <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Start Date</th>
                                <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">End Date</th>
                                <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</th>
                                <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {periods.map(period => (
                                <tr key={period.id} className={`hover:bg-gray-50 transition-colors ${period.is_active ? 'bg-maroon/[0.02]' : ''}`}>
                                    <td className="px-8 py-4">
                                        <div className="flex items-center gap-3">
                                            {period.is_active && <div className="w-2 h-2 bg-green-500 rounded-full animate-ping" />}
                                            <span className={`text-xs font-black ${period.is_active ? 'text-maroon' : 'text-gray-800'}`}>
                                                {period.name}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-8 py-4 text-xs font-bold text-gray-400">
                                        {period.start_date ? new Date(period.start_date).toLocaleDateString() : '—'}
                                    </td>
                                    <td className="px-8 py-4 text-xs font-bold text-gray-400">
                                        {period.end_date ? new Date(period.end_date).toLocaleDateString() : '—'}
                                    </td>
                                    <td className="px-8 py-4">
                                        <span className={`text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest ${period.status === 'Ongoing' ? 'bg-green-100 text-green-600' :
                                                period.status === 'Completed' ? 'bg-blue-100 text-blue-600' :
                                                    'bg-gray-100 text-gray-400'
                                            }`}>
                                            {period.status || 'Pending'}
                                        </span>
                                    </td>
                                    <td className="px-8 py-4 text-right">
                                        {!period.is_active && period.status !== 'Completed' && (
                                            <button
                                                onClick={() => handleActivatePeriod(period.id)}
                                                className="text-[9px] font-black text-green-600 uppercase tracking-widest hover:underline flex items-center gap-1 ml-auto"
                                            >
                                                <CheckCircle2 className="w-3 h-3" /> Activate
                                            </button>
                                        )}
                                        {period.is_active && (
                                            <span className="text-[9px] font-black text-maroon uppercase tracking-widest opacity-40">Current Active</span>
                                        )}
                                        {period.status === 'Completed' && (
                                            <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest opacity-60">Completed</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {periods.length === 0 && (
                                <tr>
                                    <td colSpan="5" className="px-8 py-16 text-center text-xs font-bold text-gray-300 uppercase tracking-widest">
                                        No academic periods defined yet
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* Department Modal */}
            {showDeptModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-md flex items-center justify-center p-4 z-50">
                    <div className="bg-white border border-maroon/10 rounded-[2.5rem] p-10 max-w-lg w-full shadow-2xl relative">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-maroon via-gold to-maroon opacity-60 rounded-t-[2.5rem]" />
                        <div className="flex justify-between items-center mb-8">
                            <div>
                                <h2 className="text-2xl font-black text-maroon uppercase tracking-tight">
                                    {editingDept ? 'Edit Department' : 'New Department'}
                                </h2>
                                <div className="w-10 h-0.5 bg-gold mt-2" />
                            </div>
                            <button onClick={() => setShowDeptModal(false)} className="p-2 hover:bg-maroon/5 rounded-full transition-colors">
                                <X className="w-6 h-6 text-maroon/30" />
                            </button>
                        </div>
                        <form onSubmit={handleDeptSubmit} className="space-y-5">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-maroon/40 uppercase tracking-widest ml-1">Department Name *</label>
                                <input
                                    type="text"
                                    value={deptForm.name}
                                    onChange={e => setDeptForm({ ...deptForm, name: e.target.value })}
                                    className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-maroon font-bold outline-none focus:ring-2 focus:ring-maroon/10"
                                    placeholder="e.g. School of Beauty & Cosmetology"
                                    required
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-maroon/40 uppercase tracking-widest ml-1">Head of Department</label>
                                <input
                                    type="text"
                                    value={deptForm.head_of_department}
                                    onChange={e => setDeptForm({ ...deptForm, head_of_department: e.target.value })}
                                    className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-maroon font-bold outline-none focus:ring-2 focus:ring-maroon/10"
                                    placeholder="e.g. Ms. Grace Wanjiku"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-maroon/40 uppercase tracking-widest ml-1">Description</label>
                                <textarea
                                    value={deptForm.description}
                                    onChange={e => setDeptForm({ ...deptForm, description: e.target.value })}
                                    className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-maroon font-bold outline-none focus:ring-2 focus:ring-maroon/10 h-24 resize-none"
                                    placeholder="Brief description of this department..."
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={savingDept}
                                className="w-full bg-maroon text-gold py-5 rounded-2xl font-black text-sm uppercase tracking-[0.2em] hover:bg-maroon/90 shadow-xl transition-all border border-gold/20 disabled:opacity-60"
                            >
                                {savingDept ? 'Saving...' : (editingDept ? 'Update Department' : 'Create Department')}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Period Modal */}
            {showPeriodModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-md flex items-center justify-center p-4 z-50">
                    <div className="bg-white border border-maroon/10 rounded-[2.5rem] p-10 max-w-lg w-full shadow-2xl relative">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-maroon via-gold to-maroon opacity-60 rounded-t-[2.5rem]" />
                        <div className="flex justify-between items-center mb-8">
                            <div>
                                <h2 className="text-2xl font-black text-maroon uppercase tracking-tight">New Academic Period</h2>
                                <div className="w-10 h-0.5 bg-gold mt-2" />
                            </div>
                            <button onClick={() => setShowPeriodModal(false)} className="p-2 hover:bg-maroon/5 rounded-full transition-colors">
                                <X className="w-6 h-6 text-maroon/30" />
                            </button>
                        </div>
                        <form onSubmit={handlePeriodSubmit} className="space-y-5">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-maroon/40 uppercase tracking-widest ml-1">Period Name *</label>
                                <input
                                    type="text"
                                    value={periodForm.name}
                                    onChange={e => setPeriodForm({ ...periodForm, name: e.target.value })}
                                    className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-maroon font-bold outline-none focus:ring-2 focus:ring-maroon/10"
                                    placeholder="e.g. Term 1 2026, Semester A"
                                    required
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-5">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-maroon/40 uppercase tracking-widest ml-1">Start Date *</label>
                                    <input
                                        type="date"
                                        value={periodForm.start_date}
                                        onChange={e => setPeriodForm({ ...periodForm, start_date: e.target.value })}
                                        className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-maroon font-bold outline-none focus:ring-2 focus:ring-maroon/10"
                                        required
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-maroon/40 uppercase tracking-widest ml-1">End Date *</label>
                                    <input
                                        type="date"
                                        value={periodForm.end_date}
                                        onChange={e => setPeriodForm({ ...periodForm, end_date: e.target.value })}
                                        className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-maroon font-bold outline-none focus:ring-2 focus:ring-maroon/10"
                                        required
                                    />
                                </div>
                            </div>
                            <button
                                type="submit"
                                disabled={savingPeriod}
                                className="w-full bg-maroon text-gold py-5 rounded-2xl font-black text-sm uppercase tracking-[0.2em] hover:bg-maroon/90 shadow-xl transition-all border border-gold/20 disabled:opacity-60"
                            >
                                {savingPeriod ? 'Creating...' : 'Create Academic Period'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
