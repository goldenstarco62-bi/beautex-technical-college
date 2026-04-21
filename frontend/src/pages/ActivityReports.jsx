import { useEffect, useState, useMemo } from 'react';
import {
    Calendar, TrendingUp, BarChart3, FileText, Plus, RefreshCw, Download, Info, Users, BookOpen, Building2, Heart,
    X, Eye, Edit, Trash2, Zap, AlertCircle, User, Clock, FileDown, ChevronRight, ChevronLeft, Printer, CheckCircle, Check, Briefcase, Minus, QrCode, Fingerprint
} from 'lucide-react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { toast } from 'react-hot-toast';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { activityReportsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import ReportPDFTemplate from './ReportPDFTemplate';

export default function ActivityReports() {
    const { user } = useAuth();
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
    const [consolidatedData, setConsolidatedData] = useState(null);
    const [isConsolidating, setIsConsolidating] = useState(false);

    // Date filters
    const [filterDateFrom, setFilterDateFrom] = useState('');
    const [filterDateTo, setFilterDateTo] = useState('');

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

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

    // FIX: Memoize filtered and sorted reports to avoid double-computation in JSX
    const filteredDailyReports = useMemo(() => {
        return dailyReports
            .filter(r => {
                // Normalize date to YYYY-MM-DD string for comparison
                const d = r.report_date ? new Date(r.report_date).toISOString().split('T')[0] : '';
                return (!filterDateFrom || d >= filterDateFrom) && (!filterDateTo || d <= filterDateTo);
            })
            .sort((a, b) => {
                const dateA = a.report_date ? new Date(a.report_date).toISOString() : '';
                const dateB = b.report_date ? new Date(b.report_date).toISOString() : '';
                return dateB.localeCompare(dateA);
            });
    }, [dailyReports, filterDateFrom, filterDateTo]);

    // Resets page when filters or tabs change
    useEffect(() => {
        setCurrentPage(1);
    }, [filterDateFrom, filterDateTo, activeTab]);

    const paginatedDailyReports = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return filteredDailyReports.slice(start, start + itemsPerPage);
    }, [filteredDailyReports, currentPage]);

    const filteredWeeklyReports = useMemo(() => {
        return weeklyReports
            .filter(r => {
                const d = (r.week_start_date || r.report_date) ? new Date(r.week_start_date || r.report_date).toISOString().split('T')[0] : '';
                return (!filterDateFrom || d >= filterDateFrom) && (!filterDateTo || d <= filterDateTo);
            })
            .sort((a, b) => {
                const dateA = (a.week_start_date || a.report_date) ? new Date(a.week_start_date || a.report_date).toISOString() : '';
                const dateB = (b.week_start_date || b.report_date) ? new Date(b.week_start_date || b.report_date).toISOString() : '';
                return dateB.localeCompare(dateA);
            });
    }, [weeklyReports, filterDateFrom, filterDateTo]);

    const filteredMonthlyReports = useMemo(() => {
        return monthlyReports
            .filter(r => {
                const d = (r.month_start_date || r.report_date) ? new Date(r.month_start_date || r.report_date).toISOString().split('T')[0] : '';
                return (!filterDateFrom || d >= filterDateFrom) && (!filterDateTo || d <= filterDateTo);
            })
            .sort((a, b) => {
                const dateA = (a.month_start_date || a.report_date) ? new Date(a.month_start_date || a.report_date).toISOString() : '';
                const dateB = (b.month_start_date || b.report_date) ? new Date(b.month_start_date || b.report_date).toISOString() : '';
                return dateB.localeCompare(dateA);
            });
    }, [monthlyReports, filterDateFrom, filterDateTo]);

    const paginatedWeeklyReports = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return filteredWeeklyReports.slice(start, start + itemsPerPage);
    }, [filteredWeeklyReports, currentPage]);

    const paginatedMonthlyReports = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return filteredMonthlyReports.slice(start, start + itemsPerPage);
    }, [filteredMonthlyReports, currentPage]);

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
                const res = await activityReportsAPI.getDailyReports({ limit: 50 });
                setDailyReports(res.data.data || []);
            } else if (activeTab === 'weekly') {
                const res = await activityReportsAPI.getWeeklyReports({ limit: 30 });
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
        
        console.log('🚀 [ActivityReports] Starting Daily Submission...', {
            modalMode,
            report_date: dailyForm.report_date,
            department: dailyForm.department
        });

        // Manual Validation to prevent silent browser blocks
        if (!dailyForm.report_date) {
            console.warn('❌ [ActivityReports] Validation Failed: report_date missing');
            toast.error('Report date is required');
            return;
        }
        if (!dailyForm.department) {
            console.warn('❌ [ActivityReports] Validation Failed: department missing');
            toast.error('Department is required');
            return;
        }

        const reportId = editingReport?.id || editingReport?._id || dailyForm.id || dailyForm._id;
        console.log('🆔 [ActivityReports] Target Report ID:', reportId);
        
        setLoading(true);

        try {
            if (modalMode === 'create') {
                console.log('🆕 [ActivityReports] Calling createDailyReport API with payload:', dailyForm);
                await activityReportsAPI.createDailyReport(dailyForm);
                toast.success('Daily report archived successfully');
            } else {
                if (!reportId) {
                    console.error('❌ [ActivityReports] Update Failed: Missing ID', { editingReport, dailyForm });
                    throw new Error('Institutional Reference ID missing');
                }
                console.log(`🆙 [ActivityReports] Updating report ${reportId}...`);
                await activityReportsAPI.updateDailyReport(reportId, dailyForm);
                toast.success('Report revision authorized');
            }
            console.log('✅ [ActivityReports] Submission Successful. Closing modal...');
            setShowModal(false);
            resetForms();
            fetchReports();
        } catch (error) {
            console.error('❌ [ActivityReports] Daily submission error:', error);
            const errorMsg = error.response?.data?.error || error.message || 'Archive sequence failed';
            
            // Specialized handling for duplicates
            if (errorMsg.toLowerCase().includes('unique') || errorMsg.toLowerCase().includes('already exists')) {
                toast.error(`A report for ${dailyForm.report_date} in ${dailyForm.department} already exists.`);
            } else {
                toast.error(errorMsg);
            }
        } finally {
            setLoading(false);
            console.log('🔚 [ActivityReports] Submission procedure complete.');
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
            // Fetch stats (quantitative)
            const { data: statsRes } = await activityReportsAPI.getAutoCapture({ startDate: start, endDate: end });
            const stats = statsRes.data;

            // Fetch consolidation (qualitative)
            let consolidation = null;
            if (activeTab === 'weekly' || activeTab === 'monthly') {
                try {
                    const { data: consRes } = await activityReportsAPI.getConsolidated({ startDate: start, endDate: end });
                    if (consRes.success) consolidation = consRes.data;
                } catch (e) {
                    console.error("Consolidation fetch error:", e);
                }
            }

            if (activeTab === 'daily') {
                setDailyForm(prev => ({
                    ...prev,
                    total_students_expected: stats.attendance.Present + stats.attendance.Absent + stats.attendance.Late,
                    total_students_present: stats.attendance.Present,
                    total_students_absent: stats.attendance.Absent,
                    late_arrivals: stats.attendance.Late,
                    absent_students_list: stats.absent_student_names?.join(', ') || '',
                    new_enrollments: stats.new_enrollments,
                    staff_present: stats.total_faculty, 
                    total_attendance_percentage: stats.attendance.Present + stats.attendance.Absent + stats.attendance.Late > 0
                        ? parseFloat(((stats.attendance.Present / (stats.attendance.Present + stats.attendance.Absent + stats.attendance.Late)) * 100).toFixed(1))
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
                    active_students: stats.attendance.Present,
                    // Qualitative populate
                    key_achievements: consolidation ? [...new Set(consolidation.qualitative.achievements)].join('\n\n') : prev.key_achievements,
                    challenges_faced: consolidation ? [...new Set(consolidation.qualitative.challenges)].join('\n\n') : prev.challenges_faced,
                    action_items: consolidation ? [...new Set(consolidation.qualitative.plans)].join('\n\n') : prev.action_items,
                    notes: consolidation ? `Consolidated weekly audit covering ${consolidation.total_reports} departmental daily reports.` : prev.notes
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
                    // Qualitative populate
                    major_achievements: consolidation ? [...new Set(consolidation.qualitative.achievements)].join('\n\n') : prev.major_achievements,
                    challenges: consolidation ? [...new Set(consolidation.qualitative.challenges)].join('\n\n') : prev.challenges,
                    strategic_initiatives: consolidation ? [...new Set(consolidation.qualitative.plans)].join('\n\n') : prev.strategic_initiatives,
                    additional_notes: consolidation ? `Executive monthly performance audit aggregated from all campus departments.` : prev.additional_notes
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

    const handlePrint = async (report) => {
        try {
            setLoading(true);
            const { data } = await activityReportsAPI.getById(report._id || report.id, activeTab);
            const fullReport = data.data;
            setPrintingReport({ ...fullReport, reportType: activeTab });
            
            // FIX: Store timer for cleanup and use a robust condition for printing
            const printTimer = setTimeout(() => {
                const element = document.getElementById('report-print-capture');
                if (!element) {
                    console.error('Print capture element not found');
                    setLoading(false);
                    setPrintingReport(null);
                    return;
                }
                
                // Note: window.print() still prints the whole window, but since printingReport is set,
                // the CSS @media print should be configured to only show #report-print-capture.
                window.print();
                setPrintingReport(null);
                setLoading(false);
            }, 1000);

            // Cleanup handle for the timer
            return () => clearTimeout(printTimer);
        } catch (error) {
            console.error('Print preparation failed:', error);
            toast.error('Print engine initialization failed');
            setLoading(false);
            setPrintingReport(null);
        }
    };

    const handleRetroSync = async (report) => {
        setLoading(true);
        try {
            let start, end;
            const reportDate = report.report_date ? new Date(report.report_date).toISOString().split('T')[0] : 
                               report.week_start_date ? new Date(report.week_start_date).toISOString().split('T')[0] : 
                               report.month_start_date ? new Date(report.month_start_date).toISOString().split('T')[0] : '';
            
            if (activeTab === 'daily') {
                start = reportDate;
                end = reportDate;
            } else if (activeTab === 'weekly') {
                start = new Date(report.week_start_date).toISOString().split('T')[0];
                end = new Date(report.week_end_date).toISOString().split('T')[0];
            } else if (activeTab === 'monthly') {
                start = new Date(report.month_start_date).toISOString().split('T')[0];
                end = new Date(report.month_end_date).toISOString().split('T')[0];
            }

            const { data } = await activityReportsAPI.getAutoCapture({ startDate: start, endDate: end });
            const stats = data.data;

            const updatedData = { ...report };
            if (activeTab === 'daily') {
                updatedData.absent_students_list = stats.absent_student_names?.join(', ') || '';
                updatedData.total_students_expected = stats.attendance.Present + stats.attendance.Absent + stats.attendance.Late;
                updatedData.total_students_present = stats.attendance.Present;
                updatedData.total_students_absent = stats.attendance.Absent;
                updatedData.late_arrivals = stats.attendance.Late;
                updatedData.total_attendance_percentage = updatedData.total_students_expected > 0
                    ? parseFloat(((updatedData.total_students_present / updatedData.total_students_expected) * 100).toFixed(1))
                    : 0;
            }
            
            if (activeTab === 'daily') await activityReportsAPI.updateDailyReport(report.id || report._id, updatedData);
            else if (activeTab === 'weekly') await activityReportsAPI.updateWeeklyReport(report.id || report._id, updatedData);
            else if (activeTab === 'monthly') await activityReportsAPI.updateMonthlyReport(report.id || report._id, updatedData);

            toast.success('Record audit sync completed');
            fetchReports(); // Safer than manual state updates for now
            if (viewingReport) setViewingReport(updatedData);
        } catch (error) {
            console.error('Retro-sync error:', error);
            toast.error('Failed to sync legacy audit data');
        } finally {
            setLoading(false);
        }
    };

    const handleDownload = async (report) => {
        try {
            setLoading(true);
            const { data } = await activityReportsAPI.getById(report._id || report.id, activeTab);
            const fullReport = data.data;
            setPrintingReport({ ...fullReport, reportType: activeTab });
            
            const type = activeTab;
            // FIX: Cleanup handle for memory leak prevention
            const downloadTimer = setTimeout(async () => {
                const element = document.getElementById('report-print-capture');
                if (!element) {
                    setLoading(false);
                    setPrintingReport(null);
                    return;
                }
                try {
                    // FIX: Removed live DOM mutation. Pass overrides to onclone instead.
                    const canvas = await html2canvas(element, {
                        scale: 2.0, 
                        useCORS: true,
                        backgroundColor: '#ffffff',
                        windowWidth: 794, 
                        logging: false,
                        imageTimeout: 0,
                        onclone: (clonedDoc) => {
                            const el = clonedDoc.getElementById('report-print-capture');
                            if (el) {
                                el.style.padding = '0';
                                // Ensure it's not hidden for capture
                                el.style.left = '0';
                                el.style.position = 'relative';
                            }
                        }
                    });

                    const imgData = canvas.toDataURL('image/jpeg', 0.95); 
                    const pdf = new jsPDF('p', 'mm', 'a4');
                    const pdfWidth = pdf.internal.pageSize.getWidth();
                    const pdfHeight = pdf.internal.pageSize.getHeight();

                    const imgProps = pdf.getImageProperties(imgData);
                    const ratio = imgProps.height / imgProps.width;
                    const totalRenderedHeight = pdfWidth * ratio;

                    let heightLeft = totalRenderedHeight;
                    let position = 0;

                    pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, totalRenderedHeight, undefined, 'FAST');
                    heightLeft -= pdfHeight;

                    while (heightLeft > 0) {
                        position -= pdfHeight;
                        pdf.addPage();
                        pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, totalRenderedHeight, undefined, 'FAST');
                        heightLeft -= pdfHeight;
                    }

                    pdf.save(`${type.charAt(0).toUpperCase() + type.slice(1)}_Activity_Report_${fullReport.report_date || fullReport.week_start_date || fullReport.month}.pdf`);
                    toast.success('Report Exported Successfully');
                } catch (error) {
                    console.error('Download failed:', error);
                    toast.error('Document generation failed');
                } finally {
                    setPrintingReport(null);
                    setLoading(false);
                }
            }, 1000);

            return () => clearTimeout(downloadTimer);
        } catch (error) {
            console.error('Download preparation failed:', error);
            toast.error('Failed to prepare document for download');
            setLoading(false);
            setPrintingReport(null);
        }
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

    // --- Pagination Component ---
    const PaginationControls = ({ totalItems, currentPage, setCurrentPage, itemsPerPage }) => {
        const totalPages = Math.ceil(totalItems / itemsPerPage);
        if (totalPages <= 1) return null;

        const pages = [];
        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
                pages.push(i);
            } else if (pages[pages.length - 1] !== '...') {
                pages.push('...');
            }
        }

        return (
            <div className="flex items-center justify-between mt-12 bg-white/50 backdrop-blur-md p-4 rounded-3xl border border-maroon/5 shadow-xl">
                <div className="text-[10px] font-black text-maroon/40 uppercase tracking-widest pl-4">
                    Showing <span className="text-maroon">{(currentPage - 1) * itemsPerPage + 1}</span> - <span className="text-maroon">{Math.min(currentPage * itemsPerPage, totalItems)}</span> of <span className="text-maroon">{totalItems}</span>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                        className="p-3 rounded-xl border border-maroon/10 text-maroon disabled:opacity-30 hover:bg-maroon hover:text-gold transition-all"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <div className="flex items-center gap-1">
                        {pages.map((p, idx) => (
                            p === '...' ? (
                                <span key={`dots-${idx}`} className="px-4 text-maroon/40 font-black">...</span>
                            ) : (
                                <button
                                    key={p}
                                    onClick={() => setCurrentPage(p)}
                                    className={`w-10 h-10 rounded-xl font-black text-[10px] transition-all ${currentPage === p
                                        ? 'bg-maroon text-gold shadow-lg shadow-maroon/20 translate-y-[-2px]'
                                        : 'text-maroon/60 hover:bg-maroon/5 hover:text-maroon'
                                    }`}
                                >
                                    {p}
                                </button>
                            )
                        ))}
                    </div>
                    <button
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                        className="p-3 rounded-xl border border-maroon/10 text-maroon disabled:opacity-30 hover:bg-maroon hover:text-gold transition-all"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            </div>
        );
    };

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
                        { id: 'monthly', label: 'Monthly Intelligence', icon: BarChart3 },
                        { id: 'consolidated', label: 'Board Audit', icon: Zap }
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
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{filteredDailyReports.length} Entries Archived</span>
                        </div>

                        {filteredDailyReports.length === 0 ? (
                            <div className="text-center py-20 bg-maroon/[0.02] rounded-[2rem] border border-maroon/5 border-dashed">
                                <Calendar className="w-12 h-12 text-maroon/10 mx-auto mb-4" />
                                <p className="text-sm font-black text-maroon/40 uppercase tracking-widest">No operational logs for this cycle</p>
                            </div>
                        ) : (
                            <>
                            {paginatedDailyReports.map((report) => (
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
                                                    <span className="text-[10px] font-black text-maroon/60 uppercase tracking-widest">{report.department || 'INSTITUTIONAL'}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4 flex-1 justify-center px-10 border-l border-maroon/5">
                                            <div className="text-center">
                                                <p className="text-[10px] font-black text-maroon/30 uppercase tracking-[0.2em] mb-1">Attendance</p>
                                                <p className="text-xl font-black text-maroon">{report.total_attendance_percentage}%</p>
                                            </div>
                                            <div className="w-px h-10 bg-maroon/5 mx-4"></div>
                                            <div className="text-center">
                                                <p className="text-[10px] font-black text-maroon/30 uppercase tracking-[0.2em] mb-1">Students</p>
                                                <p className="text-xl font-black text-maroon">{report.total_students_present}/{report.total_students_expected}</p>
                                            </div>
                                            <div className="w-px h-10 bg-maroon/5 mx-4"></div>
                                            <div className="text-center">
                                                <p className="text-[10px] font-black text-maroon/30 uppercase tracking-[0.2em] mb-1">Classes</p>
                                                <p className="text-xl font-black text-maroon">{report.classes_conducted}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 print:hidden">
                                            <button
                                                onClick={() => handleRetroSync(report)}
                                                className="p-3 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all border border-blue-100 shadow-sm"
                                                title="Sync Audit Data"
                                            >
                                                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                                            </button>
                                            <button onClick={() => setViewingReport(report)} className="p-3 bg-maroon/5 text-maroon rounded-xl hover:bg-maroon hover:text-gold transition-all border border-maroon/5">
                                                <Eye className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => openEditModal(report)} className="p-3 bg-maroon/5 text-maroon rounded-xl hover:bg-maroon hover:text-gold transition-all border border-maroon/5">
                                                <Edit className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => handleDownload(report)} className="p-3 bg-gold/5 text-maroon rounded-xl hover:bg-gold hover:text-maroon transition-all border border-gold/10">
                                                <FileDown className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => handleDelete(report.id, 'daily')} className="p-3 bg-maroon/5 text-maroon rounded-xl hover:bg-red-600 hover:text-white transition-all border border-maroon/5">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                    {report.incidents && (
                                        <div className="mt-4 flex flex-wrap gap-2 pt-4 border-t border-maroon/5">
                                            {report.incidents && (
                                                <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-2xl px-4 py-2">
                                                    <AlertCircle className="w-3 h-3 text-red-500" />
                                                    <span className="text-[10px] font-black text-red-700 uppercase tracking-wider">{report.incidents.length > 40 ? report.incidents.substring(0, 40) + '...' : report.incidents}</span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                            <PaginationControls 
                                totalItems={filteredDailyReports.length} 
                                currentPage={currentPage} 
                                setCurrentPage={setCurrentPage} 
                                itemsPerPage={itemsPerPage} 
                            />
                            </>

                        )}
                    </div>
                )}

                {activeTab === 'weekly' && (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xs font-black text-maroon uppercase tracking-[.4em]">Aggregated Weekly Strategic Summaries</h2>
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{filteredWeeklyReports.length} Summaries Compiled</span>
                        </div>
                        {filteredWeeklyReports.length === 0 ? (
                            <div className="text-center py-20 bg-maroon/[0.02] rounded-[2rem] border border-maroon/5 border-dashed">
                                <TrendingUp className="w-12 h-12 text-maroon/10 mx-auto mb-4" />
                                <p className="text-sm font-black text-maroon/40 uppercase tracking-widest">Strategic summary queue empty</p>
                            </div>
                        ) : (
                            <>
                            {paginatedWeeklyReports.map((report) => (
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
                                            <button
                                                onClick={() => handleRetroSync(report)}
                                                className="p-3 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all border border-blue-100 shadow-sm group"
                                                title="Re-Sync Audit Data"
                                            >
                                                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                                            </button>
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
                            ))}
                            <PaginationControls 
                                totalItems={filteredWeeklyReports.length} 
                                currentPage={currentPage} 
                                setCurrentPage={setCurrentPage} 
                                itemsPerPage={itemsPerPage} 
                            />
                            </>
                        )}
                    </div>
                )}

                {activeTab === 'monthly' && (
                    <div className="space-y-8">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xs font-black text-maroon uppercase tracking-[.4em]">Executive Institutional Intelligence Reports</h2>
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{filteredMonthlyReports.length} Executive Audits</span>
                        </div>
                        {filteredMonthlyReports.length === 0 ? (
                            <div className="text-center py-20 bg-maroon/[0.02] rounded-[3rem] border border-maroon/5 border-dashed">
                                <BarChart3 className="w-16 h-16 text-maroon/10 mx-auto mb-4" />
                                <p className="text-sm font-black text-maroon/40 uppercase tracking-widest">Executive Intelligence pipeline empty</p>
                            </div>
                        ) : (
                            <>
                            {paginatedMonthlyReports.map((report) => (
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
                                            <button 
                                                onClick={() => handleRetroSync(report)} 
                                                className="flex items-center gap-3 bg-blue-50 text-blue-600 px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all border border-blue-100"
                                            >
                                                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Sync Data
                                            </button>
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
                                                <div className="p-5 bg-emerald-50/50 rounded-2xl border border-emerald-100">
                                                    <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mb-2">Goals for Next Month</p>
                                                    <p className="text-sm text-gray-600 leading-relaxed line-clamp-3">{report.goals_next_month}</p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                            <PaginationControls 
                                totalItems={filteredMonthlyReports.length} 
                                currentPage={currentPage} 
                                setCurrentPage={setCurrentPage} 
                                itemsPerPage={itemsPerPage} 
                            />
                            </>
                        )}
                    </div>
                )}

                {activeTab === 'consolidated' && (
                    <div className="space-y-10 py-10">
                        <div className="flex flex-col items-center text-center space-y-4 max-w-2xl mx-auto px-4">
                            <div className="w-16 h-16 bg-maroon rounded-3xl flex items-center justify-center shadow-2xl rotate-3">
                                <Zap className="w-8 h-8 text-gold animate-pulse" />
                            </div>
                            <h2 className="text-4xl font-black text-maroon tracking-tighter uppercase">Board-Level Institutional Audit</h2>
                            <p className="text-gray-500 font-medium leading-relaxed">
                                Select a date range to generate a real-time, consolidated audit capturing qualitative and quantitative 
                                data across all campus departments.
                            </p>
                        </div>

                        <div className="flex flex-col sm:flex-row items-center justify-center gap-6 p-8 bg-maroon/[0.03] rounded-[3rem] border border-maroon/5 border-dashed max-w-3xl mx-auto">
                            <div className="space-y-1">
                                <p className="text-[9px] font-black text-maroon/40 uppercase tracking-widest ml-1">Start Date</p>
                                <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} className="bg-white border border-maroon/10 rounded-2xl px-6 py-4 font-black text-maroon focus:ring-2 focus:ring-gold outline-none transition-all shadow-xl" />
                            </div>
                            <div className="space-y-1">
                                <p className="text-[9px] font-black text-maroon/40 uppercase tracking-widest ml-1">End Date</p>
                                <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} className="bg-white border border-maroon/10 rounded-2xl px-6 py-4 font-black text-maroon focus:ring-2 focus:ring-gold outline-none transition-all shadow-xl" />
                            </div>
                            <button 
                                onClick={async () => {
                                    if(!filterDateFrom || !filterDateTo) return toast.error("Select audit range");
                                    setIsConsolidating(true);
                                    try {
                                        const { data } = await activityReportsAPI.getConsolidated({ startDate: filterDateFrom, endDate: filterDateTo });
                                        if(data.success && data.data) {
                                            setConsolidatedData(data.data);
                                            toast.success("Consolidation successful");
                                        } else {
                                            toast.error(data.message || "No data found for this range");
                                            setConsolidatedData(null);
                                        }
                                    } catch(e) {
                                        toast.error("Audit generation failed");
                                    } finally {
                                        setIsConsolidating(false);
                                    }
                                }}
                                disabled={isConsolidating}
                                className="mt-5 sm:mt-0 bg-maroon text-gold px-12 py-5 rounded-2xl font-black text-[12px] uppercase tracking-widest shadow-3xl hover:translate-y-[-4px] active:scale-95 transition-all disabled:opacity-50"
                            >
                                {isConsolidating ? 'Consolidating...' : 'Generate Institutional Audit'}
                            </button>
                        </div>

                        {consolidatedData && (
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 animate-in fade-in slide-in-from-bottom-10 duration-700">
                                <div className="lg:col-span-4 space-y-6">
                                    <div className="bg-white p-8 rounded-[3rem] shadow-2xl border border-maroon/5">
                                        <h3 className="text-xs font-black text-maroon uppercase tracking-widest mb-6 border-b border-maroon/5 pb-4">Institutional Vitality</h3>
                                        <div className="space-y-6">
                                            <div>
                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Daily Records</p>
                                                <p className="text-4xl font-black text-maroon">{consolidatedData.total_reports}</p>
                                            </div>
                                            <div className="h-[1px] bg-maroon/5" />
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <p className="text-[9px] font-black text-gray-400 uppercase mb-1">Students Present</p>
                                                    <p className="text-xl font-black text-emerald-600">{consolidatedData.stats.total_students_present.toLocaleString()}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[9px] font-black text-gray-400 uppercase mb-1">New Enrollments</p>
                                                    <p className="text-xl font-black text-blue-600">{consolidatedData.stats.new_enrollments.toLocaleString()}</p>
                                                </div>
                                            </div>
                                            <div className="h-[1px] bg-maroon/5" />
                                            <div>
                                                <p className="text-[9px] font-black text-gold-600 uppercase mb-3">Departmental Activity Flux</p>
                                                <div className="space-y-2">
                                                    {Object.entries(consolidatedData.departmental_breakdown).map(([dept, data]) => (
                                                        <div key={dept} className="flex justify-between items-center text-[11px] font-bold">
                                                            <span className="text-gray-500">{dept}</span>
                                                            <span className="bg-maroon/5 px-3 py-1 rounded-full text-maroon">{data.count} submissions</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <button 
                                        onClick={async () => {
                                            setLoading(true);
                                            const boardReport = {
                                                ...consolidatedData.stats,
                                                id: 'INST-' + new Date().getTime(),
                                                report_date: filterDateFrom,
                                                report_type: 'consolidated',
                                                reportType: 'consolidated',
                                                reported_by: 'Automated Insight Engine',
                                                isConsolidated: true,
                                                startDate: filterDateFrom,
                                                endDate: filterDateTo,
                                                data: consolidatedData
                                            };
                                            
                                            setPrintingReport(boardReport);
                                            
                                            // Trigger high-fidelity PDF generation
                                            setTimeout(async () => {
                                                const element = document.getElementById('report-print-capture');
                                                if (!element) {
                                                    setLoading(false);
                                                    setPrintingReport(null);
                                                    return;
                                                }
                                                try {
                                                    const canvas = await html2canvas(element, {
                                                        scale: 2.0, 
                                                        useCORS: true,
                                                        backgroundColor: '#ffffff',
                                                        windowWidth: 794
                                                    });
                                                    const imgData = canvas.toDataURL('image/png');
                                                    const pdf = new jsPDF('p', 'mm', 'a4');
                                                    const pdfWidth = pdf.internal.pageSize.getWidth();
                                                    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
                                                    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
                                                    pdf.save(`Institutional_Audit_${filterDateFrom}_to_${filterDateTo}.pdf`);
                                                    toast.success('INSTITUTIONAL PDF GENERATED');
                                                } catch (err) {
                                                    console.error('PDF generation error:', err);
                                                    toast.error('PDF ENGINE FAILURE');
                                                } finally {
                                                    setPrintingReport(null);
                                                    setLoading(false);
                                                }
                                            }, 1500); // Slightly longer delay for heavy consolidated data
                                        }}
                                        className="w-full bg-emerald-600 text-white p-6 rounded-[2rem] font-black text-xs uppercase tracking-widest shadow-2xl shadow-emerald-200 hover:bg-emerald-700 transition-all flex items-center justify-center gap-3"
                                    >
                                        <Download className="w-5 h-5" /> Export Board-Ready PDF
                                    </button>
                                </div>

                                <div className="lg:col-span-8 space-y-8">
                                    <div className="bg-white p-8 rounded-[3rem] shadow-2xl border border-maroon/5">
                                        <h3 className="text-xs font-black text-maroon uppercase tracking-widest mb-6 border-b border-maroon/5 pb-4">Qualitative Institutional Intelligence</h3>
                                        <div className="space-y-10 max-h-[800px] overflow-y-auto pr-4 scrollbar-thin scrollbar-thumb-maroon/10">
                                            {[
                                                { label: 'Academic & Training Highlights', data: consolidatedData.qualitative.topics_covered, color: 'blue' },
                                                { label: 'Institutional Achievements', data: consolidatedData.qualitative.achievements, color: 'emerald' },
                                                { label: 'Strategic Challenges', data: consolidatedData.qualitative.challenges, color: 'red' },
                                                { label: 'Future Plans & Goals', data: consolidatedData.qualitative.plans, color: 'amber' }
                                            ].map(section => section.data.length > 0 && (
                                                <div key={section.label} className="space-y-4">
                                                    <p className={`text-[10px] font-black text-${section.color}-600 uppercase tracking-[0.2em]`}>{section.label}</p>
                                                    <div className="space-y-3">
                                                        {section.data.map((note, idx) => (
                                                            <div key={idx} className={`p-4 rounded-2xl bg-${section.color}-50/50 border border-${section.color}-100/50 text-sm text-gray-700 leading-relaxed font-medium`}>
                                                                {note}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
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
                                                    <option value="Production Unit">Production Unit</option>
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
                                            <div className="flex-1 flex justify-between items-center">
                                                <div>
                                                    <h3 className="text-sm font-black text-blue-900 uppercase tracking-widest">2. Attendance Summary</h3>
                                                    <p className="text-[10px] text-blue-400 font-bold uppercase tracking-wider">Student & Staff Daily Count</p>
                                                </div>
                                                {activeTab === 'daily' && (
                                                    <div className="flex gap-2">
                                                        <div className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-[10px] font-black uppercase">
                                                            {dailyForm.total_students_present > 0 ? ((dailyForm.total_students_present / (dailyForm.total_students_present + dailyForm.total_students_absent + dailyForm.late_arrivals || 1)) * 100).toFixed(0) : 0}% Stability
                                                        </div>
                                                    </div>
                                                )}
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
                                                <label className="block text-[10px] font-black text-blue-400 uppercase tracking-widest mb-2 ml-1 text-gold-600">Late Arrivals</label>
                                                <input
                                                    type="number"
                                                    value={dailyForm.late_arrivals}
                                                    onChange={(e) => setDailyForm({ ...dailyForm, late_arrivals: parseInt(e.target.value) || 0 })}
                                                    className="w-full px-5 py-3.5 bg-white rounded-2xl border border-blue-100 focus:border-gold-500 focus:ring-4 focus:ring-gold-500/5 outline-none transition-all font-bold text-gold-600"
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

                                    <div className="bg-purple-50/20 p-8 rounded-[2rem] border border-purple-100/50 space-y-6">
                                        <div className="flex items-center gap-3 border-b border-purple-100 pb-4">
                                            <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                                                <BookOpen className="w-5 h-5 text-purple-600" />
                                            </div>
                                            <div className="flex-1">
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
                                            <div>
                                                <label className="block text-[10px] font-black text-purple-400 uppercase tracking-widest mb-2 ml-1">Assessments Conducted (Count)</label>
                                                <input
                                                    type="number"
                                                    value={dailyForm.assessments_conducted}
                                                    onChange={(e) => setDailyForm({ ...dailyForm, assessments_conducted: parseInt(e.target.value) || 0 })}
                                                    className="w-full px-5 py-3.5 bg-white rounded-2xl border border-purple-100 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/5 outline-none transition-all font-bold text-gray-700"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-emerald-50/20 p-8 rounded-[2rem] border border-emerald-100/50 space-y-6">
                                        <div className="flex items-center gap-3 border-b border-emerald-100 pb-4">
                                            <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                                                <Building2 className="w-5 h-5 text-emerald-600" />
                                            </div>
                                            <div className="flex-1">
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

                                    <div className="bg-rose-50/20 p-8 rounded-[2rem] border border-rose-100/50 space-y-6">
                                        <div className="flex items-center gap-3 border-b border-rose-100 pb-4">
                                            <div className="w-10 h-10 bg-rose-100 rounded-xl flex items-center justify-center">
                                                <Heart className="w-5 h-5 text-rose-600" />
                                            </div>
                                            <div className="flex-1">
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
                                                    className="w-full px-5 py-4 bg-white rounded-2xl border border-rose-100 focus:border-rose-500 focus:ring-4 focus:ring-rose-500/5 outline-none transition-all font-bold text-gray-700 h-28 resize-none mb-3"
                                                />
                                                <label className="block text-[10px] font-black text-rose-400 uppercase tracking-widest mb-2 ml-1">Disciplinary Cases (Count)</label>
                                                <input
                                                    type="number"
                                                    value={dailyForm.disciplinary_cases}
                                                    onChange={(e) => setDailyForm({ ...dailyForm, disciplinary_cases: parseInt(e.target.value) || 0 })}
                                                    className="w-full px-5 py-3.5 bg-white rounded-2xl border border-rose-100 focus:border-rose-500 focus:ring-4 focus:ring-rose-500/5 outline-none transition-all font-bold text-gray-700"
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

                                    <div className="bg-amber-50/20 p-8 rounded-[2rem] border border-amber-100/50 space-y-6">
                                        <div className="flex items-center gap-3 border-b border-amber-100 pb-4">
                                            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                                                <Zap className="w-5 h-5 text-amber-600" />
                                            </div>
                                            <div className="flex-1">
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
                                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1 text-gold-600">11. Notable Events</label>
                                                <textarea
                                                    value={dailyForm.notable_events}
                                                    onChange={(e) => setDailyForm({ ...dailyForm, notable_events: e.target.value })}
                                                    className="w-full px-5 py-4 bg-white rounded-2xl border border-gray-200 focus:border-gold-500 focus:ring-4 focus:ring-gold-500/5 outline-none transition-all font-bold text-gray-700 h-28 resize-none"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1 text-red-600 font-black">12. Incidents</label>
                                                <textarea
                                                    value={dailyForm.incidents}
                                                    onChange={(e) => setDailyForm({ ...dailyForm, incidents: e.target.value })}
                                                    placeholder="Security issues, accidents, or disruptions..."
                                                    className="w-full px-5 py-4 bg-white rounded-2xl border border-gray-200 focus:border-red-600 focus:ring-4 focus:ring-red-600/5 outline-none transition-all font-bold text-gray-700 h-28 resize-none"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1 text-emerald-600 font-black">13. Key Achievements</label>
                                                <textarea
                                                    value={dailyForm.achievements}
                                                    onChange={(e) => setDailyForm({ ...dailyForm, achievements: e.target.value })}
                                                    placeholder="Special milestones reached today..."
                                                    className="w-full px-5 py-4 bg-white rounded-2xl border border-gray-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/5 outline-none transition-all font-bold text-gray-700 h-28 resize-none"
                                                />
                                            </div>
                                            <div className="md:col-span-2">
                                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">14. General Remarks (Optional)</label>
                                                <textarea
                                                    value={dailyForm.additional_notes}
                                                    onChange={(e) => setDailyForm({ ...dailyForm, additional_notes: e.target.value })}
                                                    className="w-full px-5 py-4 bg-white rounded-2xl border border-gray-200 focus:border-maroon focus:ring-4 focus:ring-maroon/5 outline-none transition-all font-bold text-gray-700 h-24 resize-none"
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
                                            disabled={loading}
                                            className={`px-8 py-4 rounded-2xl bg-maroon text-gold font-black text-[10px] uppercase tracking-[0.2em] transition-all shadow-xl border border-gold/20 ${loading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-maroon/90 hover:-translate-y-1 active:scale-95'}`}
                                        >
                                            {loading ? (
                                                <div className="flex items-center gap-2">
                                                    <RefreshCw className="w-3 h-3 animate-spin" />
                                                    <span>{modalMode === 'create' ? 'Archiving...' : 'Updating...'}</span>
                                                </div>
                                            ) : (
                                                modalMode === 'create' ? 'Seal & Submit Audit' : 'Confirm Revision'
                                            )}
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
                                    onClick={() => handleRetroSync(viewingReport)}
                                    className="p-2 bg-blue-50 hover:bg-blue-600 hover:text-white rounded-xl transition-all shadow-sm group"
                                    title="Sync & Repair Audit Data"
                                >
                                    <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                                </button>
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
                                                            <p className="text-sm font-bold text-emerald-700">{viewingReport.fees_collection_summary || 'â€”'}</p>
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
            {printingReport && (
                <ReportPDFTemplate report={printingReport} user={user} />
            )}
        </div>
    );
};

