import { useEffect, useState } from 'react';
import { gradesAPI, coursesAPI, studentsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Award, Search, TrendingUp, Download, Plus, X, Edit, Trash2, Calendar, BookOpen, User } from 'lucide-react';

export default function Grades() {
    const { user } = useAuth();
    const [courses, setCourses] = useState([]);
    const [students, setStudents] = useState([]);
    const [grades, setGrades] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingGrade, setEditingGrade] = useState(null);

    const [formData, setFormData] = useState({
        student_id: '',
        course: '',
        assignment: 'CAT 1',
        month: new Date().toLocaleString('default', { month: 'long' }),
        score: '',
        max_score: '100',
        remarks: ''
    });

    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const assignments = ['CAT 1', 'CAT 2', 'CAT 3', 'CAT 4', 'CAT 5', 'CAT 6', 'Final Exam', 'Practical Assessment'];

    useEffect(() => {
        fetchInitialData();
    }, []);

    const fetchInitialData = async () => {
        try {
            setLoading(true);
            const [{ data: coursesData }, { data: studentsData }] = await Promise.all([
                coursesAPI.getAll(),
                studentsAPI.getAll()
            ]);
            setCourses(coursesData);
            setStudents(studentsData);
        } catch (error) {
            console.error('Error fetching initial data:', error);
        } finally {
            setLoading(false);
        }
    };

    const [allRecords, setAllRecords] = useState([]);
    const [viewType, setViewType] = useState('CAT'); // 'CAT' or 'REPORTS'

    useEffect(() => {
        fetchInitialData();
    }, []);

    const fetchGrades = async () => {
        try {
            const [{ data: gradesData }, { data: reportsData }] = await Promise.all([
                gradesAPI.getAll(),
                reportsAPI.getAll()
            ]);

            const monthOrder = {
                'January': 1, 'February': 2, 'March': 3, 'April': 4, 'May': 5, 'June': 6,
                'July': 7, 'August': 8, 'September': 9, 'October': 10, 'November': 11, 'December': 12
            };

            // Process Grades
            const filteredGrades = user?.role === 'student'
                ? gradesData.filter(g => {
                    const gradeSid = String(g.student_id || '').trim().toLowerCase();
                    const userSid = String(user?.student_id || '').trim().toLowerCase();
                    const userId = String(user?.id || '').trim().toLowerCase();
                    return gradeSid === userSid || gradeSid === userId;
                })
                : gradesData;

            const sortedGrades = [...filteredGrades].sort((a, b) => {
                const monthA = monthOrder[a.month] || 0;
                const monthB = monthOrder[b.month] || 0;
                return monthB - monthA;
            });

            // Process Reports
            const filteredReports = user?.role === 'student'
                ? (reportsData || []).filter(r => {
                    const rSid = String(r.student_id || '').trim().toLowerCase();
                    const userSid = String(user?.student_id || '').trim().toLowerCase();
                    return rSid === userSid;
                })
                : (reportsData || []);

            setGrades(sortedGrades);
            setAllRecords(filteredReports);
        } catch (error) {
            console.error('Error fetching data:', error);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingGrade) {
                await gradesAPI.update(editingGrade.id, formData);
            } else {
                await gradesAPI.create(formData);
            }
            setShowModal(false);
            setEditingGrade(null);
            resetForm();
            fetchGrades();
        } catch (error) {
            console.error('Error saving grade:', error);
            alert('Failed to save grade. Please check the console for details.');
        }
    };

    const handleEdit = (grade) => {
        setEditingGrade(grade);
        setFormData({
            student_id: grade.student_id,
            course: grade.course,
            assignment: grade.assignment,
            month: grade.month || '',
            score: grade.score,
            max_score: grade.max_score,
            remarks: grade.remarks || ''
        });
        setShowModal(true);
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this result?')) {
            try {
                await gradesAPI.delete(id);
                fetchGrades();
            } catch (error) {
                console.error('Error deleting grade:', error);
            }
        }
    };

    const resetForm = () => {
        setFormData({
            student_id: '',
            course: '',
            assignment: 'CAT 1',
            month: new Date().toLocaleString('default', { month: 'long' }),
            score: '',
            max_score: '100',
            remarks: ''
        });
    };

    if (loading) return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-maroon border-t-transparent rounded-full animate-spin"></div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-maroon animate-pulse">Accessing Registry...</p>
            </div>
        </div>
    );

    const isStudent = user?.role === 'student';
    const canManage = user?.role === 'admin' || user?.role === 'superadmin' || user?.role === 'teacher';

    const stats = {
        average: grades.length > 0
            ? Math.round((grades.reduce((acc, g) => acc + (g.score / (g.max_score || 100)), 0) / grades.length) * 100)
            : 0
    };

    return (
        <div className="max-w-7xl mx-auto space-y-10 py-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                <div className="space-y-2">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-white border border-black/5 shadow-xl rounded-2xl text-maroon">
                            <Award className="w-6 h-6" />
                        </div>
                        <h1 className="text-4xl font-black text-black tracking-tight uppercase">
                            {isStudent ? 'CAT Performance' : 'Academic Registry'}
                        </h1>
                    </div>
                    <p className="text-xs text-black/40 font-bold tracking-[0.3em] uppercase pl-14">
                        Continues Assessment Testing Portal
                    </p>
                </div>

                {canManage && (
                    <button
                        onClick={() => { resetForm(); setEditingGrade(null); setShowModal(true); }}
                        className="bg-white text-black px-8 py-4 rounded-2xl flex items-center gap-3 hover:bg-black hover:text-white transition-all shadow-2xl hover:scale-105 active:scale-95 font-black text-xs uppercase tracking-widest border border-black/5"
                    >
                        <Plus className="w-5 h-5 text-maroon" /> Record CAT Result
                    </button>
                )}
            </div>

            {/* Performance Overview (Student Only) */}
            {isStudent && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="bg-white p-8 rounded-[2.5rem] border border-black/5 shadow-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-6 opacity-[0.03]">
                            <TrendingUp className="w-24 h-24 text-black" />
                        </div>
                        <p className="text-black/40 text-[10px] font-black uppercase tracking-widest mb-2">Overall Average</p>
                        <div className="flex items-baseline gap-2">
                            <span className="text-5xl font-black text-black">{stats.average}%</span>
                            <span className="text-xs font-bold text-green-600">Overall</span>
                        </div>
                        <div className="mt-6 h-1.5 w-full bg-black/5 rounded-full overflow-hidden">
                            <div className="h-full bg-maroon transition-all duration-1000" style={{ width: `${stats.average}%` }}></div>
                        </div>
                    </div>

                    <div className="bg-white p-8 rounded-[2.5rem] border border-black/5 shadow-2xl group">
                        <p className="text-black/40 text-[10px] font-black uppercase tracking-widest mb-2">Total CATs Sat</p>
                        <p className="text-5xl font-black text-black">{grades.length}</p>
                        <p className="text-[10px] text-black/30 mt-3 font-bold uppercase tracking-wider">Academic Term 2026</p>
                    </div>

                    <div className="bg-white p-8 rounded-[2.5rem] border border-black/5 shadow-2xl group">
                        <p className="text-black/40 text-[10px] font-black uppercase tracking-widest mb-2">Current Standing</p>
                        <p className="text-4xl font-black text-black uppercase">
                            {stats.average >= 70 ? 'First Class' : stats.average >= 60 ? 'Upper Second' : stats.average >= 50 ? 'Lower Second' : grades.length > 0 ? 'Pass' : 'N/A'}
                        </p>
                        <p className="text-[10px] text-maroon mt-3 font-bold uppercase tracking-wider">Performance-based Profile</p>
                    </div>
                </div>
            )}

            {/* Registry Toggle & Filter */}
            <div className="bg-white rounded-[3rem] border border-black/5 shadow-2xl overflow-hidden">
                <div className="p-10 border-b border-black/5 flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex bg-gray-50 p-2 rounded-2xl gap-2">
                        <button
                            onClick={() => setViewType('CAT')}
                            className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewType === 'CAT' ? 'bg-white text-maroon shadow-sm' : 'text-gray-400 hover:text-black'}`}
                        >
                            CAT Marks
                        </button>
                        <button
                            onClick={() => setViewType('REPORTS')}
                            className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewType === 'REPORTS' ? 'bg-white text-maroon shadow-sm' : 'text-gray-400 hover:text-black'}`}
                        >
                            Evaluation Reports
                        </button>
                    </div>
                    <div>
                        <h3 className="text-2xl font-black text-black uppercase tracking-tight">Official Results Registry</h3>
                        <p className="text-xs text-black/30 font-bold mt-1 uppercase tracking-widest">Verified Academic Records</p>
                    </div>
                    <div className="flex items-center gap-4 bg-white border border-black/5 p-2 px-6 rounded-2xl shadow-sm">
                        <Search className="w-4 h-4 text-maroon" />
                        <input
                            type="text"
                            placeholder="Filter results..."
                            className="bg-transparent border-none outline-none text-xs font-bold text-black placeholder:text-black/10 uppercase tracking-widest w-48"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    {viewType === 'CAT' ? (
                        <table className="w-full">
                            <thead>
                                <tr className="bg-black/[0.01]">
                                    <th className="px-10 py-6 text-left text-[10px] font-black text-black/40 uppercase tracking-[0.2em]">Student Detail</th>
                                    <th className="px-10 py-6 text-left text-[10px] font-black text-black/40 uppercase tracking-[0.2em]">CAT & Period</th>
                                    <th className="px-10 py-6 text-center text-[10px] font-black text-black/40 uppercase tracking-[0.2em]">Marks</th>
                                    <th className="px-10 py-6 text-left text-[10px] font-black text-black/40 uppercase tracking-[0.2em]">Performance Remarks</th>
                                    {canManage && <th className="px-10 py-6 text-center text-[10px] font-black text-black/40 uppercase tracking-[0.2em]">Action</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-black/5">
                                {grades.map((grade) => (
                                    <tr key={grade.id} className="hover:bg-maroon/[0.02] transition-colors group">
                                        <td className="px-10 py-8">
                                            <div className="flex items-center gap-5">
                                                <div>
                                                    <p className="text-sm font-black text-black uppercase tracking-tight">
                                                        {students.find(s => s.id === grade.student_id)?.name || grade.student_name || 'Unknown Student'}
                                                    </p>
                                                    <p className="text-[10px] font-bold text-black/30 uppercase tracking-widest">{grade.student_id}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-10 py-8">
                                            <div>
                                                <p className="text-sm font-black text-black uppercase tracking-tight">{grade.assignment}</p>
                                                <p className="text-[10px] font-bold text-black/30 uppercase tracking-widest">{grade.month || '-'}</p>
                                            </div>
                                        </td>
                                        <td className="px-10 py-8 text-center">
                                            <div className="inline-block px-5 py-2 bg-white text-black rounded-xl font-black text-lg shadow-xl border border-black/5">
                                                {Math.round((grade.score / (grade.max_score || 100)) * 100)}%
                                                <span className="block text-[8px] text-black/30 uppercase tracking-widest leading-none mt-1">
                                                    {grade.score} / {grade.max_score || 100}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-10 py-8">
                                            <div className="max-w-xs">
                                                <p className="text-xs font-bold text-black/60 italic leading-relaxed">
                                                    {grade.remarks ? `"${grade.remarks}"` : 'No official remarks provided.'}
                                                </p>
                                            </div>
                                        </td>
                                        {canManage && (
                                            <td className="px-10 py-8">
                                                <div className="flex justify-center gap-3">
                                                    <button onClick={() => handleEdit(grade)} className="p-3 hover:bg-maroon hover:text-white rounded-xl transition-all shadow-sm border border-maroon/5 text-maroon">
                                                        <Edit className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={() => handleDelete(grade.id)} className="p-3 hover:bg-red-600 hover:text-white rounded-xl transition-all shadow-sm border border-maroon/5 text-maroon hover:border-red-600">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <table className="w-full">
                            <thead>
                                <tr className="bg-black/[0.01]">
                                    <th className="px-10 py-6 text-left text-[10px] font-black text-black/40 uppercase tracking-[0.2em]">Student Detail</th>
                                    <th className="px-10 py-6 text-left text-[10px] font-black text-black/40 uppercase tracking-[0.2em]">Period</th>
                                    <th className="px-10 py-6 text-center text-[10px] font-black text-black/40 uppercase tracking-[0.2em]">CAS Score</th>
                                    <th className="px-10 py-6 text-left text-[10px] font-black text-black/40 uppercase tracking-[0.2em]">Trainer Observations</th>
                                    <th className="px-10 py-6 text-center text-[10px] font-black text-black/40 uppercase tracking-[0.2em]">Recommendation</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-black/5">
                                {allRecords.map((report) => (
                                    <tr key={report.id} className="hover:bg-gold/[0.02] transition-colors group">
                                        <td className="px-10 py-8">
                                            <div>
                                                <p className="text-sm font-black text-black uppercase tracking-tight">{report.student_name}</p>
                                                <p className="text-[10px] font-bold text-black/30 uppercase tracking-widest">{report.student_id}</p>
                                            </div>
                                        </td>
                                        <td className="px-10 py-8">
                                            <div>
                                                <p className="text-sm font-black text-black uppercase tracking-tight">{report.reporting_period}</p>
                                                <p className="text-[10px] font-bold text-black/30 uppercase tracking-widest">{new Date(report.created_at).toLocaleDateString()}</p>
                                            </div>
                                        </td>
                                        <td className="px-10 py-8 text-center">
                                            <div className="inline-block px-5 py-2 bg-white text-black rounded-xl font-black text-lg shadow-xl border border-black/5">
                                                {Math.round(report.theory_score)}%
                                                <span className="block text-[8px] text-black/30 uppercase tracking-widest leading-none mt-1">Theory CAS</span>
                                            </div>
                                        </td>
                                        <td className="px-10 py-8">
                                            <div className="max-w-xs">
                                                <p className="text-xs font-bold text-black/60 italic leading-relaxed line-clamp-2">
                                                    {report.trainer_observations || 'No observations documented.'}
                                                </p>
                                            </div>
                                        </td>
                                        <td className="px-10 py-8 text-center">
                                            <span className={`px-4 py-2 rounded-xl font-black text-[9px] uppercase tracking-widest border ${report.recommendation === 'Proceed' ? 'bg-green-50 border-green-200 text-green-600' :
                                                    report.recommendation === 'Improve' ? 'bg-orange-50 border-orange-200 text-orange-600' :
                                                        'bg-red-50 border-red-200 text-red-600'
                                                }`}>
                                                {report.recommendation}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-xl animate-in fade-in duration-300" onClick={() => setShowModal(false)}></div>
                    <div className="relative bg-white w-full max-w-lg rounded-[3rem] shadow-2xl border border-black/5 p-10 animate-in zoom-in-95 duration-300">
                        <div className="flex justify-between items-center mb-10">
                            <div>
                                <h2 className="text-3xl font-black text-black uppercase tracking-tight">
                                    {editingGrade ? 'Modify Result' : 'Record CAT Result'}
                                </h2>
                                <p className="text-[10px] text-maroon font-bold uppercase tracking-[0.3em] mt-1 italic">Secure Entry Portal</p>
                            </div>
                            <button onClick={() => setShowModal(false)} className="p-3 bg-white border border-black/5 hover:bg-black hover:text-white rounded-2xl transition-all shadow-sm">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-black/40 uppercase tracking-widest flex items-center gap-2">
                                    <User className="w-3 h-3 text-maroon" /> Student Selection
                                </label>
                                <select
                                    required
                                    value={formData.student_id}
                                    onChange={(e) => setFormData({ ...formData, student_id: e.target.value })}
                                    className="w-full bg-white border border-black/10 outline-none rounded-2xl px-6 py-4 text-xs font-black uppercase tracking-widest text-black appearance-none focus:ring-2 ring-black/5 transition-all shadow-sm"
                                >
                                    <option value="">Select Official Student</option>
                                    {students.map(s => (
                                        <option key={s.id} value={s.id}>{s.name} ({s.id})</option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-black/40 uppercase tracking-widest flex items-center gap-2">
                                        <BookOpen className="w-3 h-3 text-maroon" /> Course
                                    </label>
                                    <select
                                        required
                                        value={formData.course}
                                        onChange={(e) => setFormData({ ...formData, course: e.target.value })}
                                        className="w-full bg-white border border-black/10 outline-none rounded-2xl px-6 py-4 text-xs font-black uppercase tracking-widest text-black appearance-none focus:ring-2 ring-black/5 transition-all shadow-sm"
                                    >
                                        <option value="">Select Course</option>
                                        {courses.map(c => (
                                            <option key={c.id} value={c.name}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-black/40 uppercase tracking-widest flex items-center gap-2">
                                        <TrendingUp className="w-3 h-3 text-maroon" /> Assessment Type
                                    </label>
                                    <select
                                        required
                                        value={formData.assignment}
                                        onChange={(e) => setFormData({ ...formData, assignment: e.target.value })}
                                        className="w-full bg-white border border-black/10 outline-none rounded-2xl px-6 py-4 text-xs font-black uppercase tracking-widest text-black appearance-none focus:ring-2 ring-black/5 transition-all shadow-sm"
                                    >
                                        {assignments.map(a => <option key={a} value={a}>{a}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-black/40 uppercase tracking-widest flex items-center gap-2">
                                    <Calendar className="w-3 h-3 text-maroon" /> Month of Assessment
                                </label>
                                <select
                                    required
                                    value={formData.month}
                                    onChange={(e) => setFormData({ ...formData, month: e.target.value })}
                                    className="w-full bg-white border border-black/10 outline-none rounded-2xl px-6 py-4 text-xs font-black uppercase tracking-widest text-black appearance-none focus:ring-2 ring-black/5 transition-all shadow-sm"
                                >
                                    {months.map(m => <option key={m} value={m}>{m}</option>)}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-black/40 uppercase tracking-widest">Achieved Score</label>
                                    <input
                                        required
                                        type="number"
                                        placeholder="00"
                                        value={formData.score}
                                        onChange={(e) => setFormData({ ...formData, score: e.target.value })}
                                        className="w-full bg-white border border-black/10 outline-none rounded-2xl px-6 py-4 text-xl font-black text-black placeholder:text-black/5 focus:ring-2 ring-black/5 transition-all shadow-sm"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-black/40 uppercase tracking-widest">Maximum Marks</label>
                                    <input
                                        required
                                        type="number"
                                        placeholder="100"
                                        value={formData.max_score}
                                        onChange={(e) => setFormData({ ...formData, max_score: e.target.value })}
                                        className="w-full bg-white border border-black/10 outline-none rounded-2xl px-6 py-4 text-xl font-black text-black/20 placeholder:text-black/5 focus:ring-2 ring-black/5 transition-all shadow-sm"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-black/40 uppercase tracking-widest">Performance Remarks</label>
                                <textarea
                                    placeholder="Enter academic observations or feedback..."
                                    value={formData.remarks}
                                    onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                                    className="w-full bg-white border border-black/10 outline-none rounded-2xl px-6 py-4 text-xs font-bold text-black placeholder:text-black/10 focus:ring-2 ring-black/5 transition-all min-h-[100px] resize-none shadow-sm"
                                />
                            </div>

                            <button
                                type="submit"
                                className="w-full bg-black text-white py-6 rounded-[2rem] font-black text-xs uppercase tracking-[0.3em] shadow-2xl hover:bg-maroon hover:scale-[1.02] active:scale-95 transition-all mt-4 border border-black/5"
                            >
                                {editingGrade ? 'Update Registry' : 'Commit Result to Registry'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
