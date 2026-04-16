import { useEffect, useState, useMemo } from 'react';
import {
    Calendar, TrendingUp, BarChart3, FileText, Plus, RefreshCw, Download, Info, Users, BookOpen, Building2, Heart,
    X, Eye, Edit, Trash2, Zap, AlertCircle, User, Clock, FileDown, ChevronRight, Printer, CheckCircle, Check, Briefcase, Minus
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
        department: '',
        total_students_expected: 0,
        total_students_present: 0,
        total_students_absent: 0,
        staff_present: 0,
        staff_absent: 0,
        late_arrivals: 0,
        absent_students_list: '',
        classes_conducted: '',
        topics_covered: '',
        practical_sessions: '',
        assessments_conducted: 0,
        total_attendance_percentage: 0,
        meetings_held: '',
        admissions_registrations: '',
        new_enrollments: 0,
        fees_collection_summary: '',
        disciplinary_cases: 0,
        discipline_issues: '',
        student_feedback: '',
        counseling_support: '',
        facilities_issues: '',
        equipment_maintenance: '',
        cleaning_maintenance: '',
        internet_ict_status: '',
        inquiries_received: 0,
        walk_ins: 0,
        social_media_activities: '',
        challenges_faced: '',
        actions_taken: '',
        plans_for_next_day: '',
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
        if (e) e.preventDefault();
        
        // Manual Validation to prevent silent browser blocks
        if (!dailyForm.report_date) {
            toast.error('Report date is required');
            return;
        }
        if (!dailyForm.department) {
            toast.error('Department is required');
            return;
        }

        const reportId = editingReport?.id || editingReport?._id || dailyForm.id || dailyForm._id;
        setLoading(true);
        
        try {
            if (modalMode === 'create') {
                await activityReportsAPI.createDailyReport(dailyForm);
                toast.success('Daily report archived successfully');
            } else {
                if (!reportId) {
                    console.error('Missing ID:', { editingReport, dailyForm });
                    throw new Error('Institutional Reference ID missing');
                }
                await activityReportsAPI.updateDailyReport(reportId, dailyForm);
                toast.success('Report revision authorized');
            }
            setShowModal(false);
            resetForms();
            fetchReports();
        } catch (error) {
            console.error('Daily submission error:', error);
            const errorMsg = error.response?.data?.error || error.message || 'Archive sequence failed';
            toast.error(errorMsg);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmitWeekly = async (e) => {
        e.preventDefault();
        const reportId = editingReport?.id || editingReport?._id;
        try {
            if (modalMode === 'create') {
                await activityReportsAPI.createWeeklyReport(weeklyForm);
                toast.success('Weekly summary finalized');
            } else {
                if (!reportId) throw new Error('Institutional Reference ID missing');
                await activityReportsAPI.updateWeeklyReport(reportId, weeklyForm);
                toast.success('Weekly revision archived');
            }
            setShowModal(false);
            resetForms();
            fetchReports();
        } catch (error) {
            console.error('Error submitting weekly report:', error);
            toast.error(error.response?.data?.error || error.message || 'Summary finalization failed');
        }
    };

    const handleSubmitMonthly = async (e) => {
        e.preventDefault();
        const reportId = editingReport?.id || editingReport?._id;
        try {
            if (modalMode === 'create') {
                await activityReportsAPI.createMonthlyReport(monthlyForm);
                toast.success('Monthly intelligence report archived');
            } else {
                if (!reportId) throw new Error('Institutional Reference ID missing');
                await activityReportsAPI.updateMonthlyReport(reportId, monthlyForm);
                toast.success('Monthly revision authorized');
            }
            setShowModal(false);
            resetForms();
            fetchReports();
        } catch (error) {
            console.error('Error submitting monthly report:', error);
            toast.error(error.response?.data?.error || error.message || 'Archive operation interrupted');
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

        const formatDate = (dateStr) => {
            if (!dateStr) return '';
            const d = new Date(dateStr);
            return isNaN(d.getTime()) ? '' : d.toISOString().split('T')[0];
        };

        if (activeTab === 'daily') {
            setDailyForm({ 
                ...report,
                report_date: formatDate(report.report_date)
            });
        } else if (activeTab === 'weekly') {
            setWeeklyForm({ 
                ...report,
                week_start_date: formatDate(report.week_start_date),
                week_end_date: formatDate(report.week_end_date)
            });
        } else if (activeTab === 'monthly') {
            setMonthlyForm({ 
                ...report,
                month_start_date: formatDate(report.month_start_date),
                month_end_date: formatDate(report.month_end_date)
            });
        }

        setShowModal(true);
    };

    const resetForms = () => {
        setDailyForm({
            report_date: new Date().toISOString().split('T')[0],
            department: '',
            total_students_expected: 0,
            total_students_present: 0,
            total_students_absent: 0,
            absent_students_list: '',
            staff_present: 0,
            staff_absent: 0,
            late_arrivals: 0,
            classes_conducted: '',
            topics_covered: '',
            practical_sessions: '',
            assessments_conducted: 0,
            total_attendance_percentage: 0,
            meetings_held: '',
            admissions_registrations: '',
            new_enrollments: 0,
            fees_collection_summary: '',
            disciplinary_cases: 0,
            discipline_issues: '',
            student_feedback: '',
            counseling_support: '',
            facilities_issues: '',
            equipment_maintenance: '',
            cleaning_maintenance: '',
            internet_ict_status: '',
            inquiries_received: 0,
            walk_ins: 0,
            social_media_activities: '',
            challenges_faced: '',
            actions_taken: '',
            plans_for_next_day: '',
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
                // Pre-capture style adjustments to ensure perfection
                element.style.padding = '0px'; 
                
                const canvas = await html2canvas(element, {
                    scale: 2.5, // Optimized 'Golden Scale' for high-res without glitching
                    useCORS: true,
                    backgroundColor: '#ffffff',
                    windowWidth: 794, 
                    logging: false,
                    imageTimeout: 0,
                    onclone: (clonedDoc) => {
                        const el = clonedDoc.getElementById('report-print-capture');
                        if (el) el.style.padding = '0';
                    }
                });

                // Lossless PNG for crisp text without JPEG artifacts
                const imgData = canvas.toDataURL('image/png'); 
                const pdf = new jsPDF('p', 'mm', 'a4');
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = pdf.internal.pageSize.getHeight();

                const imgProps = pdf.getImageProperties(imgData);
                const ratio = imgProps.height / imgProps.width;
                const totalRenderedHeight = pdfWidth * ratio;

                let heightLeft = totalRenderedHeight;
                let position = 0;

                // Precision addition with manual paging
                pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, totalRenderedHeight, undefined, 'SLOW');
                heightLeft -= pdfHeight;

                while (heightLeft > 0) {
                    position -= pdfHeight;
                    pdf.addPage();
                    pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, totalRenderedHeight, undefined, 'SLOW');
                    heightLeft -= pdfHeight;
                }

                pdf.save(`${type.charAt(0).toUpperCase() + type.slice(1)}_Activity_Report_${report.report_date || report.week_start_date || report.month}.pdf`);
                toast.success('High-Fidelity Archive Exported');
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
                                <form onSubmit={handleSubmitDaily} className="space-y-8">
                                    {/* 1. Basic Information */}
                                    <div className="bg-maroon/[0.02] p-8 rounded-[2rem] border border-maroon/5 space-y-6">
                                        <div className="flex items-center gap-3 border-b border-maroon/5 pb-4">
                                            <div className="w-10 h-10 bg-maroon/10 rounded-xl flex items-center justify-center">
                                                <Info className="w-5 h-5 text-maroon" />
                                            </div>
                                            <div>
                                                <h3 className="text-sm font-black text-maroon uppercase tracking-widest">1. Basic Information</h3>
                                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Categorization & Identity</p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                            <div>
                                                <label className="block text-[10px] font-black text-maroon/40 uppercase tracking-widest mb-2 ml-1">Report Date</label>
                                                <input
                                                    type="date"
                                                    value={dailyForm.report_date}
                                                    onChange={(e) => setDailyForm({ ...dailyForm, report_date: e.target.value })}
                                                    className="w-full px-5 py-3.5 bg-white rounded-2xl border border-gray-200 focus:border-maroon focus:ring-4 focus:ring-maroon/5 outline-none transition-all font-bold text-gray-700"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black text-maroon/40 uppercase tracking-widest mb-2 ml-1">Day of Week</label>
                                                <div className="w-full px-5 py-3.5 bg-gray-50 rounded-2xl border border-gray-100 font-black text-maroon uppercase tracking-widest text-xs">
                                                    {new Date(dailyForm.report_date).toLocaleDateString(undefined, { weekday: 'long' })}
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black text-maroon/40 uppercase tracking-widest mb-2 ml-1">Department / Section</label>
                                                <select
                                                    value={dailyForm.department}
                                                    onChange={(e) => setDailyForm({ ...dailyForm, department: e.target.value })}
                                                    className="w-full px-5 py-3.5 bg-white rounded-2xl border border-gray-200 focus:border-maroon focus:ring-4 focus:ring-maroon/5 outline-none transition-all font-bold text-gray-700"
                                                >
                                                    <option value="">Select Department</option>
                                                    <option value="ICT">ICT Department</option>
                                                    <option value="Cosmetology">Cosmetology & Beauty</option>
                                                    <option value="Business">Business Studies</option>
                                                    <option value="Engineering">Engineering</option>
                                                    <option value="Admin">Administration</option>
                                                    <option value="Finance">Finance / Accounts</option>
                                                    <option value="Marketing">Marketing & Outreach</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 2. Attendance Summary */}
                                    <div className="bg-blue-50/20 p-8 rounded-[2rem] border border-blue-100/50 space-y-6">
                                        <div className="flex items-center gap-3 border-b border-blue-100 pb-4">
                                            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                                                <Users className="w-5 h-5 text-blue-600" />
                                            </div>
                                            <div>
                                                <h3 className="text-sm font-black text-blue-900 uppercase tracking-widest">2. Attendance Summary</h3>
                                                <p className="text-[10px] text-blue-400 font-bold uppercase tracking-wider">Student & Staff Daily Count</p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
                                            <div>
                                                <label className="block text-[10px] font-black text-blue-400 uppercase tracking-widest mb-2 ml-1">Expected</label>
                                                <input
                                                    type="number"
                                                    value={dailyForm.total_students_expected}
                                                    onChange={(e) => setDailyForm({ ...dailyForm, total_students_expected: parseInt(e.target.value) || 0 })}
                                                    className="w-full px-5 py-3.5 bg-white rounded-2xl border border-blue-100 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 outline-none transition-all font-bold text-gray-700"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black text-blue-400 uppercase tracking-widest mb-2 ml-1 text-green-600">Present</label>
                                                <input
                                                    type="number"
                                                    value={dailyForm.total_students_present}
                                                    onChange={(e) => setDailyForm({ ...dailyForm, total_students_present: parseInt(e.target.value) || 0 })}
                                                    className="w-full px-5 py-3.5 bg-white rounded-2xl border border-blue-100 focus:border-green-500 focus:ring-4 focus:ring-green-500/5 outline-none transition-all font-bold text-green-600"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black text-blue-400 uppercase tracking-widest mb-2 ml-1 text-red-600">Absent</label>
                                                <input
                                                    type="number"
                                                    value={dailyForm.total_students_absent}
                                                    onChange={(e) => setDailyForm({ ...dailyForm, total_students_absent: parseInt(e.target.value) || 0 })}
                                                    className="w-full px-5 py-3.5 bg-white rounded-2xl border border-blue-100 focus:border-red-500 focus:ring-4 focus:ring-red-500/5 outline-none transition-all font-bold text-red-600"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black text-blue-400 uppercase tracking-widest mb-2 ml-1">Staff Present</label>
                                                <input
                                                    type="number"
                                                    value={dailyForm.staff_present}
                                                    onChange={(e) => setDailyForm({ ...dailyForm, staff_present: parseInt(e.target.value) || 0 })}
                                                    className="w-full px-5 py-3.5 bg-white rounded-2xl border border-blue-100 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 outline-none transition-all font-bold text-gray-700"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black text-blue-400 uppercase tracking-widest mb-2 ml-1">Staff Absent</label>
                                                <input
                                                    type="number"
                                                    value={dailyForm.staff_absent}
                                                    onChange={(e) => setDailyForm({ ...dailyForm, staff_absent: parseInt(e.target.value) || 0 })}
                                                    className="w-full px-5 py-3.5 bg-white rounded-2xl border border-blue-100 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 outline-none transition-all font-bold text-gray-700"
                                                />
                                            </div>
                                        </div>

                                        {/* Absent Students List */}
                                        <div className="md:col-span-5 mt-2">
                                            <label className="block text-[10px] font-black text-red-400 uppercase tracking-widest mb-2 ml-1">Absent Students (Names)</label>
                                            <textarea
                                                value={dailyForm.absent_students_list}
                                                onChange={(e) => setDailyForm({ ...dailyForm, absent_students_list: e.target.value })}
                                                placeholder="e.g. John Doe, Jane Smith, Omar Ali..."
                                                className="w-full px-5 py-4 bg-white rounded-2xl border border-red-100 focus:border-red-400 focus:ring-4 focus:ring-red-400/5 outline-none transition-all font-bold text-gray-700 h-20 resize-none"
                                            />
                                            <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider mt-1 ml-1">Separate names with commas or enter one per line</p>
                                        </div>
                                    </div>

                                    {/* 3. Academic Activities */}
                                    <div className="bg-purple-50/20 p-8 rounded-[2rem] border border-purple-100/50 space-y-6">
                                        <div className="flex items-center gap-3 border-b border-purple-100 pb-4">
                                            <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                                                <BookOpen className="w-5 h-5 text-purple-600" />
                                            </div>
                                            <div>
                                                <h3 className="text-sm font-black text-purple-900 uppercase tracking-widest">3. Academic Activities</h3>
                                                <p className="text-[10px] text-purple-400 font-bold uppercase tracking-wider">Curriculum Execution & Progress</p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="md:col-span-2">
                                                <label className="block text-[10px] font-black text-purple-400 uppercase tracking-widest mb-2 ml-1">Classes Conducted (List Subjects/Courses)</label>
                                                <textarea
                                                    value={dailyForm.classes_conducted}
                                                    onChange={(e) => setDailyForm({ ...dailyForm, classes_conducted: e.target.value })}
                                                    placeholder="e.g. Intro to Programming, Advanced Styling..."
                                                    className="w-full px-5 py-4 bg-white rounded-2xl border border-purple-100 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/5 outline-none transition-all font-bold text-gray-700 h-20 resize-none"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black text-purple-400 uppercase tracking-widest mb-2 ml-1">Topics Covered</label>
                                                <textarea
                                                    value={dailyForm.topics_covered}
                                                    onChange={(e) => setDailyForm({ ...dailyForm, topics_covered: e.target.value })}
                                                    className="w-full px-5 py-4 bg-white rounded-2xl border border-purple-100 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/5 outline-none transition-all font-bold text-gray-700 h-28 resize-none"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black text-purple-400 uppercase tracking-widest mb-2 ml-1">Practical Sessions</label>
                                                <textarea
                                                    value={dailyForm.practical_sessions}
                                                    onChange={(e) => setDailyForm({ ...dailyForm, practical_sessions: e.target.value })}
                                                    placeholder="Lab work, salon practice, site visits..."
                                                    className="w-full px-5 py-4 bg-white rounded-2xl border border-purple-100 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/5 outline-none transition-all font-bold text-gray-700 h-28 resize-none"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* 4. Administrative Activities */}
                                    <div className="bg-emerald-50/20 p-8 rounded-[2rem] border border-emerald-100/50 space-y-6">
                                        <div className="flex items-center gap-3 border-b border-emerald-100 pb-4">
                                            <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                                                <Building2 className="w-5 h-5 text-emerald-600" />
                                            </div>
                                            <div>
                                                <h3 className="text-sm font-black text-emerald-900 uppercase tracking-widest">4. Administrative Activities</h3>
                                                <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">Office & Financial Operations</p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div>
                                                <label className="block text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-2 ml-1">Meetings Held</label>
                                                <textarea
                                                    value={dailyForm.meetings_held}
                                                    onChange={(e) => setDailyForm({ ...dailyForm, meetings_held: e.target.value })}
                                                    className="w-full px-5 py-4 bg-white rounded-2xl border border-emerald-100 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/5 outline-none transition-all font-bold text-gray-700 h-20 resize-none"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-2 ml-1">Admissions / Registrations</label>
                                                <textarea
                                                    value={dailyForm.admissions_registrations}
                                                    onChange={(e) => setDailyForm({ ...dailyForm, admissions_registrations: e.target.value })}
                                                    className="w-full px-5 py-4 bg-white rounded-2xl border border-emerald-100 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/5 outline-none transition-all font-bold text-gray-700 h-20 resize-none"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-2 ml-1">New Students (Count)</label>
                                                <input
                                                    type="number"
                                                    value={dailyForm.new_enrollments}
                                                    onChange={(e) => setDailyForm({ ...dailyForm, new_enrollments: parseInt(e.target.value) || 0 })}
                                                    className="w-full px-5 py-3.5 bg-white rounded-2xl border border-emerald-100 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/5 outline-none transition-all font-bold text-gray-700"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-2 ml-1">Fees Collection Summary</label>
                                                <input
                                                    type="text"
                                                    value={dailyForm.fees_collection_summary}
                                                    onChange={(e) => setDailyForm({ ...dailyForm, fees_collection_summary: e.target.value })}
                                                    placeholder="Total collected, significant payments..."
                                                    className="w-full px-5 py-3.5 bg-white rounded-2xl border border-emerald-100 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/5 outline-none transition-all font-bold text-gray-700"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* 5. Student Affairs */}
                                    <div className="bg-rose-50/20 p-8 rounded-[2rem] border border-rose-100/50 space-y-6">
                                        <div className="flex items-center gap-3 border-b border-rose-100 pb-4">
                                            <div className="w-10 h-10 bg-rose-100 rounded-xl flex items-center justify-center">
                                                <Heart className="w-5 h-5 text-rose-600" />
                                            </div>
                                            <div>
                                                <h3 className="text-sm font-black text-rose-900 uppercase tracking-widest">5. Student Affairs</h3>
                                                <p className="text-[10px] text-rose-400 font-bold uppercase tracking-wider">Wellbeing & Discipline</p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                            <div>
                                                <label className="block text-[10px] font-black text-rose-400 uppercase tracking-widest mb-2 ml-1 text-red-600">Discipline Issues</label>
                                                <textarea
                                                    value={dailyForm.discipline_issues}
                                                    onChange={(e) => setDailyForm({ ...dailyForm, discipline_issues: e.target.value })}
                                                    className="w-full px-5 py-4 bg-white rounded-2xl border border-rose-100 focus:border-rose-500 focus:ring-4 focus:ring-rose-500/5 outline-none transition-all font-bold text-gray-700 h-28 resize-none"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black text-rose-400 uppercase tracking-widest mb-2 ml-1">Student Feedback / Concerns</label>
                                                <textarea
                                                    value={dailyForm.student_feedback}
                                                    onChange={(e) => setDailyForm({ ...dailyForm, student_feedback: e.target.value })}
                                                    className="w-full px-5 py-4 bg-white rounded-2xl border border-rose-100 focus:border-rose-500 focus:ring-4 focus:ring-rose-500/5 outline-none transition-all font-bold text-gray-700 h-28 resize-none"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black text-rose-400 uppercase tracking-widest mb-2 ml-1">Counseling / Support</label>
                                                <textarea
                                                    value={dailyForm.counseling_support}
                                                    onChange={(e) => setDailyForm({ ...dailyForm, counseling_support: e.target.value })}
                                                    className="w-full px-5 py-4 bg-white rounded-2xl border border-rose-100 focus:border-rose-500 focus:ring-4 focus:ring-rose-500/5 outline-none transition-all font-bold text-gray-700 h-28 resize-none"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* 6. Facilities & Operations */}
                                    <div className="bg-amber-50/20 p-8 rounded-[2rem] border border-amber-100/50 space-y-6">
                                        <div className="flex items-center gap-3 border-b border-amber-100 pb-4">
                                            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                                                <Zap className="w-5 h-5 text-amber-600" />
                                            </div>
                                            <div>
                                                <h3 className="text-sm font-black text-amber-900 uppercase tracking-widest">6. Facilities & Operations</h3>
                                                <p className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">Infrastructure & Maintenance</p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div>
                                                <label className="block text-[10px] font-black text-amber-400 uppercase tracking-widest mb-2 ml-1">Classroom / Lab Condition</label>
                                                <input
                                                    type="text"
                                                    value={dailyForm.facilities_issues}
                                                    onChange={(e) => setDailyForm({ ...dailyForm, facilities_issues: e.target.value })}
                                                    className="w-full px-5 py-3.5 bg-white rounded-2xl border border-amber-100 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/5 outline-none transition-all font-bold text-gray-700"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black text-amber-400 uppercase tracking-widest mb-2 ml-1">Equipment Status</label>
                                                <input
                                                    type="text"
                                                    value={dailyForm.equipment_maintenance}
                                                    onChange={(e) => setDailyForm({ ...dailyForm, equipment_maintenance: e.target.value })}
                                                    className="w-full px-5 py-3.5 bg-white rounded-2xl border border-amber-100 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/5 outline-none transition-all font-bold text-gray-700"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black text-amber-400 uppercase tracking-widest mb-2 ml-1">Cleaning & Maintenance</label>
                                                <input
                                                    type="text"
                                                    value={dailyForm.cleaning_maintenance}
                                                    onChange={(e) => setDailyForm({ ...dailyForm, cleaning_maintenance: e.target.value })}
                                                    className="w-full px-5 py-3.5 bg-white rounded-2xl border border-amber-100 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/5 outline-none transition-all font-bold text-gray-700"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black text-amber-400 uppercase tracking-widest mb-2 ml-1">Internet / ICT Status</label>
                                                <input
                                                    type="text"
                                                    value={dailyForm.internet_ict_status}
                                                    onChange={(e) => setDailyForm({ ...dailyForm, internet_ict_status: e.target.value })}
                                                    className="w-full px-5 py-3.5 bg-white rounded-2xl border border-amber-100 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/5 outline-none transition-all font-bold text-gray-700"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* 7. Marketing & Outreach */}
                                    <div className="bg-indigo-50/20 p-8 rounded-[2rem] border border-indigo-100/50 space-y-6">
                                        <div className="flex items-center gap-3 border-b border-indigo-100 pb-4">
                                            <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                                                <TrendingUp className="w-5 h-5 text-indigo-600" />
                                            </div>
                                            <div>
                                                <h3 className="text-sm font-black text-indigo-900 uppercase tracking-widest">7. Marketing & Outreach</h3>
                                                <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider">Growth & Inquiries</p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                            <div>
                                                <label className="block text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2 ml-1">Inquiries Received</label>
                                                <input
                                                    type="number"
                                                    value={dailyForm.inquiries_received}
                                                    onChange={(e) => setDailyForm({ ...dailyForm, inquiries_received: parseInt(e.target.value) || 0 })}
                                                    className="w-full px-5 py-3.5 bg-white rounded-2xl border border-indigo-100 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 outline-none transition-all font-bold text-gray-700"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2 ml-1">Walk-ins</label>
                                                <input
                                                    type="number"
                                                    value={dailyForm.walk_ins}
                                                    onChange={(e) => setDailyForm({ ...dailyForm, walk_ins: parseInt(e.target.value) || 0 })}
                                                    className="w-full px-5 py-3.5 bg-white rounded-2xl border border-indigo-100 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 outline-none transition-all font-bold text-gray-700"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2 ml-1">Social Media Activities</label>
                                                <input
                                                    type="text"
                                                    value={dailyForm.social_media_activities}
                                                    onChange={(e) => setDailyForm({ ...dailyForm, social_media_activities: e.target.value })}
                                                    placeholder="Posts, ads, engagement..."
                                                    className="w-full px-5 py-3.5 bg-white rounded-2xl border border-indigo-100 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 outline-none transition-all font-bold text-gray-700"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* 8-11. Operational Intelligence */}
                                    <div className="bg-gray-50 p-8 rounded-[2rem] border border-gray-200 space-y-6">
                                        <div className="flex items-center gap-3 border-b border-gray-200 pb-4">
                                            <div className="w-10 h-10 bg-gray-200 rounded-xl flex items-center justify-center">
                                                <FileText className="w-5 h-5 text-gray-600" />
                                            </div>
                                            <div>
                                                <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">Operational Intelligence</h3>
                                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Analysis, Planning & Remarks</p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div>
                                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1 text-red-500">8. Challenges Faced</label>
                                                <textarea
                                                    value={dailyForm.challenges_faced}
                                                    onChange={(e) => setDailyForm({ ...dailyForm, challenges_faced: e.target.value })}
                                                    className="w-full px-5 py-4 bg-white rounded-2xl border border-gray-200 focus:border-red-500 focus:ring-4 focus:ring-red-500/5 outline-none transition-all font-bold text-gray-700 h-28 resize-none"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1 text-green-600">9. Actions Taken</label>
                                                <textarea
                                                    value={dailyForm.actions_taken}
                                                    onChange={(e) => setDailyForm({ ...dailyForm, actions_taken: e.target.value })}
                                                    className="w-full px-5 py-4 bg-white rounded-2xl border border-gray-200 focus:border-green-500 focus:ring-4 focus:ring-green-500/5 outline-none transition-all font-bold text-gray-700 h-28 resize-none"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1 text-blue-600">10. Plans for Next Day</label>
                                                <textarea
                                                    value={dailyForm.plans_for_next_day}
                                                    onChange={(e) => setDailyForm({ ...dailyForm, plans_for_next_day: e.target.value })}
                                                    className="w-full px-5 py-4 bg-white rounded-2xl border border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 outline-none transition-all font-bold text-gray-700 h-28 resize-none"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">11. Remarks (Optional)</label>
                                                <textarea
                                                    value={dailyForm.additional_notes}
                                                    onChange={(e) => setDailyForm({ ...dailyForm, additional_notes: e.target.value })}
                                                    className="w-full px-5 py-4 bg-white rounded-2xl border border-gray-200 focus:border-maroon focus:ring-4 focus:ring-maroon/5 outline-none transition-all font-bold text-gray-700 h-28 resize-none"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex gap-4 justify-end pt-6 sticky bottom-0 bg-white/80 backdrop-blur-md p-4 border-t border-gray-100 rounded-b-[2rem] z-10">
                                        <button
                                            type="button"
                                            onClick={() => setShowModal(false)}
                                            className="px-8 py-4 rounded-2xl border border-gray-200 font-black text-[10px] uppercase tracking-widest text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-all active:scale-95"
                                        >
                                            Discard Entry
                                        </button>
                                        <button
                                            type="submit"
                                            className="px-8 py-4 rounded-2xl bg-maroon text-gold font-black text-[10px] uppercase tracking-[0.2em] hover:bg-maroon/90 transition-all shadow-xl hover:-translate-y-1 active:scale-95 border border-gold/20"
                                        >
                                            {modalMode === 'create' ? 'Seal & Submit Audit' : 'Confirm Revision'}
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
                                <div className="space-y-10 text-left">
                                    {/* Header Info */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-maroon/[0.02] p-8 rounded-[2rem] border border-maroon/5">
                                        <div className="space-y-6">
                                            <div>
                                                <p className="text-[10px] font-black text-maroon/40 uppercase tracking-widest mb-1">Audit Date</p>
                                                <p className="text-xl font-black text-maroon uppercase tracking-tight">
                                                    {new Date(viewingReport.report_date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-maroon/40 uppercase tracking-widest mb-1">Department / Section</p>
                                                <div className="inline-flex items-center gap-2 px-4 py-2 bg-maroon text-gold rounded-full text-[10px] font-black uppercase tracking-widest">
                                                    {viewingReport.department || 'General Institutional Audit'}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="space-y-6 flex flex-col justify-end items-end text-right">
                                            <div>
                                                <p className="text-[10px] font-black text-maroon/40 uppercase tracking-widest mb-1">Reported By</p>
                                                <p className="text-lg font-bold text-gray-800">{viewingReport.reported_by}</p>
                                            </div>
                                            <div className="flex gap-4">
                                                <div className="px-4 py-2 bg-green-50 rounded-xl border border-green-100 flex flex-col items-center">
                                                    <span className="text-[8px] font-black text-green-600 uppercase tracking-widest">Present</span>
                                                    <span className="text-lg font-black text-green-700">{viewingReport.total_students_present}</span>
                                                </div>
                                                <div className="px-4 py-2 bg-red-50 rounded-xl border border-red-100 flex flex-col items-center">
                                                    <span className="text-[8px] font-black text-red-600 uppercase tracking-widest">Absent</span>
                                                    <span className="text-lg font-black text-red-700">{viewingReport.total_students_absent}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 2. Attendance & Staffing */}
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                                        <div className="p-5 bg-blue-50/30 rounded-2xl border border-blue-100">
                                            <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-1">Expected Students</p>
                                            <p className="text-xl font-black text-blue-900">{viewingReport.total_students_expected || 0}</p>
                                        </div>
                                        <div className="p-5 bg-blue-50/30 rounded-2xl border border-blue-100">
                                            <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-1">Staff Present</p>
                                            <p className="text-xl font-black text-blue-900">{viewingReport.staff_present || 0}</p>
                                        </div>
                                        <div className="p-5 bg-blue-50/30 rounded-2xl border border-blue-100">
                                            <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-1">Staff Absent</p>
                                            <p className="text-xl font-black text-blue-900">{viewingReport.staff_absent || 0}</p>
                                        </div>
                                        <div className="p-5 bg-amber-50 rounded-2xl border border-amber-100">
                                            <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest mb-1">Late Arrivals</p>
                                            <p className="text-xl font-black text-amber-700">{viewingReport.late_arrivals || 0}</p>
                                        </div>
                                    </div>

                                    {/* 3. Academic & Administrative */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div className="space-y-6">
                                            <div className="p-6 bg-purple-50/30 rounded-[2rem] border border-purple-100">
                                                <h4 className="text-[10px] font-black text-purple-600 uppercase tracking-[0.2em] border-b border-purple-100 pb-3 mb-4">Academic Activities</h4>
                                                <div className="space-y-4">
                                                    <div>
                                                        <p className="text-[9px] font-black text-purple-300 uppercase tracking-widest mb-1">Classes Conducted</p>
                                                        <p className="text-sm font-bold text-gray-700">{viewingReport.classes_conducted || 'None reported'}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[9px] font-black text-purple-300 uppercase tracking-widest mb-1">Topics Covered</p>
                                                        <p className="text-sm text-gray-600 leading-relaxed">{viewingReport.topics_covered}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[9px] font-black text-purple-300 uppercase tracking-widest mb-1">Practical Sessions</p>
                                                        <p className="text-sm text-gray-600 leading-relaxed">{viewingReport.practical_sessions}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-6">
                                            <div className="p-6 bg-emerald-50/30 rounded-[2rem] border border-emerald-100">
                                                <h4 className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em] border-b border-emerald-100 pb-3 mb-4">Administrative Oversight</h4>
                                                <div className="space-y-4">
                                                    <div>
                                                        <p className="text-[9px] font-black text-emerald-300 uppercase tracking-widest mb-1">Meetings Held</p>
                                                        <p className="text-sm font-bold text-gray-700">{viewingReport.meetings_held || 'No meetings reported'}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[9px] font-black text-emerald-300 uppercase tracking-widest mb-1">Admissions & Growth</p>
                                                        <p className="text-sm text-gray-600 leading-relaxed">{viewingReport.admissions_registrations}</p>
                                                    </div>
                                                    <div className="flex gap-4">
                                                        <div>
                                                            <p className="text-[9px] font-black text-emerald-300 uppercase tracking-widest mb-1">New Students</p>
                                                            <p className="text-lg font-black text-emerald-700">{viewingReport.new_enrollments || 0}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-[9px] font-black text-emerald-300 uppercase tracking-widest mb-1">Fees Collection</p>
                                                            <p className="text-sm font-bold text-emerald-700">{viewingReport.fees_collection_summary || '—'}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 5-6. Student Affairs & Facilities */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div className="p-6 bg-rose-50/30 rounded-[2rem] border border-rose-100">
                                            <h4 className="text-[10px] font-black text-rose-600 uppercase tracking-[0.2em] border-b border-rose-100 pb-3 mb-4">Student Affairs</h4>
                                            <div className="space-y-4">
                                                {viewingReport.discipline_issues && (
                                                    <div>
                                                        <p className="text-[9px] font-black text-red-400 uppercase tracking-widest mb-1">Discipline Issues</p>
                                                        <p className="text-sm text-gray-700 font-medium">{viewingReport.discipline_issues}</p>
                                                    </div>
                                                )}
                                                <div>
                                                    <p className="text-[9px] font-black text-rose-300 uppercase tracking-widest mb-1">Feedback & Concerns</p>
                                                    <p className="text-sm text-gray-600 leading-relaxed">{viewingReport.student_feedback || 'No concerns recorded'}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[9px] font-black text-rose-300 uppercase tracking-widest mb-1">Support Provided</p>
                                                    <p className="text-sm text-gray-600 leading-relaxed italic">{viewingReport.counseling_support || 'Standard support'}</p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="p-6 bg-amber-50/30 rounded-[2rem] border border-amber-100">
                                            <h4 className="text-[10px] font-black text-amber-600 uppercase tracking-[0.2em] border-b border-amber-100 pb-3 mb-4">Facilities & Operations</h4>
                                            <div className="grid grid-cols-1 gap-4">
                                                <div>
                                                    <p className="text-[9px] font-black text-amber-400 uppercase tracking-widest mb-1">Classroom / Lab Condition</p>
                                                    <p className="text-sm text-gray-700 font-medium">{viewingReport.classroom_lab_condition || 'Optimal'}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[9px] font-black text-amber-400 uppercase tracking-widest mb-1">Equipment Status</p>
                                                    <p className="text-sm text-gray-700 font-medium">{viewingReport.equipment_maintenance || 'Operational'}</p>
                                                </div>
                                                <div className="flex gap-4">
                                                    <div className="flex-1">
                                                        <p className="text-[9px] font-black text-amber-400 uppercase tracking-widest mb-1">Cleaning</p>
                                                        <p className="text-xs font-bold text-gray-600">{viewingReport.cleaning_maintenance || 'Satisfactory'}</p>
                                                    </div>
                                                    <div className="flex-1 text-right">
                                                        <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-1">Internet / ICT</p>
                                                        <p className="text-xs font-bold text-blue-600">{viewingReport.internet_ict_status || 'Connected'}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 7-11. Marketing & Intelligence */}
                                    <div className="grid grid-cols-1 gap-8">
                                        <div className="p-8 bg-indigo-50/30 rounded-[2.5rem] border border-indigo-100">
                                            <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em] border-b border-indigo-100 pb-3 mb-6">Marketing & Institutional Intelligence</h4>
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
                                                <div className="bg-white p-4 rounded-2xl shadow-sm">
                                                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Inquiries</p>
                                                    <p className="text-2xl font-black text-indigo-600">{viewingReport.inquiries_received || 0}</p>
                                                </div>
                                                <div className="bg-white p-4 rounded-2xl shadow-sm">
                                                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Walk-ins</p>
                                                    <p className="text-2xl font-black text-indigo-600">{viewingReport.walk_ins || 0}</p>
                                                </div>
                                                <div className="bg-white p-4 rounded-2xl shadow-sm">
                                                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Engagement</p>
                                                    <p className="text-xs font-bold text-gray-600 truncate">{viewingReport.social_media_activities || 'Scheduled'}</p>
                                                </div>
                                            </div>
                                            
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <div className="p-5 bg-red-50/50 rounded-2xl border border-red-50">
                                                    <p className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-2">Challenges Faced</p>
                                                    <p className="text-sm text-gray-700 leading-relaxed">{viewingReport.challenges_faced || 'No major challenges reported'}</p>
                                                </div>
                                                <div className="p-5 bg-green-50/50 rounded-2xl border border-green-50">
                                                    <p className="text-[10px] font-black text-green-600 uppercase tracking-widest mb-2">Actions Taken</p>
                                                    <p className="text-sm text-gray-700 leading-relaxed">{viewingReport.actions_taken || 'Routine operations'}</p>
                                                </div>
                                                <div className="md:col-span-2 p-5 bg-blue-50/50 rounded-2xl border border-blue-50">
                                                    <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-2">Plans for Next Day</p>
                                                    <p className="text-sm text-gray-700 leading-relaxed font-bold">{viewingReport.plans_for_next_day || 'Continue standard curriculum'}</p>
                                                </div>
                                            </div>
                                        </div>

                                        {viewingReport.additional_notes && (
                                            <div className="p-6 bg-gray-50 rounded-2xl border-l-4 border-maroon">
                                                <p className="text-[10px] font-black text-maroon uppercase tracking-widest mb-2">Final Remarks</p>
                                                <p className="text-sm text-gray-600 italic leading-relaxed">"{viewingReport.additional_notes}"</p>
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
                            #report-print-capture { position: static !important; overflow: visible !important; }
                        }
                    `}</style>
                    <div id="report-print-capture" className="absolute top-0 left-[-9999px] bg-white w-[794px] font-sans print:relative print:left-0 print:w-full overflow-hidden">
                        <div className="mx-auto border-[3px] border-gold min-h-[1123px] relative pb-14">
                            {activeTab === 'daily' ? (
                                <div className="p-5 space-y-3">

                                    {/* HEADER */}
                                    <div className="flex flex-col items-center">
                                        <div className="bg-white p-1 rounded-full shadow border border-gray-200 mb-1">
                                            <img src="/app-icon-v2.png" alt="Logo" className="w-12 h-12 object-contain" onError={(e) => { e.target.style.display='none'; }} />
                                        </div>
                                        <h1 className="text-[18px] font-black text-maroon uppercase text-center" style={{ fontFamily: 'Georgia, serif', letterSpacing: '0.1em' }}>
                                            Beautex Technical Training College
                                        </h1>
                                        <div className="flex items-center gap-2 my-1">
                                            <div className="h-[1px] w-14 bg-gold" />
                                            <div className="w-2 h-2 rotate-45 bg-gold" />
                                            <div className="h-[1px] w-14 bg-gold" />
                                        </div>
                                    </div>

                                    {/* DATE / TITLE / TIME BANNER */}
                                    <div className="w-full bg-maroon py-2 px-5 flex justify-between items-center">
                                        <div className="flex flex-col">
                                            <span className="text-[9px] text-gold font-bold uppercase tracking-widest">
                                                {printingReport.report_date ? new Date(printingReport.report_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : ''}
                                            </span>
                                            <span className="text-[10px] font-black text-white uppercase">{printingReport.department || 'General'}</span>
                                        </div>
                                        <h2 className="text-[11px] font-black text-white uppercase tracking-[0.18em] text-center flex-1 px-2">College Daily Activity Report</h2>
                                        <div className="flex flex-col text-right">
                                            <span className="text-[8px] text-gold font-bold uppercase tracking-widest">System Generated At:</span>
                                            <span className="text-[12px] font-black text-white">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                    </div>

                                    {/* ATTENDANCE SUMMARY */}
                                    <div className="space-y-1.5">
                                        <div className="bg-maroon rounded py-1.5 px-3 flex items-center gap-2">
                                            <Users className="w-3.5 h-3.5 text-gold" />
                                            <span className="text-[10px] font-black text-white uppercase tracking-widest">Attendance Summary</span>
                                        </div>
                                        <div className="grid grid-cols-4 gap-2">
                                            <div className="bg-white border border-gray-200 rounded-lg p-2 flex flex-col items-center text-center">
                                                <Users className="w-4 h-4 text-maroon mb-0.5" />
                                                <span className="text-[22px] font-black text-gray-800 leading-none">{printingReport.total_students_expected || 0}</span>
                                                <span className="text-[7px] font-bold text-maroon uppercase tracking-tight mt-1 leading-tight">Total Students Expected</span>
                                            </div>
                                            <div className="bg-white border border-gray-200 rounded-lg p-2 flex flex-col items-center text-center">
                                                <Users className="w-4 h-4 text-green-600 mb-0.5" />
                                                <div className="flex items-baseline gap-0.5">
                                                    <span className="text-[22px] font-black text-gray-800 leading-none">{printingReport.total_students_present || 0}</span>
                                                    {printingReport.total_students_expected > 0 && <span className="text-[9px] font-bold text-green-500">({Math.round((printingReport.total_students_present / printingReport.total_students_expected) * 100)}%)</span>}
                                                </div>
                                                <span className="text-[7px] font-bold text-maroon uppercase tracking-tight mt-1">Students Present</span>
                                                <CheckCircle className="w-3 h-3 text-green-500 mt-0.5" />
                                            </div>
                                            <div className="bg-white border border-gray-200 rounded-lg p-2 flex flex-col items-center text-center">
                                                <Users className="w-4 h-4 text-red-400 mb-0.5" />
                                                <span className="text-[22px] font-black text-gray-800 leading-none">{printingReport.total_students_absent || 0}</span>
                                                <span className="text-[7px] font-bold text-maroon uppercase tracking-tight mt-1">Students Absent</span>
                                            </div>
                                            <div className="bg-white border border-gray-200 rounded-lg p-2 flex flex-col items-center text-center">
                                                <Users className="w-4 h-4 text-amber-500 mb-0.5" />
                                                <span className="text-[22px] font-black text-gray-800 leading-none">{printingReport.staff_present || 0}/{(printingReport.staff_present || 0) + (printingReport.staff_absent || 0)}</span>
                                                <span className="text-[7px] font-bold text-maroon uppercase tracking-tight mt-1">Staff Present</span>
                                                <User className="w-3 h-3 text-amber-500 mt-0.5" />
                                            </div>
                                        </div>
                                        {/* Absent Students Names */}
                                        {printingReport.absent_students_list && (
                                            <div className="bg-red-50 border border-red-100 rounded-lg p-2 mt-1">
                                                <p className="text-[8px] font-black text-red-600 uppercase tracking-widest mb-1">Absent Students:</p>
                                                <p className="text-[8.5px] text-gray-700 font-medium">{printingReport.absent_students_list}</p>
                                            </div>
                                        )}
                                    </div>

                                    {/* TWO-COLUMN SECTIONS */}
                                    <div className="grid grid-cols-2 gap-2">

                                        {/* 1. Academic Activities */}
                                        <div className="space-y-1">
                                            <div className="bg-maroon rounded py-1 px-3 flex items-center gap-2"><BookOpen className="w-3 h-3 text-gold" /><span className="text-[9px] font-black text-white uppercase tracking-widest">Academic Activities</span></div>
                                            <div className="px-2 space-y-0.5 text-[8.5px]">
                                                {printingReport.classes_conducted && <p><span className="font-bold text-gray-700">• Classes Conducted: </span><span className="text-gray-600">{printingReport.classes_conducted}</span></p>}
                                                {printingReport.topics_covered && <p><span className="font-bold text-gray-700">• Topics Covered: </span><span className="text-gray-600">{printingReport.topics_covered}</span></p>}
                                                {printingReport.practical_sessions && <p><span className="font-bold text-gray-700">• Practical Sessions: </span><span className="text-gray-600">{printingReport.practical_sessions}</span></p>}
                                                {!printingReport.classes_conducted && !printingReport.topics_covered && !printingReport.practical_sessions && <p className="text-gray-400 italic">No activities recorded</p>}
                                            </div>
                                        </div>

                                        {/* 2. Administrative Activities */}
                                        <div className="space-y-1">
                                            <div className="bg-maroon rounded py-1 px-3 flex items-center gap-2"><Briefcase className="w-3 h-3 text-gold" /><span className="text-[9px] font-black text-white uppercase tracking-widest">Administrative Activities</span></div>
                                            <div className="px-2 space-y-0.5 text-[8.5px]">
                                                {printingReport.meetings_held && <p><span className="font-bold text-gray-700">• </span><span className="text-gray-600">{printingReport.meetings_held}</span></p>}
                                                {(printingReport.admissions_registrations || printingReport.new_enrollments > 0) && (<p><span className="font-bold text-gray-700">• Admissions held</span>{printingReport.new_enrollments > 0 && <span className="text-gray-600"> | {printingReport.new_enrollments} new students</span>}{printingReport.admissions_registrations && <span className="text-gray-600"> — {printingReport.admissions_registrations}</span>}</p>)}
                                                {printingReport.fees_collection_summary && <p><span className="font-bold text-gray-700">• Fees: </span><span className="text-gray-600">{printingReport.fees_collection_summary}</span></p>}
                                                {!printingReport.meetings_held && !printingReport.admissions_registrations && !printingReport.new_enrollments && <p className="text-gray-400 italic">No activities recorded</p>}
                                            </div>
                                        </div>

                                        {/* 3. Facilities & Operations */}
                                        <div className="space-y-1">
                                            <div className="bg-maroon rounded py-1 px-3 flex items-center gap-2"><Building2 className="w-3 h-3 text-gold" /><span className="text-[9px] font-black text-white uppercase tracking-widest">Facilities &amp; Operations</span></div>
                                            <div className="px-2 space-y-0.5 text-[8.5px]">
                                                {printingReport.facilities_issues && <p><span className="font-bold text-gray-700">• Classroom/Lab condition: </span><span className="text-gray-600">{printingReport.facilities_issues}</span></p>}
                                                {printingReport.equipment_maintenance && <p><span className="font-bold text-gray-700">• Equipment status: </span><span className="text-gray-600">{printingReport.equipment_maintenance}</span></p>}
                                                {printingReport.cleaning_maintenance && <p><span className="font-bold text-gray-700">• Cleaning/Maintenance: </span><span className="text-gray-600">{printingReport.cleaning_maintenance}</span></p>}
                                                {printingReport.internet_ict_status && <p><span className="font-bold text-gray-700">• ICT/Internet: </span><span className="text-gray-600">{printingReport.internet_ict_status}</span></p>}
                                                {!printingReport.facilities_issues && !printingReport.equipment_maintenance && !printingReport.cleaning_maintenance && <p className="text-gray-400 italic">No issues recorded</p>}
                                            </div>
                                        </div>

                                        {/* 4. Student Affairs */}
                                        <div className="space-y-1">
                                            <div className="bg-maroon rounded py-1 px-3 flex items-center gap-2"><Heart className="w-3 h-3 text-gold" /><span className="text-[9px] font-black text-white uppercase tracking-widest">Student Affairs</span></div>
                                            <div className="px-2 space-y-0.5 text-[8.5px]">
                                                {printingReport.discipline_issues && <p><span className="font-bold text-gray-700">• Discipline issue: </span><span className="text-gray-600">{printingReport.discipline_issues}</span></p>}
                                                {printingReport.student_feedback && <p><span className="font-bold text-gray-700">• Students feedback: </span><span className="text-gray-600">{printingReport.student_feedback}</span></p>}
                                                {printingReport.counseling_support && <p><span className="font-bold text-gray-700">• Counseling support: </span><span className="text-gray-600">{printingReport.counseling_support}</span></p>}
                                                {!printingReport.discipline_issues && !printingReport.student_feedback && !printingReport.counseling_support && <p className="text-gray-400 italic">No issues recorded</p>}
                                            </div>
                                        </div>

                                        {/* 5. Challenges Faced */}
                                        <div className="space-y-1">
                                            <div className="bg-maroon rounded py-1 px-3 flex items-center gap-2"><AlertCircle className="w-3 h-3 text-gold" /><span className="text-[9px] font-black text-white uppercase tracking-widest">Challenges Faced</span></div>
                                            <div className="px-2 space-y-0.5 text-[8.5px]">
                                                {printingReport.challenges_faced ? printingReport.challenges_faced.split('\n').filter(Boolean).map((l,i)=><p key={i} className="text-gray-600">• {l.trim()}</p>) : <p className="text-gray-400 italic">None recorded</p>}
                                            </div>
                                        </div>

                                        {/* 6. Plans for Next Day */}
                                        <div className="space-y-1">
                                            <div className="bg-maroon rounded py-1 px-3 flex items-center gap-2"><Calendar className="w-3 h-3 text-gold" /><span className="text-[9px] font-black text-white uppercase tracking-widest">Plans for Next Day</span></div>
                                            <div className="px-2 space-y-0.5 text-[8.5px]">
                                                {printingReport.plans_for_next_day ? printingReport.plans_for_next_day.split('\n').filter(Boolean).map((l,i)=><p key={i} className="text-gray-600">• {l.trim()}</p>) : <p className="text-gray-400 italic">None recorded</p>}
                                            </div>
                                        </div>

                                        {/* 7. Actions Taken */}
                                        <div className="space-y-1">
                                            <div className="bg-maroon rounded py-1 px-3 flex items-center gap-2"><Zap className="w-3 h-3 text-gold" /><span className="text-[9px] font-black text-white uppercase tracking-widest">Actions Taken</span></div>
                                            <div className="px-2 space-y-0.5 text-[8.5px]">
                                                {printingReport.actions_taken ? printingReport.actions_taken.split('\n').filter(Boolean).map((l,i)=><p key={i} className="text-gray-600">• {l.trim()}</p>) : <p className="text-gray-400 italic">None recorded</p>}
                                            </div>
                                        </div>

                                        {/* 8. Marketing & Outreach */}
                                        <div className="space-y-1">
                                            <div className="bg-maroon rounded py-1 px-3 flex items-center gap-2"><TrendingUp className="w-3 h-3 text-gold" /><span className="text-[9px] font-black text-white uppercase tracking-widest">Marketing &amp; Outreach</span></div>
                                            <div className="px-2 space-y-0.5 text-[8.5px]">
                                                {(printingReport.inquiries_received > 0) && <p><span className="font-bold text-gray-700">• Inquiries received: </span><span className="text-gray-600">{printingReport.inquiries_received}</span></p>}
                                                {(printingReport.walk_ins > 0) && <p><span className="font-bold text-gray-700">• Walk-ins: </span><span className="text-gray-600">{printingReport.walk_ins}</span></p>}
                                                {printingReport.social_media_activities && <p><span className="font-bold text-gray-700">• Social media post: </span><span className="text-gray-600">{printingReport.social_media_activities}</span></p>}
                                                {!printingReport.inquiries_received && !printingReport.walk_ins && !printingReport.social_media_activities && <p className="text-gray-400 italic">None recorded</p>}
                                            </div>
                                        </div>

                                        {/* 9. General Remarks - full width */}
                                        <div className="col-span-2 space-y-1">
                                            <div className="bg-maroon rounded py-1 px-3 flex items-center gap-2"><Info className="w-3 h-3 text-gold" /><span className="text-[9px] font-black text-white uppercase tracking-widest">General Remarks</span></div>
                                            <div className="px-2 text-[8.5px]"><span className="text-gray-600">{printingReport.additional_notes || 'No general remarks recorded.'}</span></div>
                                        </div>

                                    </div>

                                    {/* AUTHORIZATION BLOCK */}
                                    <div className="pt-3">
                                        <p className="text-center text-[9px] font-black text-gold uppercase tracking-[0.3em] mb-4">Report Authorized By:</p>
                                        <div className="grid grid-cols-3 gap-6">
                                            {[
                                                { name: printingReport.reported_by || '', title: 'PREPARED BY (Registrar)' },
                                                { name: '', title: 'VERIFIED BY (Assistant Director)' },
                                                { name: '', title: 'APPROVED BY (Director)' }
                                            ].map((signer, sIdx) => (
                                                <div key={sIdx} className="flex flex-col items-center">
                                                    <div className="h-8 w-full flex items-end justify-center">
                                                        {signer.name && <span className="italic font-serif text-lg text-gray-400 opacity-50 select-none pb-1">{signer.name.split(' ').map(n=>n[0]).join('')}</span>}
                                                    </div>
                                                    <div className="w-full h-[1px] bg-gray-500" />
                                                    <span className="text-[8px] font-black text-gray-800 tracking-wide mt-1 text-center">{signer.name ? signer.name.toUpperCase() : ''}</span>
                                                    <span className="text-[7px] text-gray-500 font-bold uppercase tracking-widest mt-0.5">{signer.title}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* FOOTER */}
                                    <div className="absolute bottom-0 left-0 right-0 bg-maroon py-2 flex items-center justify-center">
                                        <p className="text-[9px] font-black text-white uppercase tracking-[0.25em]">Beautex Technical Training College | Excellence In Skills</p>
                                    </div>

                                </div>
                            ) : activeTab === 'weekly' ? (
                                <div className="p-8 space-y-8">
                                    <div className="space-y-6 text-[11px] leading-tight">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="p-4 border border-blue-100 rounded-xl bg-blue-50/20">
                                                <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest mb-2 border-b border-blue-100 pb-1">Academic Summary</p>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div><p className="text-[8px] text-gray-500 uppercase">Total Classes</p><p className="font-bold">{printingReport.total_classes_conducted}</p></div>
                                                    <div><p className="text-[8px] text-gray-500 uppercase">Avg Attendance</p><p className="font-bold text-maroon">{printingReport.average_attendance}%</p></div>
                                                    <div><p className="text-[8px] text-gray-500 uppercase">Assessments</p><p className="font-bold">{printingReport.total_assessments}</p></div>
                                                    <div><p className="text-[8px] text-gray-500 uppercase">Completions</p><p className="font-bold">{printingReport.courses_completed || 0}</p></div>
                                                </div>
                                            </div>

                                            <div className="p-4 border border-emerald-100 rounded-xl bg-emerald-50/20">
                                                <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mb-2 border-b border-emerald-100 pb-1">Administrative Growth</p>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div><p className="text-[8px] text-gray-500 uppercase">New Enrollments</p><p className="font-bold text-blue-600">+{printingReport.new_enrollments || 0}</p></div>
                                                    <div><p className="text-[8px] text-gray-500 uppercase">Active Students</p><p className="font-bold">{printingReport.active_students}</p></div>
                                                    <div className="col-span-2"><p className="text-[8px] text-gray-500 uppercase">Revenue Collected</p><p className="font-bold text-emerald-700">KES {parseFloat(printingReport.revenue_collected || 0).toLocaleString()}</p></div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="p-4 border border-amber-100 rounded-xl bg-amber-50/20">
                                            <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest mb-2 border-b border-amber-100 pb-1">Strategic Insights</p>
                                            <div className="space-y-4">
                                                {printingReport.key_achievements && (
                                                    <div>
                                                        <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Key Achievements</p>
                                                        <p className="text-sm">{printingReport.key_achievements}</p>
                                                    </div>
                                                )}
                                                {printingReport.challenges_faced && (
                                                    <div>
                                                        <p className="text-[8px] font-black text-red-500 uppercase tracking-widest mb-1">Challenges Faced</p>
                                                        <p className="text-sm italic">{printingReport.challenges_faced}</p>
                                                    </div>
                                                )}
                                                {printingReport.action_items && (
                                                    <div>
                                                        <p className="text-[8px] font-black text-blue-600 uppercase tracking-widest mb-1">Action Items (Next Week)</p>
                                                        <p className="font-bold">{printingReport.action_items}</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="p-3 border border-red-50 rounded-xl">
                                                <p className="text-[8px] font-black text-red-400 uppercase tracking-widest mb-1">Disciplinary Matters</p>
                                                <p className="font-bold">{printingReport.disciplinary_cases || 0} Cases Documented</p>
                                            </div>
                                            {printingReport.notes && (
                                                <div className="p-3 border border-gray-100 rounded-xl">
                                                    <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">General Notes</p>
                                                    <p className="italic text-gray-500">"{printingReport.notes}"</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    {/* Institutional Footer */}
                                    <div className="absolute bottom-0 left-0 right-0 h-10 bg-maroon flex items-center justify-center">
                                        <p className="text-[9px] font-black text-white uppercase tracking-[0.2em]">
                                            Beautex Technical Training College | Excellence In Skills
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-8 space-y-8">
                                    <div className="space-y-6 text-[11px] leading-tight">
                                        <div className="grid grid-cols-2 gap-4">
                                            {/* Financial Performance */}
                                            <div className="p-4 border border-emerald-100 rounded-xl bg-emerald-50/20">
                                                <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mb-2 border-b border-emerald-100 pb-1">Institutional Finance</p>
                                                <div className="space-y-2">
                                                    <div className="flex justify-between"><span>Total Revenue</span><span className="font-bold">KES {parseFloat(printingReport.revenue || 0).toLocaleString()}</span></div>
                                                    <div className="flex justify-between text-red-600"><span>Operating Expenses</span><span className="font-bold">KES {parseFloat(printingReport.expenses || 0).toLocaleString()}</span></div>
                                                    <div className="flex justify-between border-t border-emerald-100 pt-1 font-black text-emerald-800">
                                                        <span>Net Operating Surplus</span>
                                                        <span>KES {parseFloat((printingReport.revenue || 0) - (printingReport.expenses || 0)).toLocaleString()}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Academic Analytics */}
                                            <div className="p-4 border border-indigo-100 rounded-xl bg-indigo-50/20">
                                                <p className="text-[9px] font-black text-indigo-600 uppercase tracking-widest mb-2 border-b border-indigo-100 pb-1">Academic Analytics</p>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div><p className="text-[8px] text-gray-400 uppercase">Classes</p><p className="font-bold">{printingReport.total_classes}</p></div>
                                                    <div><p className="text-[8px] text-gray-400 uppercase">Avg Att.</p><p className="font-bold text-maroon">{printingReport.average_attendance}%</p></div>
                                                    <div><p className="text-[8px] text-gray-400 uppercase">Assessments</p><p className="font-bold">{printingReport.total_assessments || 0}</p></div>
                                                    <div><p className="text-[8px] text-gray-400 uppercase">Pass Rate</p><p className="font-bold text-green-600">{printingReport.average_pass_rate || 0}%</p></div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-3 gap-4">
                                            {/* Student Flux */}
                                            <div className="p-4 border border-blue-100 rounded-xl">
                                                <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest mb-2 border-b border-blue-100 pb-1">Enrollment Pipeline</p>
                                                <div className="space-y-1">
                                                    <p><strong>Total Pop:</strong> {printingReport.total_students}</p>
                                                    <p className="text-blue-600"><strong>New Entry:</strong> +{printingReport.new_enrollments || 0}</p>
                                                    <p className="text-gold-600"><strong>Graduates:</strong> {printingReport.graduations || 0}</p>
                                                    <p className="text-red-500"><strong>Dropouts:</strong> {printingReport.dropouts || 0}</p>
                                                </div>
                                            </div>

                                            {/* Staffing */}
                                            <div className="p-4 border border-purple-100 rounded-xl break-inside-avoid">
                                                <p className="text-[9px] font-black text-purple-600 uppercase tracking-widest mb-2 border-b border-purple-100 pb-1">Faculty & Personnel</p>
                                                <div className="space-y-1">
                                                    <p><strong>Total Faculty:</strong> {printingReport.total_faculty || 0}</p>
                                                    <p className="text-green-600"><strong>New Hires:</strong> +{printingReport.new_hires || 0}</p>
                                                    <p className="text-red-600"><strong>Departures:</strong> -{printingReport.faculty_departures || 0}</p>
                                                </div>
                                            </div>

                                            {/* Strategic Summary */}
                                            <div className="p-4 border border-gray-100 rounded-xl bg-gray-50/50 flex flex-col justify-center text-center">
                                                <p className="text-[10px] font-black text-gray-800 uppercase tracking-widest mb-1">Intelligence Status</p>
                                                <p className="text-[8px] text-gray-400 uppercase">Verified Audit Document</p>
                                            </div>
                                        </div>

                                        {/* Strategic Initiatives & Goals */}
                                        <div className="space-y-4">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="p-4 border border-green-50 rounded-xl">
                                                    <p className="text-[9px] font-black text-green-600 uppercase tracking-widest mb-1">Major Achievements</p>
                                                    <p className="text-sm">{printingReport.major_achievements || 'Routine Excellence'}</p>
                                                </div>
                                                <div className="p-4 border border-red-50 rounded-xl">
                                                    <p className="text-[9px] font-black text-red-600 uppercase tracking-widest mb-1">Critical Challenges</p>
                                                    <p className="text-sm italic">{printingReport.challenges || 'Managed'}</p>
                                                </div>
                                            </div>
                                            <div className="p-4 border border-blue-100 rounded-xl bg-blue-50/10">
                                                <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest mb-1">Strategic Initiatives & Future Goals</p>
                                                <p className="text-sm mb-2">{printingReport.strategic_initiatives}</p>
                                                <p className="text-sm font-bold border-t border-blue-50 pt-2">Next Month: {printingReport.goals_next_month || 'Continued Growth'}</p>
                                            </div>
                                        </div>
                                    </div>
                                    {/* Institutional Footer */}
                                    <div className="absolute bottom-0 left-0 right-0 h-10 bg-maroon flex items-center justify-center">
                                        <p className="text-[9px] font-black text-white uppercase tracking-[0.2em]">
                                            Beautex Technical Training College | Excellence In Skills
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}


