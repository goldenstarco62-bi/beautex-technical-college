import { useEffect, useState, useMemo } from 'react';
import {
    Calendar, TrendingUp, BarChart3, FileText, Plus, RefreshCw, Download,
    X, Eye, Edit, Trash2, Zap, AlertCircle, User, Clock, FileDown, ChevronRight, Printer
} from 'lucide-react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { toast } from 'react-hot-toast';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { activityReportsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function ActivityReports() {
    const [activeTab, setActiveTab] = useState('daily');
    const [dailyReports, setDailyReports] = useState([]);
    const [weeklyReports, setWeeklyReports] = useState([]);
    const [monthlyReports, setMonthlyReports] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [modalMode, setModalMode] = useState('create'); 
    const [editingReport, setEditingReport] = useState(null);
    const [viewingReport, setViewingReport] = useState(null);
    const [printingReport, setPrintingReport] = useState(null);
    const [loading, setLoading] = useState(false);

    // Date filters
    const [filterDateFrom, setFilterDateFrom] = useState('');
    const [filterDateTo, setFilterDateTo] = useState('');

    const chartData = useMemo(() => {
        if (activeTab === 'daily') {
            return dailyReports.slice(0, 7).reverse().map(r => ({
                name: new Date(r.report_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
                attendance: r.total_attendance_percentage || 0,
                classes: r.classes_conducted || 0
            }));
        } else if (activeTab === 'weekly') {
            return weeklyReports.slice(0, 5).reverse().map(r => ({
                name: `Week ${new Date(r.week_start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`,
                attendance: r.average_attendance || 0,
                revenue: r.revenue_collected || 0
            }));
        }
        return [];
    }, [dailyReports, weeklyReports, activeTab]);

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
        disciplinary_cases: 0,
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
            toast.error('Failed to load activity intelligence');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmitDaily = async (e) => {
        e.preventDefault();
        try {
            if (modalMode === 'create') {
                await activityReportsAPI.createDailyReport(dailyForm);
                toast.success('Daily report archived successfully');
            } else {
                await activityReportsAPI.updateDailyReport(editingReport.id, dailyForm);
                toast.success('Report revision authorized');
            }
            setShowModal(false);
            resetForms();
            fetchReports();
        } catch (error) {
            console.error('Error submitting daily report:', error);
            toast.error(error.response?.data?.error || 'Archive sequence failed');
        }
    };

    const handleSubmitWeekly = async (e) => {
        e.preventDefault();
        try {
            if (modalMode === 'create') {
                await activityReportsAPI.createWeeklyReport(weeklyForm);
                toast.success('Weekly summary finalized');
            } else {
                await activityReportsAPI.updateWeeklyReport(editingReport.id, weeklyForm);
                toast.success('Weekly revision archived');
            }
            setShowModal(false);
            resetForms();
            fetchReports();
        } catch (error) {
            console.error('Error submitting weekly report:', error);
            toast.error(error.response?.data?.error || 'Summary finalization failed');
        }
    };

    const handleSubmitMonthly = async (e) => {
        e.preventDefault();
        try {
            if (modalMode === 'create') {
                await activityReportsAPI.createMonthlyReport(monthlyForm);
                toast.success('Monthly intelligence report archived');
            } else {
                await activityReportsAPI.updateMonthlyReport(editingReport.id, monthlyForm);
                toast.success('Monthly revision authorized');
            }
            setShowModal(false);
            resetForms();
            fetchReports();
        } catch (error) {
            console.error('Error submitting monthly report:', error);
            toast.error(error.response?.data?.error || 'Archive operation interrupted');
        }
    };

    const handleDelete = async (id, type) => {
        if (!confirm('Are you sure you want to delete this report? This action is archived.')) return;

        try {
            if (type === 'daily') await activityReportsAPI.deleteDailyReport(id);
            else if (type === 'weekly') await activityReportsAPI.deleteWeeklyReport(id);
            else if (type === 'monthly') await activityReportsAPI.deleteMonthlyReport(id);

            toast.success('Report purged from active records');
            fetchReports();
        } catch (error) {
            console.error('Error deleting report:', error);
            toast.error('Deletion protocol failed');
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
            disciplinary_cases: 0,
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

    // Auto-calculate Daily Attendance %
    useEffect(() => {
        if (activeTab === 'daily') {
            const present = parseInt(dailyForm.total_students_present) || 0;
            const absent = parseInt(dailyForm.total_students_absent) || 0;
            const total = present + absent;
            if (total > 0) {
                const pct = (present / total) * 100;
                setDailyForm(prev => ({ ...prev, total_attendance_percentage: parseFloat(pct.toFixed(1)) }));
            } else {
                setDailyForm(prev => ({ ...prev, total_attendance_percentage: 0 }));
            }
        }
    }, [dailyForm.total_students_present, dailyForm.total_students_absent, activeTab]);

    // Auto-calculate Weekly/Monthly Avg Attendance (fetch from daily reports in range)
    useEffect(() => {
        const fetchRangeAvg = async () => {
            let start, end;
            if (activeTab === 'weekly' && weeklyForm.week_start_date && weeklyForm.week_end_date) {
                start = weeklyForm.week_start_date;
                end = weeklyForm.week_end_date;
            } else if (activeTab === 'monthly' && monthlyForm.month_start_date && monthlyForm.month_end_date) {
                start = monthlyForm.month_start_date;
                end = monthlyForm.month_end_date;
            } else {
                return;
            }

            try {
                const { data } = await activityReportsAPI.getDailyReports({ start_date: start, end_date: end, limit: 100 });
                if (data.data?.length > 0) {
                    const avg = data.data.reduce((acc, curr) => acc + (curr.total_attendance_percentage || 0), 0) / data.data.length;
                    if (activeTab === 'weekly') {
                        setWeeklyForm(prev => ({ ...prev, average_attendance: parseFloat(avg.toFixed(1)), total_classes_conducted: data.data.reduce((acc, curr) => acc + (curr.classes_conducted || 0), 0) }));
                    } else {
                        setMonthlyForm(prev => ({ ...prev, average_attendance: parseFloat(avg.toFixed(1)), total_classes: data.data.reduce((acc, curr) => acc + (curr.classes_conducted || 0), 0) }));
                    }
                }
            } catch (err) {
                console.error("Auto-fetch error:", err);
            }
        };
        fetchRangeAvg();
    }, [
        weeklyForm.week_start_date, weeklyForm.week_end_date,
        monthlyForm.month_start_date, monthlyForm.month_end_date,
        activeTab
    ]);

    const handleAutoSync = async () => {
        let start, end;
        if (activeTab === 'daily') {
            start = end = dailyForm.report_date;
        } else if (activeTab === 'weekly') {
            start = weeklyForm.week_start_date;
            end = weeklyForm.week_end_date;
        } else if (activeTab === 'monthly') {
            start = monthlyForm.month_start_date;
            end = monthlyForm.month_end_date;
        }

        if (!start || !end) {
            toast.error('Range parameters missing');
            return;
        }

        setLoading(true);
        try {
            const { data } = await activityReportsAPI.getAutoCapture({ startDate: start, endDate: end });
            const stats = data.data;

            if (activeTab === 'daily') {
                setDailyForm(prev => ({
                    ...prev,
                    total_students_present: stats.attendance.Present,
                    total_students_absent: stats.attendance.Absent,
                    late_arrivals: stats.attendance.Late,
                    new_enrollments: stats.new_enrollments,
                    staff_present: stats.total_faculty, 
                    total_attendance_percentage: stats.attendance.Present + stats.attendance.Absent > 0
                        ? parseFloat(((stats.attendance.Present / (stats.attendance.Present + stats.attendance.Absent)) * 100).toFixed(1))
                        : 0
                }));
            } else if (activeTab === 'weekly') {
                setWeeklyForm(prev => ({
                    ...prev,
                    average_attendance: stats.attendance.Present + stats.attendance.Absent > 0
                        ? parseFloat(((stats.attendance.Present / (stats.attendance.Present + stats.attendance.Absent)) * 100).toFixed(1))
                        : 0,
                    new_enrollments: stats.new_enrollments,
                    revenue_collected: stats.revenue_collected,
                    active_students: stats.attendance.Present 
                }));
            } else if (activeTab === 'monthly') {
                setMonthlyForm(prev => ({
                    ...prev,
                    new_enrollments: stats.new_enrollments,
                    revenue: stats.revenue_collected,
                    total_faculty: stats.total_faculty,
                    average_attendance: stats.attendance.Present + stats.attendance.Absent > 0
                        ? parseFloat(((stats.attendance.Present / (stats.attendance.Present + stats.attendance.Absent)) * 100).toFixed(1))
                        : 0,
                }));
            }
            toast.success('Operational data synchronized');
        } catch (error) {
            console.error('Auto-sync error:', error);
            toast.error('Sync pipeline failure');
        } finally {
            setLoading(false);
        }
    };

    const handlePrint = (report) => {
        setPrintingReport(report);
        const type = activeTab;
        setTimeout(() => {
            window.print();
            setPrintingReport(null);
        }, 1000);
    };

    const handleDownload = async (report) => {
        setPrintingReport(report);
        const type = activeTab;
        setTimeout(async () => {
            const element = document.getElementById('report-print-capture');
            if (!element) return;
            try {
                const canvas = await html2canvas(element, {
                    scale: 3,
                    useCORS: true,
                    backgroundColor: '#ffffff',
                    windowWidth: 794
                });
                const imgData = canvas.toDataURL('image/png');
                const pdf = new jsPDF('p', 'mm', 'a4');
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = pdf.internal.pageSize.getHeight();

                const imgProps = pdf.getImageProperties(imgData);
                const ratio = imgProps.height / imgProps.width;
                const renderedHeight = pdfWidth * ratio;

                pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, Math.min(renderedHeight, pdfHeight));
                pdf.save(`${type.charAt(0).toUpperCase() + type.slice(1)}_Activity_Report_${report.report_date || report.week_start_date || report.month}.pdf`);
                toast.success('Digital Archive Manifest Exported');
            } catch (error) {
                console.error('Download failed:', error);
                toast.error('Document generation sequence interrupted');
            } finally {
                setPrintingReport(null);
            }
        }, 1000);
    };

    if (loading && !dailyReports.length && !weeklyReports.length) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-4">
                <div className="relative">
                    <div className="w-20 h-20 border-4 border-maroon/10 border-t-maroon rounded-full animate-spin"></div>
                    <FileText className="w-8 h-8 text-maroon absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
                </div>
                <div className="text-maroon font-black uppercase tracking-[0.4em] text-xs animate-pulse">Aggregating Institutional Data...</div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto space-y-8 pb-20 animate-in fade-in slide-in-from-bottom-6 duration-1000">
            {/* Elegant Header Area */}
            <div className="relative overflow-hidden bg-white/40 backdrop-blur-3xl rounded-[2.5rem] border border-white/60 shadow-2xl p-6 md:p-8">
                <div className="absolute top-0 right-0 w-[40%] h-full bg-gradient-to-l from-maroon/5 to-transparent pointer-events-none"></div>
                <div className="absolute -top-24 -right-24 w-64 h-64 bg-gold/10 rounded-full blur-[80px]"></div>
                
                <div className="relative flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8">
                    <div className="flex items-center gap-8">
                        <div className="relative group">
                            <div className="absolute -inset-4 bg-maroon/20 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-all duration-700"></div>
                            <div className="w-14 h-14 bg-gradient-to-br from-maroon to-maroon-950 rounded-2xl flex items-center justify-center shadow-2xl transform transition-transform group-hover:-rotate-6 duration-500">
                                <BarChart3 className="w-7 h-7 text-gold" />
                            </div>
                        </div>
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <span className="h-[2px] w-12 bg-gradient-to-r from-gold to-maroon"></span>
                                <p className="text-[11px] text-maroon/70 font-black tracking-[0.4em] uppercase">Operations Intelligence</p>
                            </div>
                            <h1 className="text-2xl md:text-3xl font-black text-maroon tracking-tighter uppercase leading-none">
                                Activity <span className="text-gold font-serif italic text-2xl lowercase mx-1">&</span> Metrics
                            </h1>
                            <p className="text-sm text-gray-500 font-medium mt-3 border-l-4 border-gold/40 pl-5 max-w-lg leading-relaxed italic">
                                Institutional performance analytics and operational logs for the current academic period.
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-4 print:hidden">
                        <button
                            onClick={() => window.print()}
                            className="flex items-center gap-3 bg-white/80 backdrop-blur-md text-maroon border border-maroon/10 px-6 py-4 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-maroon hover:text-gold transition-all shadow-xl active:scale-95 group"
                        >
                            <Printer className="w-3.5 h-3.5 group-hover:animate-bounce" />
                            Print Manifest
                        </button>
                        <button
                            onClick={openCreateModal}
                            className="bg-maroon text-gold px-8 py-4 rounded-xl font-black text-[10px] uppercase tracking-[0.3em] hover:bg-black transition-all shadow-[0_20px_40px_-15px_rgba(128,0,0,0.3)] hover:-translate-y-1 active:translate-y-0 border border-maroon-900 group"
                        >
                            <Plus className="w-4 h-4 inline-block mr-2 group-hover:rotate-90 transition-transform" />
                            Execute Report
                        </button>
                    </div>
                </div>

                {/* Trend Chart Area (Only shown when data exists) */}
                {chartData.length > 0 && (
                    <div className="mt-8 pt-6 border-t border-maroon/5 animate-in fade-in duration-1000">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-[10px] font-black text-maroon/40 uppercase tracking-[.3em]">Institutional Performance Velocity</h3>
                            <div className="flex items-center gap-6">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-maroon"></div>
                                    <span className="text-[9px] font-black uppercase text-gray-400">Attendance %</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-gold"></div>
                                    <span className="text-[9px] font-black uppercase text-gray-400">Activity Vol.</span>
                                </div>
                            </div>
                        </div>
                        <div className="h-40 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData}>
                                    <defs>
                                        <linearGradient id="colorAttendance" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#800000" stopOpacity={0.1}/>
                                            <stop offset="95%" stopColor="#800000" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#80000010" />
                                    <XAxis 
                                        dataKey="name" 
                                        axisLine={false} 
                                        tickLine={false} 
                                        tick={{fill: '#800000', fontSize: 9, fontWeight: 900}} 
                                        dy={10}
                                    />
                                    <YAxis hide />
                                    <Tooltip 
                                        contentStyle={{backgroundColor: '#fff', borderRadius: '16px', border: '1px solid #80000010', boxShadow: '0 20px 40px -10px rgba(0,0,0,0.1)'}}
                                        labelStyle={{fontWeight: 900, textTransform: 'uppercase', fontSize: '10px', color: '#800000', marginBottom: '8px'}}
                                    />
                                    <Area 
                                        type="monotone" 
                                        dataKey="attendance" 
                                        stroke="#800000" 
                                        strokeWidth={4}
                                        fillOpacity={1} 
                                        fill="url(#colorAttendance)" 
                                    />
                                    <Area 
                                        type="monotone" 
                                        dataKey={activeTab === 'weekly' ? 'revenue' : 'classes'} 
                                        stroke="#C5A059" 
                                        strokeWidth={4}
                                        fill="transparent"
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}
            </div>

            {/* Smart Navigation Hub */}
            <div className="flex flex-col md:flex-row gap-4 sticky top-6 z-40 print:hidden">
                <div className="flex-1 bg-white/70 backdrop-blur-xl rounded-[2rem] p-2 shadow-2xl border border-white/80 flex gap-2">
                    {[
                        { id: 'daily', label: 'Daily Logs', icon: Calendar },
                        { id: 'weekly', label: 'Weekly Audits', icon: TrendingUp },
                        { id: 'monthly', label: 'Monthly Intelligence', icon: BarChart3 }
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex-1 flex items-center justify-center gap-3 px-8 py-5 rounded-[1.5rem] font-black text-[10px] uppercase tracking-[.25em] transition-all duration-500 ${activeTab === tab.id
                                ? 'bg-maroon text-gold shadow-[0_15px_30px_-10px_rgba(128,0,0,0.4)] translate-y-[-2px]'
                                : 'text-maroon/40 hover:text-maroon hover:bg-maroon/5'
                            }`}
                        >
                            <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? 'animate-pulse' : ''}`} />
                            <span className="hidden sm:inline">{tab.label}</span>
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-3 bg-white/70 backdrop-blur-xl rounded-[2rem] px-8 py-2 shadow-2xl border border-white/80">
                    <div className="flex items-center gap-4 border-r border-maroon/10 pr-6 mr-2">
                        <div className="flex items-center gap-2">
                            <label className="text-[9px] font-black text-maroon/40 uppercase tracking-widest whitespace-nowrap">From</label>
                            <input
                                type="date"
                                value={filterDateFrom}
                                onChange={e => setFilterDateFrom(e.target.value)}
                                className="px-3 py-2 bg-transparent border-none text-maroon font-black text-[11px] outline-none cursor-pointer"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <label className="text-[9px] font-black text-maroon/40 uppercase tracking-widest whitespace-nowrap">To</label>
                            <input
                                type="date"
                                value={filterDateTo}
                                onChange={e => setFilterDateTo(e.target.value)}
                                className="px-3 py-2 bg-transparent border-none text-maroon font-black text-[11px] outline-none cursor-pointer"
                            />
                        </div>
                    </div>
                    { (filterDateFrom || filterDateTo) && (
                        <button
                            onClick={() => { setFilterDateFrom(''); setFilterDateTo(''); }}
                            className="p-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-600 hover:text-white transition-all shadow-sm"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                    <div className="flex items-center gap-2 bg-maroon/5 px-4 py-2 rounded-xl">
                        <span className="text-[10px] font-black text-maroon uppercase tracking-widest">
                            {activeTab === 'daily' ? dailyReports.length : activeTab === 'weekly' ? weeklyReports.length : monthlyReports.length} Active Records
                        </span>
                    </div>
                </div>
            </div>

            {/* Reports Intelligence Feed */}
            <div className="bg-white/40 backdrop-blur-3xl rounded-[3rem] p-6 md:p-8 shadow-3xl border border-white/60 min-h-[400px]">

                {activeTab === 'daily' && (
                    <div className="grid grid-cols-1 gap-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xs font-black text-maroon uppercase tracking-[.4em]">Chronological Daily Audit Logs</h2>
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{dailyReports.length} Entries Archived</span>
                        </div>

                        {dailyReports.filter(r => {
                                const d = r.report_date || '';
                                return (!filterDateFrom || d >= filterDateFrom) && (!filterDateTo || d <= filterDateTo);
                            }).sort((a, b) => (b.report_date || '').localeCompare(a.report_date || '')).length === 0 ? (
                            <div className="text-center py-20 bg-maroon/[0.02] rounded-[2rem] border border-maroon/5 border-dashed">
                                <Calendar className="w-12 h-12 text-maroon/10 mx-auto mb-4" />
                                <p className="text-sm font-black text-maroon/40 uppercase tracking-widest">No operational logs for this cycle</p>
                            </div>
                        ) : (
                            dailyReports.filter(r => {
                                const d = r.report_date || '';
                                return (!filterDateFrom || d >= filterDateFrom) && (!filterDateTo || d <= filterDateTo);
                            }).sort((a, b) => (b.report_date || '').localeCompare(a.report_date || '')).map((report) => (
                                <div key={report.id} className="group relative bg-white rounded-[2rem] p-6 border border-maroon/5 hover:border-maroon/20 hover:shadow-2xl transition-all duration-500 overflow-hidden">
                                    <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-maroon to-gold transform -translate-x-full group-hover:translate-x-0 transition-transform duration-500 rounded-r-full"></div>
                                    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 relative z-10">
                                        <div className="flex items-center gap-5">
                                            <div className="w-12 h-12 bg-maroon/5 rounded-2xl flex flex-col items-center justify-center border border-maroon/10 group-hover:bg-maroon group-hover:border-maroon transition-all duration-500 flex-shrink-0">
                                                <span className="text-[7px] font-black uppercase text-maroon/40 group-hover:text-gold/60 tracking-tight">{report.report_date ? new Date(report.report_date).toLocaleDateString('en-US', { month: 'short' }) : ''}</span>
                                                <span className="text-xl font-black text-maroon group-hover:text-gold transition-colors">{report.report_date ? new Date(report.report_date).getDate() : '--'}</span>
                                            </div>
                                            <div>
                                                <h3 className="font-black text-lg text-maroon uppercase tracking-tight">{report.report_date ? new Date(report.report_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'No Date'}</h3>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-gold"></div>
                                                    <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Filed by {report.reported_by || 'Unknown Officer'}</p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4 px-6 border-l border-r border-maroon/5">
                                            <div>
                                                <p className="text-[9px] font-black text-maroon/30 uppercase tracking-widest mb-1">Attendance</p>
                                                <p className="text-xl font-black text-maroon">{report.total_attendance_percentage != null && report.total_attendance_percentage !== '' ? parseFloat(report.total_attendance_percentage).toFixed(1) + '%' : '—'}</p>
                                            </div>
                                            <div>
                                                <p className="text-[9px] font-black text-maroon/30 uppercase tracking-widest mb-1">Classes</p>
                                                <p className="text-xl font-black text-maroon">{report.classes_conducted}</p>
                                            </div>
                                            <div>
                                                <p className="text-[9px] font-black text-maroon/30 uppercase tracking-widest mb-1">Net Enroll</p>
                                                <p className="text-xl font-black text-blue-600">+{report.new_enrollments || 0}</p>
                                            </div>
                                            <div>
                                                <p className="text-[9px] font-black text-maroon/30 uppercase tracking-widest mb-1">Discipline</p>
                                                <p className="text-xl font-black text-amber-500">{report.disciplinary_cases || 0}</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-2 print:hidden">
                                            <button onClick={() => setViewingReport(report)} className="p-3 bg-maroon/5 text-maroon rounded-xl hover:bg-maroon hover:text-gold transition-all border border-maroon/5" title="View Report">
                                                <Eye className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => openEditModal(report)} className="p-3 bg-maroon/5 text-maroon rounded-xl hover:bg-maroon hover:text-gold transition-all border border-maroon/5" title="Edit">
                                                <Edit className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => handleDelete(report.id, 'daily')} className="p-3 bg-maroon/5 text-maroon rounded-xl hover:bg-red-600 hover:text-white transition-all border border-maroon/5" title="Delete">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                    {(report.achievements || report.incidents) && (
                                        <div className="mt-6 pt-6 border-t border-maroon/5 flex flex-wrap gap-3">
                                            {report.achievements && (
                                                <div className="flex items-center gap-2 bg-green-50 border border-green-100 rounded-2xl px-4 py-2">
                                                    <Zap className="w-3 h-3 text-green-600" />
                                                    <span className="text-[10px] font-black text-green-700 uppercase tracking-wider">{report.achievements.length > 40 ? report.achievements.substring(0, 40) + '...' : report.achievements}</span>
                                                </div>
                                            )}
                                            {report.incidents && (
                                                <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-2xl px-4 py-2">
                                                    <AlertCircle className="w-3 h-3 text-red-500" />
                                                    <span className="text-[10px] font-black text-red-700 uppercase tracking-wider">{report.incidents.length > 40 ? report.incidents.substring(0, 40) + '...' : report.incidents}</span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                )}

                {activeTab === 'weekly' && (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xs font-black text-maroon uppercase tracking-[.4em]">Aggregated Weekly Strategic Summaries</h2>
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{weeklyReports.length} Summaries Compiled</span>
                        </div>
                        {weeklyReports.filter(r => {
                            const d = r.week_start_date || r.report_date || '';
                            return (!filterDateFrom || d >= filterDateFrom) && (!filterDateTo || d <= filterDateTo);
                        }).sort((a, b) => (b.week_start_date || b.report_date || '').localeCompare(a.week_start_date || a.report_date || '')).length === 0 ? (
                            <div className="text-center py-20 bg-maroon/[0.02] rounded-[2rem] border border-maroon/5 border-dashed">
                                <TrendingUp className="w-12 h-12 text-maroon/10 mx-auto mb-4" />
                                <p className="text-sm font-black text-maroon/40 uppercase tracking-widest">Strategic summary queue empty</p>
                            </div>
                        ) : (
                            weeklyReports.filter(r => {
                                const d = r.week_start_date || r.report_date || '';
                                return (!filterDateFrom || d >= filterDateFrom) && (!filterDateTo || d <= filterDateTo);
                            }).sort((a, b) => (b.week_start_date || b.report_date || '').localeCompare(a.week_start_date || a.report_date || '')).map((report) => (
                                <div key={report.id} className="group relative bg-white rounded-[2rem] p-6 border border-gold/10 hover:border-gold/30 hover:shadow-2xl transition-all duration-500 overflow-hidden">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-gold/5 rounded-full -mr-10 -mt-10 group-hover:scale-150 transition-transform duration-700"></div>
                                    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 relative z-10">
                                        <div className="flex items-center gap-6">
                                            <div className="w-12 h-12 bg-gold/10 rounded-2xl flex items-center justify-center border border-gold/20 group-hover:bg-maroon group-hover:border-maroon transition-all duration-500 flex-shrink-0">
                                                <TrendingUp className="w-5 h-5 text-gold group-hover:text-gold" />
                                            </div>
                                            <div>
                                                <h3 className="font-black text-xl text-maroon uppercase tracking-tight">
                                                    {report.week_start_date ? new Date(report.week_start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'N/A'} — {report.week_end_date ? new Date(report.week_end_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A'}
                                                </h3>
                                                <p className="text-[10px] text-maroon/40 font-black uppercase tracking-widest mt-1">Compiled by {report.reported_by}</p>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 flex-1 px-6 border-l border-gold/10">
                                            <div>
                                                <p className="text-[9px] font-black text-maroon/30 uppercase tracking-widest mb-1">Avg Attendance</p>
                                                <p className="text-xl font-black text-maroon">{report.average_attendance != null && report.average_attendance !== '' ? parseFloat(report.average_attendance).toFixed(1) + '%' : '—'}</p>
                                            </div>
                                            <div>
                                                <p className="text-[9px] font-black text-maroon/30 uppercase tracking-widest mb-1">New Students</p>
                                                <p className="text-xl font-black text-green-600">+{report.new_enrollments || 0}</p>
                                            </div>
                                            <div>
                                                <p className="text-[9px] font-black text-maroon/30 uppercase tracking-widest mb-1">Assessments</p>
                                                <p className="text-xl font-black text-maroon">{report.total_assessments || 0}</p>
                                            </div>
                                            <div>
                                                <p className="text-[9px] font-black text-maroon/30 uppercase tracking-widest mb-1">Discipline</p>
                                                <p className="text-xl font-black text-red-500">{report.disciplinary_cases || 0}</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-2 print:hidden">
                                            <button onClick={() => setViewingReport(report)} className="p-3 bg-maroon/5 text-maroon rounded-xl hover:bg-maroon hover:text-gold transition-all border border-maroon/5" title="View">
                                                <Eye className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => openEditModal(report)} className="p-3 bg-maroon/5 text-maroon rounded-xl hover:bg-maroon hover:text-gold transition-all border border-maroon/5" title="Edit">
                                                <Edit className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => handleDelete(report.id, 'weekly')} className="p-3 bg-maroon/5 text-maroon rounded-xl hover:bg-red-600 hover:text-white transition-all border border-maroon/5" title="Delete">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                    {report.key_achievements && (
                                        <div className="mt-6 p-5 bg-gradient-to-r from-maroon/[0.03] to-transparent rounded-2xl border-l-4 border-gold">
                                            <p className="text-[9px] font-black text-gold uppercase tracking-widest mb-2">Key Achievements</p>
                                            <p className="text-sm text-gray-600 font-medium leading-relaxed italic line-clamp-2">"{report.key_achievements}"</p>
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                )}

                {activeTab === 'monthly' && (
                    <div className="space-y-8">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xs font-black text-maroon uppercase tracking-[.4em]">Executive Institutional Intelligence Reports</h2>
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{monthlyReports.length} Executive Audits</span>
                        </div>
                        {monthlyReports.filter(r => {
                            const d = r.month_start_date || r.report_date || '';
                            return (!filterDateFrom || d >= filterDateFrom) && (!filterDateTo || d <= filterDateTo);
                        }).length === 0 ? (
                            <div className="text-center py-20 bg-maroon/[0.02] rounded-[3rem] border border-maroon/5 border-dashed">
                                <BarChart3 className="w-16 h-16 text-maroon/10 mx-auto mb-4" />
                                <p className="text-sm font-black text-maroon/40 uppercase tracking-widest">Executive Intelligence pipeline empty</p>
                            </div>
                        ) : (
                            monthlyReports.filter(r => {
                                const d = r.month_start_date || r.report_date || '';
                                return (!filterDateFrom || d >= filterDateFrom) && (!filterDateTo || d <= filterDateTo);
                            }).sort((a, b) => (b.month_start_date || b.report_date || '').localeCompare(a.month_start_date || a.report_date || '')).map((report) => (
                                <div key={report.id} className="group relative bg-white rounded-[3rem] p-8 border border-maroon/5 hover:border-gold/30 hover:shadow-2xl transition-all duration-700 overflow-hidden">
                                    <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-maroon/[0.03] rounded-full blur-2xl group-hover:bg-maroon/[0.06] transition-all duration-700"></div>
                                    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-10 relative z-10">
                                        <div className="space-y-3">
                                            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-maroon text-gold rounded-full text-[9px] font-black uppercase tracking-widest shadow-xl">
                                                <BarChart3 className="w-3 h-3" /> Fiscal Oversight
                                            </div>
                                            <h3 className="font-black text-4xl text-maroon uppercase tracking-tighter leading-none">{report.month}</h3>
                                            <div className="flex gap-5 mt-2">
                                                <div className="flex items-center gap-2">
                                                    <User className="w-3.5 h-3.5 text-gold" />
                                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{report.total_students || 0} Enrolled</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <TrendingUp className="w-3.5 h-3.5 text-gold" />
                                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{parseFloat(report.average_pass_rate || 0).toFixed(1)}% Pass Rate</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 flex-1 px-6 lg:border-x border-maroon/5">
                                            <div>
                                                <p className="text-[9px] font-black text-maroon/30 uppercase tracking-widest mb-1">Total Students</p>
                                                <p className="text-2xl font-black text-maroon">{report.total_students || 0}</p>
                                            </div>
                                            <div>
                                                <p className="text-[9px] font-black text-maroon/30 uppercase tracking-widest mb-1">Avg Attendance</p>
                                                <p className="text-2xl font-black text-maroon">{report.average_attendance != null && report.average_attendance !== '' ? parseFloat(report.average_attendance).toFixed(1) + '%' : '—'}</p>
                                            </div>
                                            <div>
                                                <p className="text-[9px] font-black text-maroon/30 uppercase tracking-widest mb-1">Pass Rate</p>
                                                <p className="text-2xl font-black text-maroon">{parseFloat(report.average_pass_rate || 0).toFixed(1)}%</p>
                                            </div>
                                            <div className="bg-maroon/[0.03] p-3 rounded-xl border border-maroon/5 group-hover:bg-maroon group-hover:border-maroon transition-all duration-700">
                                                <p className="text-[9px] font-black text-maroon/30 uppercase tracking-widest mb-1 group-hover:text-gold/60">Faculty</p>
                                                <p className="text-2xl font-black text-maroon group-hover:text-gold transition-colors">{report.total_faculty || 0}</p>
                                            </div>
                                        </div>
                                        <div className="flex flex-col gap-3 print:hidden">
                                            <button onClick={() => setViewingReport(report)} className="flex items-center gap-3 bg-maroon/5 text-maroon px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-maroon hover:text-gold transition-all border border-maroon/5">
                                                <Eye className="w-4 h-4" /> Full Audit
                                            </button>
                                            <button onClick={() => openEditModal(report)} className="flex items-center gap-3 bg-maroon/5 text-maroon px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-maroon hover:text-gold transition-all border border-maroon/5">
                                                <Edit className="w-4 h-4" /> Revise
                                            </button>
                                            <button onClick={() => handleDelete(report.id, 'monthly')} className="flex items-center gap-3 bg-white text-maroon px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all border border-maroon/5">
                                                <Trash2 className="w-4 h-4" /> Purge
                                            </button>
                                        </div>
                                    </div>
                                    {(report.major_achievements || report.goals_next_month) && (
                                        <div className="mt-8 pt-8 border-t border-maroon/5 grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {report.major_achievements && (
                                                <div className="p-5 bg-purple-50/50 rounded-2xl border border-purple-100">
                                                    <p className="text-[9px] font-black text-purple-600 uppercase tracking-widest mb-2">Major Achievements</p>
                                                    <p className="text-sm text-gray-600 leading-relaxed line-clamp-3">{report.major_achievements}</p>
                                                </div>
                                            )}
                                            {report.goals_next_month && (
                                                <div className="p-5 bg-gold/5 rounded-2xl border border-gold/20">
                                                    <p className="text-[9px] font-black text-maroon uppercase tracking-widest mb-2">Goals Next Month</p>
                                                    <p className="text-sm text-gray-600 leading-relaxed line-clamp-3">{report.goals_next_month}</p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
                    <div className="bg-white rounded-[2rem] max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                        <div className="sticky top-0 bg-white border-b border-gray-100 p-6 rounded-t-[2rem] flex justify-between items-center z-10">
                            <div className="flex items-center gap-4">
                                <h2 className="text-lg font-black text-gray-800 uppercase tracking-wider">
                                    {modalMode === 'create' ? 'Create' : 'Edit'} {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Report
                                </h2>
                                <button
                                    onClick={handleAutoSync}
                                    type="button"
                                    className="flex items-center gap-2 bg-blue-50 text-blue-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-100 transition-all border border-blue-100"
                                    title="Fetch latest data from system"
                                >
                                    <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                                    Auto-Sync Live Data
                                </button>
                            </div>
                            <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>

                        <div className="p-6">
                            {activeTab === 'daily' && (
                                <form onSubmit={handleSubmitDaily} className="space-y-6">
                                    {/* Section 1: Core Metrics & Attendance */}
                                    <div className="bg-gray-50/50 p-6 rounded-3xl border border-gray-100 space-y-6">
                                        <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
                                            <div className="w-8 h-8 bg-maroon/10 rounded-lg flex items-center justify-center">
                                                <Calendar className="w-4 h-4 text-maroon" />
                                            </div>
                                            <h3 className="text-xs font-black text-gray-800 uppercase tracking-widest">General & Attendance</h3>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                            <div>
                                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Report Date</label>
                                                <input
                                                    type="date"
                                                    value={dailyForm.report_date}
                                                    onChange={(e) => setDailyForm({ ...dailyForm, report_date: e.target.value })}
                                                    className="w-full px-5 py-3.5 bg-white rounded-2xl border border-gray-200 focus:border-maroon focus:ring-4 focus:ring-maroon/5 outline-none transition-all font-bold text-gray-700"
                                                    required
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Staff Present</label>
                                                <input
                                                    type="number"
                                                    value={dailyForm.staff_present}
                                                    onChange={(e) => setDailyForm({ ...dailyForm, staff_present: parseInt(e.target.value) || 0 })}
                                                    className="w-full px-5 py-3.5 bg-white rounded-2xl border border-gray-200 focus:border-maroon focus:ring-4 focus:ring-maroon/5 outline-none transition-all font-bold text-gray-700"
                                                    required
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Staff Absent</label>
                                                <input
                                                    type="number"
                                                    value={dailyForm.staff_absent}
                                                    onChange={(e) => setDailyForm({ ...dailyForm, staff_absent: parseInt(e.target.value) || 0 })}
                                                    className="w-full px-5 py-3.5 bg-white rounded-2xl border border-gray-200 focus:border-maroon focus:ring-4 focus:ring-maroon/5 outline-none transition-all font-bold text-gray-700"
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                            <div>
                                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Students Present</label>
                                                <input
                                                    type="number"
                                                    value={dailyForm.total_students_present}
                                                    onChange={(e) => setDailyForm({ ...dailyForm, total_students_present: parseInt(e.target.value) || 0 })}
                                                    className="w-full px-5 py-3.5 bg-white rounded-2xl border border-gray-200 focus:border-maroon focus:ring-4 focus:ring-maroon/5 outline-none transition-all font-bold text-green-600"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Students Absent</label>
                                                <input
                                                    type="number"
                                                    value={dailyForm.total_students_absent}
                                                    onChange={(e) => setDailyForm({ ...dailyForm, total_students_absent: parseInt(e.target.value) || 0 })}
                                                    className="w-full px-5 py-3.5 bg-white rounded-2xl border border-gray-200 focus:border-maroon focus:ring-4 focus:ring-maroon/5 outline-none transition-all font-bold text-red-600"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Late Arrivals</label>
                                                <input
                                                    type="number"
                                                    value={dailyForm.late_arrivals}
                                                    onChange={(e) => setDailyForm({ ...dailyForm, late_arrivals: parseInt(e.target.value) || 0 })}
                                                    className="w-full px-5 py-3.5 bg-white rounded-2xl border border-gray-200 focus:border-maroon focus:ring-4 focus:ring-maroon/5 outline-none transition-all font-bold text-amber-600"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Attendance %</label>
                                                <div className="w-full px-5 py-3.5 bg-gray-100 rounded-2xl border border-gray-200 font-black text-maroon flex items-center justify-between">
                                                    <span>{dailyForm.total_attendance_percentage}%</span>
                                                    <div className="w-1.5 h-1.5 rounded-full bg-maroon animate-pulse" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Section 2: Academic Operations */}
                                    <div className="bg-gray-50/50 p-6 rounded-3xl border border-gray-100 space-y-6">
                                        <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
                                            <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                                                <TrendingUp className="w-4 h-4 text-blue-600" />
                                            </div>
                                            <h3 className="text-xs font-black text-gray-800 uppercase tracking-widest">Academic Operations</h3>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                            <div>
                                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Classes Conducted</label>
                                                <input
                                                    type="number"
                                                    value={dailyForm.classes_conducted}
                                                    onChange={(e) => setDailyForm({ ...dailyForm, classes_conducted: parseInt(e.target.value) || 0 })}
                                                    className="w-full px-5 py-3.5 bg-white rounded-2xl border border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 outline-none transition-all font-bold text-gray-700"
                                                    required
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Assessments</label>
                                                <input
                                                    type="number"
                                                    value={dailyForm.assessments_conducted}
                                                    onChange={(e) => setDailyForm({ ...dailyForm, assessments_conducted: parseInt(e.target.value) || 0 })}
                                                    className="w-full px-5 py-3.5 bg-white rounded-2xl border border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 outline-none transition-all font-bold text-gray-700"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">New Enrollments</label>
                                                <input
                                                    type="number"
                                                    value={dailyForm.new_enrollments}
                                                    onChange={(e) => setDailyForm({ ...dailyForm, new_enrollments: parseInt(e.target.value) || 0 })}
                                                    className="w-full px-5 py-3.5 bg-white rounded-2xl border border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 outline-none transition-all font-bold text-gray-700"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Section 3: Facilities & Logistics */}
                                    <div className="bg-gray-50/50 p-6 rounded-3xl border border-gray-100 space-y-6">
                                        <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
                                            <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center">
                                                <Zap className="w-4 h-4 text-amber-600" />
                                            </div>
                                            <h3 className="text-xs font-black text-gray-800 uppercase tracking-widest">Facilities & Discipline</h3>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div>
                                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Disciplinary Cases</label>
                                                <input
                                                    type="number"
                                                    value={dailyForm.disciplinary_cases}
                                                    onChange={(e) => setDailyForm({ ...dailyForm, disciplinary_cases: parseInt(e.target.value) || 0 })}
                                                    className="w-full px-5 py-3.5 bg-white rounded-2xl border border-gray-200 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/5 outline-none transition-all font-bold text-red-500"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Facilities Issues</label>
                                                <input
                                                    type="text"
                                                    value={dailyForm.facilities_issues}
                                                    onChange={(e) => setDailyForm({ ...dailyForm, facilities_issues: e.target.value })}
                                                    placeholder="Any infrastructure concerns?"
                                                    className="w-full px-5 py-3.5 bg-white rounded-2xl border border-gray-200 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/5 outline-none transition-all font-bold text-gray-700 placeholder:text-gray-300"
                                                />
                                            </div>
                                            <div className="md:col-span-2">
                                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Equipment Maintenance</label>
                                                <input
                                                    type="text"
                                                    value={dailyForm.equipment_maintenance}
                                                    onChange={(e) => setDailyForm({ ...dailyForm, equipment_maintenance: e.target.value })}
                                                    placeholder="Status of laboratory/classroom equipment..."
                                                    className="w-full px-5 py-3.5 bg-white rounded-2xl border border-gray-200 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/5 outline-none transition-all font-bold text-gray-700 placeholder:text-gray-300"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Section 4: Qualitative Observations */}
                                    <div className="bg-gray-50/50 p-6 rounded-3xl border border-gray-100 space-y-6">
                                        <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
                                            <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center">
                                                <FileText className="w-4 h-4 text-green-600" />
                                            </div>
                                            <h3 className="text-xs font-black text-gray-800 uppercase tracking-widest">Detailed Observations</h3>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div>
                                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Notable Events</label>
                                                <textarea
                                                    value={dailyForm.notable_events}
                                                    onChange={(e) => setDailyForm({ ...dailyForm, notable_events: e.target.value })}
                                                    placeholder="Workshops, visitors, guest lectures..."
                                                    className="w-full px-5 py-4 bg-white rounded-2xl border border-gray-200 focus:border-green-500 focus:ring-4 focus:ring-green-500/5 outline-none transition-all font-bold text-gray-700 placeholder:text-gray-300 h-28 resize-none shadow-inner"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Achievements</label>
                                                <textarea
                                                    value={dailyForm.achievements}
                                                    onChange={(e) => setDailyForm({ ...dailyForm, achievements: e.target.value })}
                                                    placeholder="Success stories from students or faculty..."
                                                    className="w-full px-5 py-4 bg-white rounded-2xl border border-gray-200 focus:border-green-500 focus:ring-4 focus:ring-green-500/5 outline-none transition-all font-bold text-gray-700 placeholder:text-gray-300 h-28 resize-none shadow-inner"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1 text-red-500">Incidents</label>
                                                <textarea
                                                    value={dailyForm.incidents}
                                                    onChange={(e) => setDailyForm({ ...dailyForm, incidents: e.target.value })}
                                                    placeholder="Any accidents, security breaches, or emergencies..."
                                                    className="w-full px-5 py-4 bg-white rounded-2xl border border-red-100 focus:border-red-500 focus:ring-4 focus:ring-red-500/5 outline-none transition-all font-bold text-gray-700 placeholder:text-red-200 h-28 resize-none shadow-inner"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Additional Notes</label>
                                                <textarea
                                                    value={dailyForm.additional_notes}
                                                    onChange={(e) => setDailyForm({ ...dailyForm, additional_notes: e.target.value })}
                                                    placeholder="Miscellaneous observations..."
                                                    className="w-full px-5 py-4 bg-white rounded-2xl border border-gray-200 focus:border-green-500 focus:ring-4 focus:ring-green-500/5 outline-none transition-all font-bold text-gray-700 placeholder:text-gray-300 h-28 resize-none shadow-inner"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex gap-4 justify-end pt-6">
                                        <button
                                            type="button"
                                            onClick={() => setShowModal(false)}
                                            className="px-8 py-4 rounded-2xl border border-gray-200 font-black text-[10px] uppercase tracking-widest text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-all active:scale-95"
                                        >
                                            Cancel Entry
                                        </button>
                                        <button
                                            type="submit"
                                            className="px-8 py-4 rounded-2xl bg-maroon text-gold font-black text-[10px] uppercase tracking-[0.2em] hover:bg-maroon/90 transition-all shadow-xl hover:-translate-y-1 active:scale-95 border border-gold/20"
                                        >
                                            {modalMode === 'create' ? 'Seal & Submit' : 'Update Record'}
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
                                                onChange={(e) => setWeeklyForm({ ...weeklyForm, total_classes_conducted: parseInt(e.target.value) || 0 })}
                                                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-maroon outline-none transition-colors"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-black text-gray-600 uppercase tracking-widest mb-2">Avg Attendance % (Auto)</label>
                                            <input
                                                type="number"
                                                step="0.1"
                                                value={weeklyForm.average_attendance}
                                                readOnly
                                                className="w-full px-4 py-3 rounded-xl border-2 border-gray-100 bg-gray-50 text-maroon font-black outline-none cursor-not-allowed"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-black text-gray-600 uppercase tracking-widest mb-2">New Enrollments</label>
                                            <input
                                                type="number"
                                                value={weeklyForm.new_enrollments}
                                                onChange={(e) => setWeeklyForm({ ...weeklyForm, new_enrollments: parseInt(e.target.value) || 0 })}
                                                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-maroon outline-none transition-colors"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-black text-gray-600 uppercase tracking-widest mb-2">Disciplinary Cases</label>
                                            <input
                                                type="number"
                                                value={weeklyForm.disciplinary_cases}
                                                onChange={(e) => setWeeklyForm({ ...weeklyForm, disciplinary_cases: parseInt(e.target.value) || 0 })}
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
                                                onChange={(e) => setMonthlyForm({ ...monthlyForm, total_students: parseInt(e.target.value) || 0 })}
                                                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-maroon outline-none transition-colors"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-black text-gray-600 uppercase tracking-widest mb-2">New Enrollments</label>
                                            <input
                                                type="number"
                                                value={monthlyForm.new_enrollments}
                                                onChange={(e) => setMonthlyForm({ ...monthlyForm, new_enrollments: parseInt(e.target.value) || 0 })}
                                                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-maroon outline-none transition-colors"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-black text-gray-600 uppercase tracking-widest mb-2">Graduations</label>
                                            <input
                                                type="number"
                                                value={monthlyForm.graduations}
                                                onChange={(e) => setMonthlyForm({ ...monthlyForm, graduations: parseInt(e.target.value) || 0 })}
                                                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-maroon outline-none transition-colors"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-black text-gray-600 uppercase tracking-widest mb-2">Avg Attendance % (Auto)</label>
                                            <input
                                                type="number"
                                                step="0.1"
                                                value={monthlyForm.average_attendance}
                                                readOnly
                                                className="w-full px-4 py-3 rounded-xl border-2 border-gray-100 bg-gray-50 text-maroon font-black outline-none cursor-not-allowed"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-black text-gray-600 uppercase tracking-widest mb-2">Avg Pass Rate %</label>
                                            <input
                                                type="number"
                                                step="0.1"
                                                value={monthlyForm.average_pass_rate}
                                                onChange={(e) => setMonthlyForm({ ...monthlyForm, average_pass_rate: parseFloat(e.target.value) || 0 })}
                                                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-maroon outline-none transition-colors"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-black text-gray-600 uppercase tracking-widest mb-2">Total Faculty</label>
                                            <input
                                                type="number"
                                                value={monthlyForm.total_faculty}
                                                onChange={(e) => setMonthlyForm({ ...monthlyForm, total_faculty: parseInt(e.target.value) || 0 })}
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
            {/* View Modal */}
            {viewingReport && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-md flex items-center justify-center p-4 z-[60]">
                    <div className="bg-white border border-gray-100 rounded-[2.5rem] p-8 max-w-4xl w-full shadow-2xl relative max-h-[90vh] overflow-y-auto custom-scrollbar">
                        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-maroon via-gold to-maroon opacity-60 rounded-t-[2.5rem]" />
                        <div className="flex justify-between items-center mb-8 sticky top-0 bg-white/80 backdrop-blur-sm py-2">
                            <div>
                                <h2 className="text-2xl font-black text-maroon uppercase tracking-tight">Full Activity Report</h2>
                                <div className="w-10 h-0.5 bg-gold mt-2"></div>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">Detailed Operational Documentation</p>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleDownload(viewingReport)}
                                    className="p-2 bg-maroon/5 hover:bg-maroon hover:text-white rounded-xl transition-all shadow-sm"
                                    title="Download PDF"
                                >
                                    <FileDown className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={() => handlePrint(viewingReport)}
                                    className="p-2 bg-maroon/5 hover:bg-maroon hover:text-white rounded-xl transition-all shadow-sm"
                                    title="Print Report"
                                >
                                    <Printer className="w-5 h-5" />
                                </button>
                                <button onClick={() => setViewingReport(null)} className="p-2 hover:bg-maroon/5 rounded-full transition-colors">
                                    <X className="w-6 h-6 text-maroon/30" />
                                </button>
                            </div>
                        </div>

                        <div className="space-y-8">
                            {/* Daily Details */}
                            {activeTab === 'daily' && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
                                    <div className="space-y-6">
                                        <div>
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Report Date</p>
                                            <p className="text-lg font-bold text-gray-800">{new Date(viewingReport.report_date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Classes Conducted</p>
                                                <p className="text-xl font-black text-gray-800">{viewingReport.classes_conducted}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Avg Attendance</p>
                                                <p className="text-xl font-black text-maroon">{parseFloat(viewingReport.total_attendance_percentage || 0).toFixed(1)}%</p>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Students Present</p>
                                                <p className="text-xl font-black text-green-600">{viewingReport.total_students_present}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Students Absent</p>
                                                <p className="text-xl font-black text-red-600">{viewingReport.total_students_absent}</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-6">
                                        <div>
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Reported By</p>
                                            <p className="text-lg font-bold text-gray-800">{viewingReport.reported_by}</p>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Late Arrivals</p>
                                                <p className="text-xl font-black text-amber-600">{viewingReport.late_arrivals || 0}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">New Enrollments</p>
                                                <p className="text-xl font-black text-blue-600">{viewingReport.new_enrollments || 0}</p>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Staff Present</p>
                                                <p className="text-xl font-black text-gray-800">{viewingReport.staff_present || 0}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Staff Absent</p>
                                                <p className="text-xl font-black text-gray-400">{viewingReport.staff_absent || 0}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="md:col-span-2 space-y-6">
                                        {viewingReport.notable_events && (
                                            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                                <p className="text-[10px] font-black text-maroon uppercase tracking-widest mb-1">Notable Events</p>
                                                <p className="text-sm text-gray-700 leading-relaxed">{viewingReport.notable_events}</p>
                                            </div>
                                        )}
                                        {viewingReport.achievements && (
                                            <div className="p-4 bg-green-50 rounded-2xl border border-green-100">
                                                <p className="text-[10px] font-black text-green-600 uppercase tracking-widest mb-1">Achievements</p>
                                                <p className="text-sm text-gray-700 leading-relaxed">{viewingReport.achievements}</p>
                                            </div>
                                        )}
                                        {viewingReport.incidents && (
                                            <div className="p-4 bg-red-50 rounded-2xl border border-red-100">
                                                <p className="text-[10px] font-black text-red-600 uppercase tracking-widest mb-1">Incidents / Issues</p>
                                                <p className="text-sm text-gray-700 leading-relaxed">{viewingReport.incidents}</p>
                                            </div>
                                        )}
                                        {viewingReport.facilities_issues && (
                                            <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100">
                                                <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1">Facilities Issues</p>
                                                <p className="text-sm text-gray-700 leading-relaxed">{viewingReport.facilities_issues}</p>
                                            </div>
                                        )}
                                        {viewingReport.equipment_maintenance && (
                                            <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100">
                                                <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">Equipment Maintenance</p>
                                                <p className="text-sm text-gray-700 leading-relaxed">{viewingReport.equipment_maintenance}</p>
                                            </div>
                                        )}
                                        {viewingReport.additional_notes && (
                                            <div className="p-4 bg-gray-50/50 rounded-2xl border border-maroon/5">
                                                <p className="text-[10px] font-black text-maroon/40 uppercase tracking-widest mb-1">Additional Notes</p>
                                                <p className="text-sm text-gray-600 italic leading-relaxed">{viewingReport.additional_notes}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Weekly Details */}
                            {activeTab === 'weekly' && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
                                    <div className="space-y-6">
                                        <div>
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Reporting Period</p>
                                            <p className="text-lg font-bold text-gray-800">{new Date(viewingReport.week_start_date).toLocaleDateString()} - {new Date(viewingReport.week_end_date).toLocaleDateString()}</p>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Classes</p>
                                                <p className="text-xl font-black text-gray-800">{viewingReport.total_classes_conducted}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Avg Attendance</p>
                                                <p className="text-xl font-black text-maroon">{parseFloat(viewingReport.average_attendance || 0).toFixed(1)}%</p>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Active Students</p>
                                                <p className="text-xl font-black text-green-600">{viewingReport.active_students}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Assessments</p>
                                                <p className="text-xl font-black text-blue-600">{viewingReport.total_assessments}</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-6">
                                        <div>
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Reported By</p>
                                            <p className="text-lg font-bold text-gray-800">{viewingReport.reported_by}</p>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Revenue Collected</p>
                                                <p className="text-xl font-black text-emerald-600">KES {parseFloat(viewingReport.revenue_collected || 0).toLocaleString()}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">New Enrollments</p>
                                                <p className="text-xl font-black text-blue-600">{viewingReport.new_enrollments || 0}</p>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Disciplinary Cases</p>
                                                <p className="text-xl font-black text-red-500">{viewingReport.disciplinary_cases || 0}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Courses Completed</p>
                                                <p className="text-xl font-black text-gray-800">{viewingReport.courses_completed || 0}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="md:col-span-2 space-y-6">
                                        {viewingReport.key_achievements && (
                                            <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
                                                <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">Key Achievements</p>
                                                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{viewingReport.key_achievements}</p>
                                            </div>
                                        )}
                                        {viewingReport.challenges_faced && (
                                            <div className="p-4 bg-red-50 rounded-2xl border border-red-100">
                                                <p className="text-[10px] font-black text-red-600 uppercase tracking-widest mb-1">Challenges Faced</p>
                                                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{viewingReport.challenges_faced}</p>
                                            </div>
                                        )}
                                        {viewingReport.action_items && (
                                            <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100">
                                                <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1">Action Items (Next Week)</p>
                                                <p className="text-sm text-gray-700 font-bold leading-relaxed whitespace-pre-wrap">{viewingReport.action_items}</p>
                                            </div>
                                        )}
                                        {viewingReport.notes && (
                                            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">General Notes</p>
                                                <p className="text-sm text-gray-600 whitespace-pre-wrap">{viewingReport.notes}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Monthly Details */}
                            {activeTab === 'monthly' && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
                                    <div className="space-y-6">
                                        <div>
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Reporting Month</p>
                                            <p className="text-lg font-bold text-gray-800 uppercase">{viewingReport.month}</p>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Classes</p>
                                                <p className="text-xl font-black text-gray-800">{viewingReport.total_classes}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Avg Attendance</p>
                                                <p className="text-xl font-black text-maroon">{parseFloat(viewingReport.average_attendance || 0).toFixed(1)}%</p>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Students</p>
                                                <p className="text-xl font-black text-green-600">{viewingReport.total_students}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Graduations</p>
                                                <p className="text-xl font-black text-gold">{viewingReport.graduations || 0}</p>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Finance: Revenue</p>
                                                <p className="text-xl font-black text-emerald-600">KES {parseFloat(viewingReport.revenue || 0).toLocaleString()}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Finance: Expenses</p>
                                                <p className="text-xl font-black text-red-500">KES {parseFloat(viewingReport.expenses || 0).toLocaleString()}</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-6">
                                        <div>
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Reported By</p>
                                            <p className="text-lg font-bold text-gray-800">{viewingReport.reported_by}</p>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">New Enrollments</p>
                                                <p className="text-xl font-black text-blue-600">{viewingReport.new_enrollments || 0}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Avg Pass Rate</p>
                                                <p className="text-xl font-black text-maroon">{viewingReport.average_pass_rate || 0}%</p>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Faculty</p>
                                                <p className="text-xl font-black text-gray-800">{viewingReport.total_faculty || 0}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Personnel Flux</p>
                                                <p className="text-sm font-bold text-gray-600">+{viewingReport.new_hires || 0} / -{viewingReport.faculty_departures || 0}</p>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Assessments</p>
                                                <p className="text-xl font-black text-gray-800">{viewingReport.total_assessments || 0}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Dropouts</p>
                                                <p className="text-xl font-black text-red-400">{viewingReport.dropouts || 0}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="md:col-span-2 space-y-6 pt-4 border-t border-gray-50">
                                        {viewingReport.major_achievements && (
                                            <div className="p-4 bg-green-50 rounded-2xl border border-green-100">
                                                <p className="text-[10px] font-black text-green-600 uppercase tracking-widest mb-1">Major Achievements</p>
                                                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{viewingReport.major_achievements}</p>
                                            </div>
                                        )}
                                        {viewingReport.challenges && (
                                            <div className="p-4 bg-red-50 rounded-2xl border border-red-100">
                                                <p className="text-[10px] font-black text-red-600 uppercase tracking-widest mb-1">Critical Challenges</p>
                                                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{viewingReport.challenges}</p>
                                            </div>
                                        )}
                                        {viewingReport.strategic_initiatives && (
                                            <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
                                                <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">Strategic Initiatives</p>
                                                <p className="text-sm text-gray-700 whitespace-pre-wrap">{viewingReport.strategic_initiatives}</p>
                                            </div>
                                        )}
                                        {viewingReport.goals_next_month && (
                                            <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100">
                                                <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1">Goals for Next Month</p>
                                                <p className="text-sm text-gray-700 font-bold whitespace-pre-wrap">{viewingReport.goals_next_month}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Hidden Print View */}
            {printingReport && (
                <>
                    <style>{`
                        @media print {
                            @page { size: A4; margin: 0; }
                            body { margin: 0; padding: 0 !important; }
                            .print-a4 { 
                                width: 210mm !important; 
                                height: 297mm !important; 
                                padding: 15mm !important; 
                                margin: 0 auto !important;
                                box-shadow: none !important;
                                border: 4px double #800000 !important;
                                box-sizing: border-box !important;
                            }
                            #report-print-capture { position: static !important; overflow: visible !important; }
                        }
                    `}</style>
                    <div id="report-print-capture" className="fixed inset-0 bg-white z-[9999] p-8 font-serif overflow-auto print:absolute print:inset-0 print:p-0">
                        <div className="print-a4 mx-auto border-4 border-double border-maroon p-10 bg-white min-h-[297mm] flex flex-col justify-between">
                            <div>
                                <div className="text-center mb-6 border-b-2 border-maroon pb-6">
                                    <div className="flex flex-col items-center mb-4">
                                        <img src="/logo.jpg" alt="College Logo" className="w-20 h-20 object-contain mb-3" />
                                        <h1 className="text-xl font-black text-maroon uppercase tracking-widest mb-1">Beautex Technical Training College</h1>
                                        <p className="text-[10px] font-bold text-gray-400 tracking-[0.2em] uppercase italic">"Empowering minds, shaping innovations"</p>
                                    </div>
                                    <div className="w-16 h-0.5 bg-gold mx-auto mb-6" />
                                    <p className="text-sm text-black font-black uppercase tracking-[0.2em]">Institutional Activity Report ({activeTab})</p>
                                </div>

                                <div className="grid grid-cols-2 gap-8 mb-8 pb-8 border-b border-maroon/10">
                                    <div>
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Date/Period</p>
                                        <p className="text-base font-bold text-maroon uppercase">
                                            {activeTab === 'daily' ? new Date(printingReport.report_date).toLocaleDateString() :
                                                activeTab === 'weekly' ? `${new Date(printingReport.week_start_date).toLocaleDateString()} - ${new Date(printingReport.week_end_date).toLocaleDateString()}` :
                                                    printingReport.month}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Reported By</p>
                                        <p className="text-base font-bold text-maroon uppercase">{printingReport.reported_by}</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-y-6 gap-x-12">
                                    {activeTab === 'daily' ? (
                                        <>
                                            <div><p className="text-[10px] text-gray-400 uppercase">Classes</p><p className="font-bold">{printingReport.classes_conducted}</p></div>
                                            <div><p className="text-[10px] text-gray-400 uppercase">Attendance</p><p className="font-bold">{printingReport.total_attendance_percentage}%</p></div>
                                            <div><p className="text-[10px] text-gray-400 uppercase">Students Present</p><p className="font-bold text-green-600">{printingReport.total_students_present}</p></div>
                                            <div><p className="text-[10px] text-gray-400 uppercase">Students Absent</p><p className="font-bold text-red-600">{printingReport.total_students_absent}</p></div>
                                            <div><p className="text-[10px] text-gray-400 uppercase">Staff Presence</p><p className="font-bold">{printingReport.staff_present || 0} / {(parseInt(printingReport.staff_present || 0) + parseInt(printingReport.staff_absent || 0))}</p></div>
                                            <div><p className="text-[10px] text-gray-400 uppercase">Disciplinary</p><p className="font-bold">{printingReport.disciplinary_cases || 0}</p></div>
                                            <div className="col-span-2 border-t pt-4">
                                                <p className="text-[10px] text-gray-400 uppercase mb-1">Activities & Observations</p>
                                                <p className="text-xs mb-2"><strong>Events:</strong> {printingReport.notable_events || 'None documented.'}</p>
                                                <p className="text-xs mb-2"><strong>Incidents:</strong> {printingReport.incidents || 'None documented.'}</p>
                                                <p className="text-xs mb-2"><strong>Facilities:</strong> {printingReport.facilities_issues || 'No issues reported.'}</p>
                                                <p className="text-xs"><strong>Equipment:</strong> {printingReport.equipment_maintenance || 'No maintenance reported.'}</p>
                                            </div>
                                        </>
                                    ) : activeTab === 'weekly' ? (
                                        <>
                                            <div><p className="text-[10px] text-gray-400 uppercase">Total Classes</p><p className="font-bold">{printingReport.total_classes_conducted}</p></div>
                                            <div><p className="text-[10px] text-gray-400 uppercase">Avg Attendance</p><p className="font-bold">{printingReport.average_attendance}%</p></div>
                                            <div><p className="text-[10px] text-gray-400 uppercase">Active Students</p><p className="font-bold">{printingReport.active_students}</p></div>
                                            <div><p className="text-[10px] text-gray-400 uppercase">Total Assessments</p><p className="font-bold">{printingReport.total_assessments}</p></div>
                                            <div><p className="text-[10px] text-gray-400 uppercase">Revenue Collected</p><p className="font-bold">KES {parseFloat(printingReport.revenue_collected || 0).toLocaleString()}</p></div>
                                            <div><p className="text-[10px] text-gray-400 uppercase">New Enrollments</p><p className="font-bold">{printingReport.new_enrollments || 0}</p></div>
                                            <div className="col-span-2 border-t pt-4">
                                                <p className="text-[10px] text-gray-400 uppercase mb-1">Key Achievements</p>
                                                <p className="text-sm">{printingReport.key_achievements || 'None documented.'}</p>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div><p className="text-[10px] text-gray-400 uppercase">Total Students</p><p className="font-bold">{printingReport.total_students}</p></div>
                                            <div><p className="text-[10px] text-gray-400 uppercase">Avg Attendance</p><p className="font-bold">{printingReport.average_attendance}%</p></div>
                                            <div><p className="text-[10px] text-gray-400 uppercase">Total Revenue</p><p className="font-bold">KES {parseFloat(printingReport.revenue || 0).toLocaleString()}</p></div>
                                            <div><p className="text-[10px] text-gray-400 uppercase">Month Graduations</p><p className="font-bold">{printingReport.graduations || 0}</p></div>
                                            <div><p className="text-[10px] text-gray-400 uppercase">New Enrollments</p><p className="font-bold">{printingReport.new_enrollments || 0}</p></div>
                                            <div><p className="text-[10px] text-gray-400 uppercase">Faculty Count</p><p className="font-bold">{printingReport.total_faculty || 0}</p></div>
                                            <div className="col-span-2 border-t pt-4">
                                                <p className="text-[10px] text-gray-400 uppercase mb-1">Strategic Initiatives</p>
                                                <p className="text-sm italic">{printingReport.strategic_initiatives || 'None documented.'}</p>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>

                            <div className="mt-12 border-t border-maroon/10 pt-8 text-center shrink-0">
                                <p className="text-[10px] font-black text-maroon uppercase tracking-widest mb-1">
                                    Beautex Technical Training College - Registry Operations
                                </p>
                                <p className="text-[8px] text-gray-400 uppercase tracking-widest leading-relaxed">
                                    Location: Utawala, Geokarma behind Astrol Petrol Station | Contact: 0708247557 <br />
                                    Verified Institutional Document | Generated: {new Date().toLocaleString()}
                                </p>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

