import { useEffect, useState } from 'react';
import { FileText, Plus, Calendar, TrendingUp, BarChart3, X, Trash2, Edit, Printer } from 'lucide-react';
import { activityReportsAPI } from '../services/api';

export default function ActivityReports() {
    const [activeTab, setActiveTab] = useState('daily');
    const [dailyReports, setDailyReports] = useState([]);
    const [weeklyReports, setWeeklyReports] = useState([]);
    const [monthlyReports, setMonthlyReports] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [modalMode, setModalMode] = useState('create'); // 'create' or 'edit'
    const [editingReport, setEditingReport] = useState(null);
    const [loading, setLoading] = useState(false);

    // Daily Report Form State
    const [dailyForm, setDailyForm] = useState({
        report_date: new Date().toISOString().split('T')[0],
        classes_conducted: 0,
        total_attendance_percentage: 0,
        assessments_conducted: 0,
        total_students_present: 0,
        total_students_absent: 0,
        late_arrivals: 0,
        new_enrollments: 0,
        staff_present: 0,
        staff_absent: 0,
        facilities_issues: '',
        equipment_maintenance: '',
        notable_events: '',
        incidents: '',
        achievements: '',
        additional_notes: ''
    });

    // Weekly Report Form State
    const [weeklyForm, setWeeklyForm] = useState({
        week_start_date: '',
        week_end_date: '',
        total_classes_conducted: 0,
        average_attendance: 0,
        total_assessments: 0,
        active_students: 0,
        avg_student_attendance: 0,
        disciplinary_cases: 0,
        courses_completed: 0,
        new_enrollments: 0,
        key_achievements: '',
        challenges_faced: '',
        action_items: '',
        revenue_collected: 0,
        notes: ''
    });

    // Monthly Report Form State
    const [monthlyForm, setMonthlyForm] = useState({
        month: '',
        month_start_date: '',
        month_end_date: '',
        total_students: 0,
        new_enrollments: 0,
        graduations: 0,
        dropouts: 0,
        total_classes: 0,
        average_attendance: 0,
        total_assessments: 0,
        average_pass_rate: 0,
        total_faculty: 0,
        new_hires: 0,
        faculty_departures: 0,
        revenue: 0,
        expenses: 0,
        major_achievements: '',
        challenges: '',
        strategic_initiatives: '',
        goals_next_month: '',
        additional_notes: ''
    });

    useEffect(() => {
        fetchReports();
    }, [activeTab]);

    const fetchReports = async () => {
        setLoading(true);
        try {
            if (activeTab === 'daily') {
                const res = await activityReportsAPI.getDailyReports({ limit: 30 });
                setDailyReports(res.data.data || []);
            } else if (activeTab === 'weekly') {
                const res = await activityReportsAPI.getWeeklyReports({ limit: 20 });
                setWeeklyReports(res.data.data || []);
            } else if (activeTab === 'monthly') {
                const res = await activityReportsAPI.getMonthlyReports({ limit: 12 });
                setMonthlyReports(res.data.data || []);
            }
        } catch (error) {
            console.error('Error fetching reports:', error);
            alert('Failed to fetch reports');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmitDaily = async (e) => {
        e.preventDefault();
        try {
            if (modalMode === 'create') {
                await activityReportsAPI.createDailyReport(dailyForm);
                alert('Daily report created successfully!');
            } else {
                await activityReportsAPI.updateDailyReport(editingReport.id, dailyForm);
                alert('Daily report updated successfully!');
            }
            setShowModal(false);
            resetForms();
            fetchReports();
        } catch (error) {
            console.error('Error submitting daily report:', error);
            alert(error.response?.data?.error || 'Failed to submit report');
        }
    };

    const handleSubmitWeekly = async (e) => {
        e.preventDefault();
        try {
            if (modalMode === 'create') {
                await activityReportsAPI.createWeeklyReport(weeklyForm);
                alert('Weekly report created successfully!');
            } else {
                await activityReportsAPI.updateWeeklyReport(editingReport.id, weeklyForm);
                alert('Weekly report updated successfully!');
            }
            setShowModal(false);
            resetForms();
            fetchReports();
        } catch (error) {
            console.error('Error submitting weekly report:', error);
            alert(error.response?.data?.error || 'Failed to submit report');
        }
    };

    const handleSubmitMonthly = async (e) => {
        e.preventDefault();
        try {
            if (modalMode === 'create') {
                await activityReportsAPI.createMonthlyReport(monthlyForm);
                alert('Monthly report created successfully!');
            } else {
                await activityReportsAPI.updateMonthlyReport(editingReport.id, monthlyForm);
                alert('Monthly report updated successfully!');
            }
            setShowModal(false);
            resetForms();
            fetchReports();
        } catch (error) {
            console.error('Error submitting monthly report:', error);
            alert(error.response?.data?.error || 'Failed to submit report');
        }
    };

    const handleDelete = async (id, type) => {
        if (!confirm('Are you sure you want to delete this report?')) return;

        try {
            if (type === 'daily') await activityReportsAPI.deleteDailyReport(id);
            else if (type === 'weekly') await activityReportsAPI.deleteWeeklyReport(id);
            else if (type === 'monthly') await activityReportsAPI.deleteMonthlyReport(id);

            alert('Report deleted successfully!');
            fetchReports();
        } catch (error) {
            console.error('Error deleting report:', error);
            alert('Failed to delete report');
        }
    };

    const openCreateModal = () => {
        setModalMode('create');
        setEditingReport(null);
        resetForms();
        setShowModal(true);
    };

    const openEditModal = (report) => {
        setModalMode('edit');
        setEditingReport(report);

        if (activeTab === 'daily') {
            setDailyForm({ ...report });
        } else if (activeTab === 'weekly') {
            setWeeklyForm({ ...report });
        } else if (activeTab === 'monthly') {
            setMonthlyForm({ ...report });
        }

        setShowModal(true);
    };

    const resetForms = () => {
        setDailyForm({
            report_date: new Date().toISOString().split('T')[0],
            classes_conducted: 0,
            total_attendance_percentage: 0,
            assessments_conducted: 0,
            total_students_present: 0,
            total_students_absent: 0,
            late_arrivals: 0,
            new_enrollments: 0,
            staff_present: 0,
            staff_absent: 0,
            facilities_issues: '',
            equipment_maintenance: '',
            notable_events: '',
            incidents: '',
            achievements: '',
            additional_notes: ''
        });
        setWeeklyForm({
            week_start_date: '',
            week_end_date: '',
            total_classes_conducted: 0,
            average_attendance: 0,
            total_assessments: 0,
            active_students: 0,
            avg_student_attendance: 0,
            disciplinary_cases: 0,
            courses_completed: 0,
            new_enrollments: 0,
            key_achievements: '',
            challenges_faced: '',
            action_items: '',
            revenue_collected: 0,
            notes: ''
        });
        setMonthlyForm({
            month: '',
            month_start_date: '',
            month_end_date: '',
            total_students: 0,
            new_enrollments: 0,
            graduations: 0,
            dropouts: 0,
            total_classes: 0,
            average_attendance: 0,
            total_assessments: 0,
            average_pass_rate: 0,
            total_faculty: 0,
            new_hires: 0,
            faculty_departures: 0,
            revenue: 0,
            expenses: 0,
            major_achievements: '',
            challenges: '',
            strategic_initiatives: '',
            goals_next_month: '',
            additional_notes: ''
        });
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header */}
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-black text-gray-800 uppercase tracking-tighter">Activity Reports</h1>
                    <p className="text-sm text-gray-400 font-medium">College-Wide Operations Tracking</p>
                </div>
                <div className="flex gap-3 print:hidden">
                    <button
                        onClick={() => window.print()}
                        className="flex items-center gap-2 bg-gray-100 text-gray-700 px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-gray-200 transition-all shadow-sm"
                    >
                        <Printer className="w-4 h-4" />
                        Print Reports
                    </button>
                    <button
                        onClick={openCreateModal}
                        className="flex items-center gap-2 bg-maroon text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-[#600000] transition-all shadow-xl hover:-translate-y-1 active:scale-95"
                    >
                        <Plus className="w-4 h-4" />
                        New Report
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="bg-white rounded-[2rem] p-2 shadow-sm border border-gray-100 print:hidden">
                <div className="flex gap-2">
                    {[
                        { id: 'daily', label: 'Daily Reports', icon: Calendar },
                        { id: 'weekly', label: 'Weekly Summaries', icon: TrendingUp },
                        { id: 'monthly', label: 'Monthly Summaries', icon: BarChart3 }
                    ].map((tab) => {
                        const Icon = tab.icon;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex-1 flex items-center justify-center gap-2 px-6 py-4 rounded-[1.5rem] font-black text-xs uppercase tracking-widest transition-all ${activeTab === tab.id
                                    ? 'bg-maroon text-white shadow-lg'
                                    : 'text-gray-400 hover:text-maroon hover:bg-gray-50'
                                    }`}
                            >
                                <Icon className="w-4 h-4" />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Reports List */}
            {loading ? (
                <div className="text-center py-20">
                    <div className="inline-block w-12 h-12 border-4 border-maroon border-t-transparent rounded-full animate-spin"></div>
                    <p className="mt-4 text-sm font-bold text-gray-400">Loading reports...</p>
                </div>
            ) : (
                <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-gray-100 print:shadow-none print:border-none print:p-0">
                    {activeTab === 'daily' && (
                        <div className="space-y-4">
                            <h2 className="text-sm font-black text-gray-800 uppercase tracking-widest mb-6">Daily Activity Reports</h2>
                            {dailyReports.length === 0 ? (
                                <p className="text-center text-gray-400 py-12">No daily reports found. Create your first report!</p>
                            ) : (
                                dailyReports.map((report) => (
                                    <div key={report.id} className="bg-gray-50 p-6 rounded-2xl border border-gray-100 hover:shadow-md transition-all">
                                        <div className="flex justify-between items-start mb-4">
                                            <div>
                                                <h3 className="font-black text-lg text-maroon">{report.report_date ? new Date(report.report_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'No Date'}</h3>
                                                <p className="text-xs text-gray-400 font-bold mt-1">Reported by {report.reported_by}</p>
                                            </div>
                                            <div className="flex gap-2 print:hidden">
                                                <button
                                                    onClick={() => openEditModal(report)}
                                                    className="p-2 hover:bg-blue-50 rounded-lg transition-colors"
                                                    title="Edit"
                                                >
                                                    <Edit className="w-4 h-4 text-blue-600" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(report.id, 'daily')}
                                                    className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                                                    title="Delete"
                                                >
                                                    <Trash2 className="w-4 h-4 text-red-600" />
                                                </button>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                                            <div>
                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Classes</p>
                                                <p className="text-2xl font-black text-gray-800">{report.classes_conducted}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Attendance</p>
                                                <p className="text-2xl font-black text-gray-800">{(report.total_attendance_percentage || 0).toFixed(1)}%</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Present</p>
                                                <p className="text-2xl font-black text-green-600">{report.total_students_present}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Absent</p>
                                                <p className="text-2xl font-black text-red-600">{report.total_students_absent}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">New Enrollments</p>
                                                <p className="text-2xl font-black text-blue-600">{report.new_enrollments || 0}</p>
                                            </div>
                                        </div>
                                        {report.achievements && (
                                            <div className="mt-4 p-4 bg-green-50 rounded-xl">
                                                <p className="text-[10px] font-black text-green-600 uppercase tracking-widest mb-1">Achievements</p>
                                                <p className="text-sm text-gray-700">{report.achievements}</p>
                                            </div>
                                        )}
                                        {report.incidents && (
                                            <div className="mt-2 p-4 bg-red-50 rounded-xl">
                                                <p className="text-[10px] font-black text-red-600 uppercase tracking-widest mb-1">Incidents</p>
                                                <p className="text-sm text-gray-700">{report.incidents}</p>
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {activeTab === 'weekly' && (
                        <div className="space-y-4">
                            <h2 className="text-sm font-black text-gray-800 uppercase tracking-widest mb-6">Weekly Summary Reports</h2>
                            {weeklyReports.length === 0 ? (
                                <p className="text-center text-gray-400 py-12">No weekly reports found. Create your first summary!</p>
                            ) : (
                                weeklyReports.map((report) => (
                                    <div key={report.id} className="bg-gray-50 p-6 rounded-2xl border border-gray-100 hover:shadow-md transition-all">
                                        <div className="flex justify-between items-start mb-4">
                                            <div>
                                                <h3 className="font-black text-lg text-maroon">
                                                    {report.week_start_date ? new Date(report.week_start_date).toLocaleDateString() : 'N/A'} - {report.week_end_date ? new Date(report.week_end_date).toLocaleDateString() : 'N/A'}
                                                </h3>
                                                <p className="text-xs text-gray-400 font-bold mt-1">Reported by {report.reported_by}</p>
                                            </div>
                                            <div className="flex gap-2 print:hidden">
                                                <button
                                                    onClick={() => openEditModal(report)}
                                                    className="p-2 hover:bg-blue-50 rounded-lg transition-colors"
                                                    title="Edit"
                                                >
                                                    <Edit className="w-4 h-4 text-blue-600" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(report.id, 'weekly')}
                                                    className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                                                    title="Delete"
                                                >
                                                    <Trash2 className="w-4 h-4 text-red-600" />
                                                </button>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                            <div>
                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Classes</p>
                                                <p className="text-2xl font-black text-gray-800">{report.total_classes_conducted}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Avg Attendance</p>
                                                <p className="text-2xl font-black text-gray-800">{(report.average_attendance || 0).toFixed(1)}%</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Assessments</p>
                                                <p className="text-2xl font-black text-gray-800">{report.total_assessments}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">New Students</p>
                                                <p className="text-2xl font-black text-green-600">{report.new_enrollments}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Discipline Cases</p>
                                                <p className="text-2xl font-black text-red-600">{report.disciplinary_cases}</p>
                                            </div>
                                        </div>
                                        {report.key_achievements && (
                                            <div className="mt-4 p-4 bg-blue-50 rounded-xl">
                                                <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">Key Achievements</p>
                                                <p className="text-sm text-gray-700">{report.key_achievements}</p>
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {activeTab === 'monthly' && (
                        <div className="space-y-4">
                            <h2 className="text-sm font-black text-gray-800 uppercase tracking-widest mb-6">Monthly Summary Reports</h2>
                            {monthlyReports.length === 0 ? (
                                <p className="text-center text-gray-400 py-12">No monthly reports found. Create your first overview!</p>
                            ) : (
                                monthlyReports.map((report) => (
                                    <div key={report.id} className="bg-gray-50 p-6 rounded-2xl border border-gray-100 hover:shadow-md transition-all">
                                        <div className="flex justify-between items-start mb-4">
                                            <div>
                                                <h3 className="font-black text-lg text-maroon">{report.month}</h3>
                                                <p className="text-xs text-gray-400 font-bold mt-1">Reported by {report.reported_by}</p>
                                            </div>
                                            <div className="flex gap-2 print:hidden">
                                                <button
                                                    onClick={() => openEditModal(report)}
                                                    className="p-2 hover:bg-blue-50 rounded-lg transition-colors"
                                                    title="Edit"
                                                >
                                                    <Edit className="w-4 h-4 text-blue-600" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(report.id, 'monthly')}
                                                    className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                                                    title="Delete"
                                                >
                                                    <Trash2 className="w-4 h-4 text-red-600" />
                                                </button>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                                            <div>
                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Students</p>
                                                <p className="text-2xl font-black text-gray-800">{report.total_students}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Avg Attendance</p>
                                                <p className="text-2xl font-black text-gray-800">{(report.average_attendance || 0).toFixed(1)}%</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Pass Rate</p>
                                                <p className="text-2xl font-black text-gray-800">{(report.average_pass_rate || 0).toFixed(1)}%</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Faculty</p>
                                                <p className="text-2xl font-black text-gray-800">{report.total_faculty}</p>
                                            </div>
                                        </div>
                                        {report.major_achievements && (
                                            <div className="mt-4 p-4 bg-purple-50 rounded-xl">
                                                <p className="text-[10px] font-black text-purple-600 uppercase tracking-widest mb-1">Major Achievements</p>
                                                <p className="text-sm text-gray-700">{report.major_achievements}</p>
                                            </div>
                                        )}
                                        {report.goals_next_month && (
                                            <div className="mt-2 p-4 bg-gold/10 rounded-xl">
                                                <p className="text-[10px] font-black text-maroon uppercase tracking-widest mb-1">Goals Next Month</p>
                                                <p className="text-sm text-gray-700">{report.goals_next_month}</p>
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
                    <div className="bg-white rounded-[2rem] max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                        <div className="sticky top-0 bg-white border-b border-gray-100 p-6 rounded-t-[2rem] flex justify-between items-center">
                            <h2 className="text-lg font-black text-gray-800 uppercase tracking-wider">
                                {modalMode === 'create' ? 'Create' : 'Edit'} {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Report
                            </h2>
                            <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>

                        <div className="p-6">
                            {activeTab === 'daily' && (
                                <form onSubmit={handleSubmitDaily} className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-black text-gray-600 uppercase tracking-widest mb-2">Report Date</label>
                                            <input
                                                type="date"
                                                value={dailyForm.report_date}
                                                onChange={(e) => setDailyForm({ ...dailyForm, report_date: e.target.value })}
                                                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-maroon outline-none transition-colors"
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-black text-gray-600 uppercase tracking-widest mb-2">Classes Conducted</label>
                                            <input
                                                type="number"
                                                value={dailyForm.classes_conducted}
                                                onChange={(e) => setDailyForm({ ...dailyForm, classes_conducted: parseInt(e.target.value) })}
                                                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-maroon outline-none transition-colors"
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-black text-gray-600 uppercase tracking-widest mb-2">Attendance %</label>
                                            <input
                                                type="number"
                                                step="0.1"
                                                value={dailyForm.total_attendance_percentage}
                                                onChange={(e) => setDailyForm({ ...dailyForm, total_attendance_percentage: parseFloat(e.target.value) })}
                                                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-maroon outline-none transition-colors"
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-black text-gray-600 uppercase tracking-widest mb-2">Assessments</label>
                                            <input
                                                type="number"
                                                value={dailyForm.assessments_conducted}
                                                onChange={(e) => setDailyForm({ ...dailyForm, assessments_conducted: parseInt(e.target.value) })}
                                                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-maroon outline-none transition-colors"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-black text-gray-600 uppercase tracking-widest mb-2">Students Present</label>
                                            <input
                                                type="number"
                                                value={dailyForm.total_students_present}
                                                onChange={(e) => setDailyForm({ ...dailyForm, total_students_present: parseInt(e.target.value) })}
                                                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-maroon outline-none transition-colors"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-black text-gray-600 uppercase tracking-widest mb-2">Students Absent</label>
                                            <input
                                                type="number"
                                                value={dailyForm.total_students_absent}
                                                onChange={(e) => setDailyForm({ ...dailyForm, total_students_absent: parseInt(e.target.value) })}
                                                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-maroon outline-none transition-colors"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-black text-gray-600 uppercase tracking-widest mb-2">Late Arrivals</label>
                                            <input
                                                type="number"
                                                value={dailyForm.late_arrivals}
                                                onChange={(e) => setDailyForm({ ...dailyForm, late_arrivals: parseInt(e.target.value) })}
                                                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-maroon outline-none transition-colors"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-black text-gray-600 uppercase tracking-widest mb-2">New Enrollments</label>
                                            <input
                                                type="number"
                                                value={dailyForm.new_enrollments}
                                                onChange={(e) => setDailyForm({ ...dailyForm, new_enrollments: parseInt(e.target.value) })}
                                                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-maroon outline-none transition-colors"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-black text-gray-600 uppercase tracking-widest mb-2">Staff Present</label>
                                            <input
                                                type="number"
                                                value={dailyForm.staff_present}
                                                onChange={(e) => setDailyForm({ ...dailyForm, staff_present: parseInt(e.target.value) })}
                                                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-maroon outline-none transition-colors"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-black text-gray-600 uppercase tracking-widest mb-2">Notable Events</label>
                                        <textarea
                                            value={dailyForm.notable_events}
                                            onChange={(e) => setDailyForm({ ...dailyForm, notable_events: e.target.value })}
                                            className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-maroon outline-none transition-colors h-24"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-black text-gray-600 uppercase tracking-widest mb-2">Achievements</label>
                                        <textarea
                                            value={dailyForm.achievements}
                                            onChange={(e) => setDailyForm({ ...dailyForm, achievements: e.target.value })}
                                            className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-maroon outline-none transition-colors h-24"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-black text-gray-600 uppercase tracking-widest mb-2">Incidents</label>
                                        <textarea
                                            value={dailyForm.incidents}
                                            onChange={(e) => setDailyForm({ ...dailyForm, incidents: e.target.value })}
                                            className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-maroon outline-none transition-colors h-24"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-black text-gray-600 uppercase tracking-widest mb-2">Additional Notes</label>
                                        <textarea
                                            value={dailyForm.additional_notes}
                                            onChange={(e) => setDailyForm({ ...dailyForm, additional_notes: e.target.value })}
                                            className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-maroon outline-none transition-colors h-24"
                                        />
                                    </div>

                                    <div className="flex gap-3 justify-end">
                                        <button
                                            type="button"
                                            onClick={() => setShowModal(false)}
                                            className="px-6 py-3 rounded-xl border-2 border-gray-200 font-black text-xs uppercase tracking-widest text-gray-600 hover:bg-gray-50 transition-all"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            className="px-6 py-3 rounded-xl bg-maroon text-white font-black text-xs uppercase tracking-widest hover:bg-[#600000] transition-all shadow-lg"
                                        >
                                            {modalMode === 'create' ? 'Create' : 'Update'} Report
                                        </button>
                                    </div>
                                </form>
                            )}

                            {/* Similar forms for weekly and monthly - Due to length, I'll provide a simplified version */}
                            {activeTab === 'weekly' && (
                                <form onSubmit={handleSubmitWeekly} className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-black text-gray-600 uppercase tracking-widest mb-2">Week Start Date</label>
                                            <input
                                                type="date"
                                                value={weeklyForm.week_start_date}
                                                onChange={(e) => setWeeklyForm({ ...weeklyForm, week_start_date: e.target.value })}
                                                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-maroon outline-none transition-colors"
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-black text-gray-600 uppercase tracking-widest mb-2">Week End Date</label>
                                            <input
                                                type="date"
                                                value={weeklyForm.week_end_date}
                                                onChange={(e) => setWeeklyForm({ ...weeklyForm, week_end_date: e.target.value })}
                                                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-maroon outline-none transition-colors"
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-black text-gray-600 uppercase tracking-widest mb-2">Total Classes</label>
                                            <input
                                                type="number"
                                                value={weeklyForm.total_classes_conducted}
                                                onChange={(e) => setWeeklyForm({ ...weeklyForm, total_classes_conducted: parseInt(e.target.value) })}
                                                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-maroon outline-none transition-colors"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-black text-gray-600 uppercase tracking-widest mb-2">Avg Attendance %</label>
                                            <input
                                                type="number"
                                                step="0.1"
                                                value={weeklyForm.average_attendance}
                                                onChange={(e) => setWeeklyForm({ ...weeklyForm, average_attendance: parseFloat(e.target.value) })}
                                                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-maroon outline-none transition-colors"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-black text-gray-600 uppercase tracking-widest mb-2">New Enrollments</label>
                                            <input
                                                type="number"
                                                value={weeklyForm.new_enrollments}
                                                onChange={(e) => setWeeklyForm({ ...weeklyForm, new_enrollments: parseInt(e.target.value) })}
                                                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-maroon outline-none transition-colors"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-black text-gray-600 uppercase tracking-widest mb-2">Disciplinary Cases</label>
                                            <input
                                                type="number"
                                                value={weeklyForm.disciplinary_cases}
                                                onChange={(e) => setWeeklyForm({ ...weeklyForm, disciplinary_cases: parseInt(e.target.value) })}
                                                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-maroon outline-none transition-colors"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-black text-gray-600 uppercase tracking-widest mb-2">Key Achievements</label>
                                        <textarea
                                            value={weeklyForm.key_achievements}
                                            onChange={(e) => setWeeklyForm({ ...weeklyForm, key_achievements: e.target.value })}
                                            className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-maroon outline-none transition-colors h-24"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-black text-gray-600 uppercase tracking-widest mb-2">Challenges Faced</label>
                                        <textarea
                                            value={weeklyForm.challenges_faced}
                                            onChange={(e) => setWeeklyForm({ ...weeklyForm, challenges_faced: e.target.value })}
                                            className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-maroon outline-none transition-colors h-24"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-black text-gray-600 uppercase tracking-widest mb-2">Action Items</label>
                                        <textarea
                                            value={weeklyForm.action_items}
                                            onChange={(e) => setWeeklyForm({ ...weeklyForm, action_items: e.target.value })}
                                            className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-maroon outline-none transition-colors h-24"
                                        />
                                    </div>

                                    <div className="flex gap-3 justify-end">
                                        <button
                                            type="button"
                                            onClick={() => setShowModal(false)}
                                            className="px-6 py-3 rounded-xl border-2 border-gray-200 font-black text-xs uppercase tracking-widest text-gray-600 hover:bg-gray-50 transition-all"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            className="px-6 py-3 rounded-xl bg-maroon text-white font-black text-xs uppercase tracking-widest hover:bg-[#600000] transition-all shadow-lg"
                                        >
                                            {modalMode === 'create' ? 'Create' : 'Update'} Report
                                        </button>
                                    </div>
                                </form>
                            )}

                            {activeTab === 'monthly' && (
                                <form onSubmit={handleSubmitMonthly} className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="md:col-span-2">
                                            <label className="block text-xs font-black text-gray-600 uppercase tracking-widest mb-2">Month</label>
                                            <input
                                                type="text"
                                                placeholder="e.g., February 2026"
                                                value={monthlyForm.month}
                                                onChange={(e) => setMonthlyForm({ ...monthlyForm, month: e.target.value })}
                                                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-maroon outline-none transition-colors"
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-black text-gray-600 uppercase tracking-widest mb-2">Month Start Date</label>
                                            <input
                                                type="date"
                                                value={monthlyForm.month_start_date}
                                                onChange={(e) => setMonthlyForm({ ...monthlyForm, month_start_date: e.target.value })}
                                                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-maroon outline-none transition-colors"
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-black text-gray-600 uppercase tracking-widest mb-2">Month End Date</label>
                                            <input
                                                type="date"
                                                value={monthlyForm.month_end_date}
                                                onChange={(e) => setMonthlyForm({ ...monthlyForm, month_end_date: e.target.value })}
                                                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-maroon outline-none transition-colors"
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-black text-gray-600 uppercase tracking-widest mb-2">Total Students</label>
                                            <input
                                                type="number"
                                                value={monthlyForm.total_students}
                                                onChange={(e) => setMonthlyForm({ ...monthlyForm, total_students: parseInt(e.target.value) })}
                                                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-maroon outline-none transition-colors"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-black text-gray-600 uppercase tracking-widest mb-2">New Enrollments</label>
                                            <input
                                                type="number"
                                                value={monthlyForm.new_enrollments}
                                                onChange={(e) => setMonthlyForm({ ...monthlyForm, new_enrollments: parseInt(e.target.value) })}
                                                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-maroon outline-none transition-colors"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-black text-gray-600 uppercase tracking-widest mb-2">Graduations</label>
                                            <input
                                                type="number"
                                                value={monthlyForm.graduations}
                                                onChange={(e) => setMonthlyForm({ ...monthlyForm, graduations: parseInt(e.target.value) })}
                                                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-maroon outline-none transition-colors"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-black text-gray-600 uppercase tracking-widest mb-2">Avg Attendance %</label>
                                            <input
                                                type="number"
                                                step="0.1"
                                                value={monthlyForm.average_attendance}
                                                onChange={(e) => setMonthlyForm({ ...monthlyForm, average_attendance: parseFloat(e.target.value) })}
                                                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-maroon outline-none transition-colors"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-black text-gray-600 uppercase tracking-widest mb-2">Avg Pass Rate %</label>
                                            <input
                                                type="number"
                                                step="0.1"
                                                value={monthlyForm.average_pass_rate}
                                                onChange={(e) => setMonthlyForm({ ...monthlyForm, average_pass_rate: parseFloat(e.target.value) })}
                                                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-maroon outline-none transition-colors"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-black text-gray-600 uppercase tracking-widest mb-2">Total Faculty</label>
                                            <input
                                                type="number"
                                                value={monthlyForm.total_faculty}
                                                onChange={(e) => setMonthlyForm({ ...monthlyForm, total_faculty: parseInt(e.target.value) })}
                                                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-maroon outline-none transition-colors"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-black text-gray-600 uppercase tracking-widest mb-2">Major Achievements</label>
                                        <textarea
                                            value={monthlyForm.major_achievements}
                                            onChange={(e) => setMonthlyForm({ ...monthlyForm, major_achievements: e.target.value })}
                                            className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-maroon outline-none transition-colors h-24"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-black text-gray-600 uppercase tracking-widest mb-2">Challenges</label>
                                        <textarea
                                            value={monthlyForm.challenges}
                                            onChange={(e) => setMonthlyForm({ ...monthlyForm, challenges: e.target.value })}
                                            className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-maroon outline-none transition-colors h-24"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-black text-gray-600 uppercase tracking-widest mb-2">Strategic Initiatives</label>
                                        <textarea
                                            value={monthlyForm.strategic_initiatives}
                                            onChange={(e) => setMonthlyForm({ ...monthlyForm, strategic_initiatives: e.target.value })}
                                            className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-maroon outline-none transition-colors h-24"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-black text-gray-600 uppercase tracking-widest mb-2">Goals for Next Month</label>
                                        <textarea
                                            value={monthlyForm.goals_next_month}
                                            onChange={(e) => setMonthlyForm({ ...monthlyForm, goals_next_month: e.target.value })}
                                            className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-maroon outline-none transition-colors h-24"
                                        />
                                    </div>

                                    <div className="flex gap-3 justify-end">
                                        <button
                                            type="button"
                                            onClick={() => setShowModal(false)}
                                            className="px-6 py-3 rounded-xl border-2 border-gray-200 font-black text-xs uppercase tracking-widest text-gray-600 hover:bg-gray-50 transition-all"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            className="px-6 py-3 rounded-xl bg-maroon text-white font-black text-xs uppercase tracking-widest hover:bg-[#600000] transition-all shadow-lg"
                                        >
                                            {modalMode === 'create' ? 'Create' : 'Update'} Report
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
