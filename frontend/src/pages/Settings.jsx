import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Settings as SettingsIcon, Save, Globe, Palette, Mail, Terminal, HardDrive, RefreshCw, UserPlus, Building, BookOpen, Award, GraduationCap, CreditCard, CheckCircle, XCircle, Users, Clock, Search, ShieldAlert, Cpu, FileCheck, LayoutGrid, ArrowLeft, Menu, LogOut, Calendar, MessageSquare, Package, Sliders, Bell, ChevronDown, ChevronRight, BellRing } from 'lucide-react';
import { settingsAPI, academicAPI, usersAPI, notificationsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { GOLD, GOLD_BRIGHT } from './settings/atoms';
import TabBrandingThemes from './settings/TabBrandingThemes';
import TabDashboard from './settings/TabDashboard';
import TabBranding from './settings/TabBranding';
import TabAcademic from './settings/TabAcademic';
import TabCalendar from './settings/TabCalendar';
import TabStudent from './settings/TabStudent';
import TabPortalCustomization from './settings/TabPortalCustomization';
import TabStaff from './settings/TabStaff';
import TabExams from './settings/TabExams';
import TabAttendance from './settings/TabAttendance';
import TabFinance from './settings/TabFinance';
import TabCommunications from './settings/TabCommunications';
import TabNotifyTemplates from './settings/TabNotifyTemplates';
import TabInventorySettings from './settings/TabInventorySettings';
import TabReportBuilder from './settings/TabReportBuilder';
import TabCertificates from './settings/TabCertificates';
import TabLms from './settings/TabLms';
import TabSecurity from './settings/TabSecurity';
import TabIntegrations from './settings/TabIntegrations';
import TabBackup from './settings/TabBackup';
import TabSystem from './settings/TabSystem';
import TabAudit from './settings/TabAudit';

// ─── Tab Definitions ──────────────────────────────────────────────────────────
const TABS = [
    { id: 'dashboard',      label: 'Dashboard',       icon: LayoutGrid,   group: 'main' },
    { id: 'branding',       label: 'Institution Profile', icon: Building, group: 'institution' },
    { id: 'academic',       label: 'Academic Settings', icon: GraduationCap,group: 'institution' },
    { id: 'calendar',       label: 'Academic Calendar', icon: Calendar,    group: 'institution' },
    { id: 'student',        label: 'Student Settings', icon: Users,        group: 'institution' },
    { id: 'portal_customization', label: 'Student Portal Options', icon: Globe, group: 'institution' },
    { id: 'staff',          label: 'Staff Settings',   icon: UserPlus,     group: 'institution' },
    { id: 'exams',          label: 'Examination Settings', icon: Award,    group: 'operations' },
    { id: 'attendance',     label: 'Attendance Settings', icon: Clock,     group: 'operations' },
    { id: 'finance',        label: 'Finance Settings', icon: CreditCard,   group: 'operations' },
    { id: 'communications', label: 'Communication Settings', icon: Mail,   group: 'operations' },
    { id: 'notify_templates', label: 'Notification Templates', icon: MessageSquare, group: 'operations' },
    { id: 'inventory_settings', label: 'Inventory Configuration', icon: Package, group: 'operations' },
    { id: 'report_builder', label: 'Report & Document Settings', icon: Sliders, group: 'operations' },
    { id: 'certificates',   label: 'Certificates & Graduation', icon: FileCheck, group: 'operations' },
    { id: 'lms',            label: 'Learning Management', icon: BookOpen,  group: 'operations' },
    { id: 'security',       label: 'Security Settings', icon: ShieldAlert,  group: 'system', superAdmin: true },
    { id: 'backup',         label: 'Backup & Recovery', icon: HardDrive,   group: 'system', superAdmin: true },
    { id: 'integrations',   label: 'Integrations',    icon: Cpu,          group: 'system', superAdmin: true },
    { id: 'branding_themes',label: 'Branding & Themes', icon: Palette,      group: 'system' },
    { id: 'system',         label: 'System Configuration', icon: SettingsIcon, group: 'system' },
    { id: 'audit',          label: 'Audit Logs',      icon: Terminal,     group: 'system', superAdmin: true },
];

export default function Settings() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const isSuperAdmin = ['superadmin', 'super_admin', 'super admin'].includes((user?.role || '').toLowerCase().trim());

    const defaultSettings = {
        college_name: 'Beautex Technical Training College', college_abbr: 'BTTC',
        college_motto: 'Empowering Minds. Shaping Innovation.',
        college_address: 'Utawala, Geokarma Building, Behind Astrol Petrol Station',
        college_phone: '0708 247 557', college_phone2: '', contact_email: 'beautextechnicalcollege@gmail.com',
        college_website: 'www.beautex.edu', college_reg_number: 'TVETA/001/2026',
        college_kra_pin: 'P051234567A', college_principal: 'Dr. Jane Doe',
        college_logo: '', college_stamp: '', college_signature: '',
        intake_jan_status: 'open', intake_jan_capacity: '100', intake_may_status: 'open',
        intake_may_capacity: '100', intake_sept_status: 'open', intake_sept_capacity: '100',
        intake_rolling_status: 'open', intake_rolling_capacity: '100', intake_online_app_enabled: true,
        admission_number_format: 'BTC/2026/001',
        student_categories: 'Full-Time, Part-Time, Weekend, Online, Short Course',
        student_statuses: 'Active, Completed, Graduated, Deferred, Suspended, Expelled',
        student_portal_results: true, student_portal_fees: true, student_portal_timetables: true,
        student_portal_materials: true, student_portal_certificates: true, student_portal_attendance: true,
        assessment_types: 'CAT, Practical Assessment, Mid-Term Exam, End-Term Exam, Final Examination',
        grading_distinction_min: '70', grading_credit_min: '60', grading_pass_min: '50', grading_fail_min: '0',
        attendance_mode: 'daily', attendance_status_types: 'Present, Absent, Late, Sick, Excused', attendance_threshold_percent: '90',
        fee_categories: 'Registration Fee, Tuition Fee, Practical Fee, Examination Fee, Graduation Fee, Accommodation Fee',
        payment_methods: 'M-Pesa, Bank Deposit, Bank Transfer, Cash, Card Payments',
        finance_penalty_rate: '0', finance_discount_rate: '0',
        finance_scholarship_types: 'Need-based, Merit-based, Sport', finance_installments_allowed: true,
        sms_admission_confirm: true, sms_fee_reminder: true, sms_cat_notify: true,
        sms_exam_notify: true, sms_grad_notify: true, whatsapp_integration: false,
        smtp_host: '', smtp_port: '587', smtp_user: '', smtp_pass: '', smtp_secure: false,
        sms_api_key: '', sms_username: '', sms_sender_id: 'BEAUTEX',
        google_calendar_api_key: '', zoom_api_key: '', google_meet_api_key: '',
        mpesa_consumer_key: '', mpesa_consumer_secret: '', mpesa_passkey: '',
        mpesa_shortcode: '', mpesa_callback_url: '', mpesa_status: false,
        staff_categories: 'Lecturers, Trainers, ICT Administrators, Finance Officers, Registrars, Support Staff',
        staff_roles: 'Super Admin, Admin, Registrar, Accountant, Lecturer, Trainer',
        certificate_short_course_template: 'standard', certificate_award_template: 'standard',
        certificate_diploma_template: 'standard', certificate_no_format: 'CERT/2026/{ID}',
        graduation_no_format: 'GRAD/2026/{ID}', qr_verification_enabled: true, digital_signatures_enabled: true,
        lms_assignments_enabled: true, lms_materials_enabled: true, lms_online_exams_enabled: true,
        lms_online_classes_enabled: true, lms_discussions_enabled: true,
        password_policy_min_len: '8', password_policy_require_special: true, two_factor_auth: false,
        session_timeout: '30', failed_login_attempts: '5', activity_monitoring_enabled: true,
        backup_interval: 'daily', backup_types: 'database,files,full',
        login_banner_url: '', portal_theme_colors: '#800000', sidebar_colors: '#7a0000',
        system_version: '5.0.0-PRO',
        academic_term_name: 'Term 2 2026', academic_term_start: '2026-05-04', academic_term_end: '2026-07-31',
        academic_exam_start: '2026-07-20', academic_exam_end: '2026-07-30',
        academic_holiday_start: '2026-08-01', academic_holiday_end: '2026-08-31',
        template_admission_sms: 'Dear {name}, welcome to BTTC. Your Admission No is {admission_no}. Classes start on {start_date}.',
        template_fee_reminder_sms: 'Dear Parent/Guardian, a fee balance of KES {balance} remains for {name}. Please clear before {due_date}.',
        template_results_sms: 'Dear Student, Term results have been published. GPA: {gpa}. Check the student portal for details.',
        template_absentee_sms: 'Dear Parent/Guardian, {name} was marked absent today {date} without permission.',
        inventory_low_stock_threshold: '10', inventory_auto_alert_enabled: true,
        inventory_depreciation_method: 'straight_line', inventory_default_store: 'Main Store',
        report_header_text: 'BEAUTEX TECHNICAL TRAINING COLLEGE\nOfficial Academic Transcript',
        report_footer_text: 'This is a computer generated document. For verification, scan the QR code.',
        report_show_grading_scale: true, report_signature_title: 'Registrar of Academic Affairs',
        portal_maintenance_mode: false, portal_announcement_banner: 'Welcome to the new portal! Semester registration deadline extended to June 30th.',
        portal_support_email: 'support@beautex.edu', portal_support_phone: '+254 711 000000',
    };

    const [settings, setSettings]   = useState(defaultSettings);
    const [initialSettings, setInitialSettings] = useState({});
    const [loading, setLoading]      = useState(true);
    const [saving, setSaving]        = useState(false);
    const [toast, setToast]          = useState(null);
    const [activeTab, setActiveTab]  = useState('dashboard');
    const [searchQuery, setSearchQuery] = useState('');
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const [counts, setCounts] = useState({ programs: null, courses: null, students: null, staff: null, active_portals: null });
    const [statsLoading, setStatsLoading] = useState(true);
    const [statsError, setStatsError] = useState(false);

    const [unreadCount, setUnreadCount] = useState(0);
    const [notifications, setNotifications] = useState([]);
    const [notifOpen, setNotifOpen] = useState(false);
    const [profileOpen, setProfileOpen] = useState(false);

    const [uploadingLogo, setUploadingLogo]           = useState(false);
    const [uploadingStamp, setUploadingStamp]         = useState(false);
    const [uploadingSignature, setUploadingSignature] = useState(false);
    const logoRef = useRef(null); const stampRef = useRef(null); const sigRef = useRef(null);

    const [departments, setDepartments]   = useState([]);
    const [loadingDepts, setLoadingDepts] = useState(false);
    const [showDeptModal, setShowDeptModal] = useState(false);
    const [editingDept, setEditingDept]   = useState(null);
    const [deptForm, setDeptForm]         = useState({ name: '', head_of_department: '', description: '' });
    const [savingDept, setSavingDept]     = useState(false);

    const [auditLogs, setAuditLogs]       = useState([]);
    const [loadingAudit, setLoadingAudit] = useState(false);
    const [auditSearch, setAuditSearch]   = useState('');
    const [auditPage, setAuditPage]       = useState(1);
    const [auditPageSize, setAuditPageSize] = useState(25);
    const [auditPagination, setAuditPagination] = useState({ total: 0, page: 1, totalPages: 1 });
    const [auditError, setAuditError]     = useState(false);
    const [restoring, setRestoring]       = useState(false);
    
    // States for premium visual modules enhancements
    const [testingIntegration, setTestingIntegration] = useState({});
    const [integrationStatus, setIntegrationStatus] = useState({});
    const [systemStatus, setSystemStatus] = useState(null);
    const [loadingIntegrationOverview, setLoadingIntegrationOverview] = useState(false);
    const [activeSmsPreview, setActiveSmsPreview] = useState('template_admission_sms');

    useEffect(() => {
        fetchSettings(); fetchDepartments(); loadCounts(); fetchIntegrationOverview(); fetchUnreadCount();
        if (isSuperAdmin) fetchAuditLogs();
    }, []);

    useEffect(() => {
        if (activeTab === 'audit' && isSuperAdmin) fetchAuditLogs();
    }, [activeTab]);

    const showToast = (msg, type = 'success') => {
        setToast({ message: msg, type });
        setTimeout(() => setToast(null), 4000);
    };

    const loadCounts = async () => {
        setStatsLoading(true); setStatsError(false);
        try {
            const { data } = await settingsAPI.dashboardStats();
            setCounts({
                programs: data.programs ?? null, courses: data.courses ?? null,
                students: data.students ?? null, staff: data.staff ?? null,
                active_portals: data.active_portals ?? null,
            });
        } catch {
            setStatsError(true);
        } finally {
            setStatsLoading(false);
        }
    };

    const fetchUnreadCount = async () => {
        try { const { data } = await notificationsAPI.getUnreadCount(); setUnreadCount(data?.unreadCount ?? 0); }
        catch { /* bell stays silent if the endpoint is unreachable */ }
    };

    const toggleNotifPanel = async () => {
        const next = !notifOpen;
        setNotifOpen(next); setProfileOpen(false);
        if (next) {
            try { const { data } = await notificationsAPI.getAll(); setNotifications(data || []); }
            catch { setNotifications([]); }
        }
    };

    const markAllNotificationsRead = async () => {
        try {
            await notificationsAPI.markAllRead();
            setUnreadCount(0);
            setNotifications(p => p.map(n => ({ ...n, read: true })));
            showToast('All notifications marked as read.');
        } catch { showToast('Failed to update notifications.', 'error'); }
    };

    const fetchSettings = async () => {
        try { 
            setLoading(true); 
            const { data } = await settingsAPI.get(); 
            const merged = { ...defaultSettings, ...data };
            setSettings(merged); 
            setInitialSettings(merged);
        }
        catch { showToast('Using default settings.', 'error'); }
        finally { setLoading(false); }
    };

    const fetchDepartments = async () => {
        try { setLoadingDepts(true); const { data } = await academicAPI.getDepartments(); setDepartments(data || []); }
        catch {} finally { setLoadingDepts(false); }
    };

    const fetchAuditLogs = async (opts = {}) => {
        const page = opts.page ?? auditPage;
        const search = opts.search ?? auditSearch;
        const limit = opts.limit ?? auditPageSize;
        try {
            setLoadingAudit(true); setAuditError(false);
            const { data } = await usersAPI.getAuditLogs({ page, limit, search: search || undefined });
            setAuditLogs(data?.logs || []);
            if (data?.pagination) setAuditPagination(data.pagination);
        }
        catch { setAuditError(true); setAuditLogs([]); } finally { setLoadingAudit(false); }
    };

    useEffect(() => {
        if (!isSuperAdmin) return;
        const t = setTimeout(() => {
            if (activeTab === 'audit') { setAuditPage(1); fetchAuditLogs({ page: 1, search: auditSearch }); }
        }, 400);
        return () => clearTimeout(t);
    }, [auditSearch]);

    const changeAuditPage = (page) => {
        setAuditPage(page);
        fetchAuditLogs({ page });
    };

    const changeAuditPageSize = (size) => {
        setAuditPageSize(size);
        setAuditPage(1);
        fetchAuditLogs({ page: 1, limit: size });
    };

    const fetchIntegrationOverview = async () => {
        try {
            setLoadingIntegrationOverview(true);
            const { data } = await settingsAPI.integrationStatus();
            setSystemStatus(data?.results || {});
        } catch {
            setSystemStatus({});
        } finally {
            setLoadingIntegrationOverview(false);
        }
    };

    const triggerTestIntegration = async (gateway) => {
        setTestingIntegration(p => ({ ...p, [gateway]: true }));
        setIntegrationStatus(p => ({ ...p, [gateway]: null }));
        try {
            const { data } = await settingsAPI.integrationStatus({ gateway, live: 1 });
            const result = data?.results?.[gateway] || { status: 'error', message: 'Backend returned no result for this gateway.' };
            setIntegrationStatus(p => ({ ...p, [gateway]: result }));
        } catch (err) {
            setIntegrationStatus(p => ({
                ...p,
                [gateway]: { status: 'error', message: err?.response?.data?.error || 'Status endpoint unreachable — is the backend running?' }
            }));
        } finally {
            setTestingIntegration(p => ({ ...p, [gateway]: false }));
            fetchIntegrationOverview();
        }
    };

    const set = (key, value) => setSettings(p => ({ ...p, [key]: value }));

    // ── Unsaved-changes tracking ──
    // Same comparison handleSave uses: image keys are persisted immediately via
    // the upload endpoint, so they never count as dirty.
    const IMAGE_KEYS = ['college_logo', 'college_stamp', 'college_signature'];
    const dirtyKeys = Object.keys(settings).filter(k => !IMAGE_KEYS.includes(k) && settings[k] !== initialSettings[k]);
    const isDirty = !loading && dirtyKeys.length > 0;
    const discardChanges = () => {
        setSettings(p => ({ ...initialSettings, college_logo: p.college_logo, college_stamp: p.college_stamp, college_signature: p.college_signature }));
        showToast('Unsaved changes discarded.');
    };

    useEffect(() => {
        if (!isDirty) return;
        const onBeforeUnload = (e) => { e.preventDefault(); e.returnValue = ''; };
        window.addEventListener('beforeunload', onBeforeUnload);
        return () => window.removeEventListener('beforeunload', onBeforeUnload);
    }, [isDirty]);

    const handleSave = async () => {
        setSaving(true);
        try {
            // Strip large base64 image fields — they are already persisted via
            // the dedicated upload endpoint and can be hundreds of KB each.
            const changedSettings = {};
            let hasChanges = false;
            for (const key of Object.keys(settings)) {
                if (['college_logo', 'college_stamp', 'college_signature'].includes(key)) continue;
                if (settings[key] !== initialSettings[key]) {
                    changedSettings[key] = settings[key];
                    hasChanges = true;
                }
            }

            if (!hasChanges) {
                showToast('No changes detected.');
                setSaving(false);
                return;
            }

            await settingsAPI.update(changedSettings);
            showToast('Configuration saved successfully!');
            setInitialSettings({ ...settings });

            // Instantly apply theme colors to the document variables
            const primary = settings.portal_theme_colors || '#800000';
            const sidebar = settings.sidebar_colors || '#7a0000';
            document.documentElement.style.setProperty('--primary', primary);
            document.documentElement.style.setProperty('--portal-theme', primary);
            document.documentElement.style.setProperty('--sidebar-bg', sidebar);
            document.documentElement.style.setProperty('--primary-dark', primary);
        }
        catch { showToast('Failed to save. Check permissions.', 'error'); }
        finally { setSaving(false); }
    };

    const handleFileUpload = async (file, key, setU) => {
        if (!file) return; setU(true);
        try {
            const fd = new FormData(); fd.append('file', file); fd.append('key', key);
            const { data } = await settingsAPI.uploadSettingFile(fd); 
            set(key, data.value);
            setInitialSettings(p => ({ ...p, [key]: data.value }));
            showToast('File uploaded successfully!');
        } catch { showToast('Upload failed.', 'error'); }
        finally { setU(false); }
    };

    const handleBackup = async () => {
        try {
            const r = await settingsAPI.exportBackup();
            const url = window.URL.createObjectURL(new Blob([r.data], { type: 'application/json' }));
            const a = document.createElement('a'); 
            a.href = url;
            a.setAttribute('download', `beautex_cms_backup_${new Date().toISOString().split('T')[0]}.json`);
            document.body.appendChild(a); 
            a.click(); 
            a.remove();
            showToast('JSON Database backup downloaded successfully!');
        } catch (e) { 
            showToast('Backup export failed: ' + (e.response?.data?.error || e.message), 'error'); 
        }
    };

    const handleRestore = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            if (!window.confirm(`Are you sure you want to restore from "${file.name}"?\nEvery table contained in the backup will be replaced by its backup contents. If any table fails, nothing is changed.`)) return;

            setRestoring(true);
            try {
                const formData = new FormData();
                formData.append('file', file);
                const { data } = await settingsAPI.restoreBackup(formData);
                showToast(data.message || 'Database restored successfully!');
                fetchSettings();
            } catch (err) {
                showToast('Restore failed: ' + (err.response?.data?.error || err.message), 'error');
            } finally {
                setRestoring(false);
            }
        };
        input.click();
    };

    const openNewDept = () => { setEditingDept(null); setDeptForm({ name: '', head_of_department: '', description: '' }); setShowDeptModal(true); };
    const openEditDept = (d) => { setEditingDept(d); setDeptForm({ name: d.name, head_of_department: d.head_of_department || '', description: d.description || '' }); setShowDeptModal(true); };

    const handleDeptSubmit = async (e) => {
        e.preventDefault(); if (!deptForm.name.trim()) return; setSavingDept(true);
        try {
            if (editingDept) { await academicAPI.updateDepartment(editingDept.id, deptForm); showToast('Department updated.'); }
            else { await academicAPI.createDepartment(deptForm); showToast('Department created.'); }
            setShowDeptModal(false); fetchDepartments();
        } catch { showToast('Failed to save department.', 'error'); }
        finally { setSavingDept(false); }
    };

    const handleDeptDelete = async (id) => {
        if (!window.confirm('Delete this department?')) return;
        try { await academicAPI.deleteDepartment(id); showToast('Department deleted.'); fetchDepartments(); }
        catch { showToast('Failed to delete.', 'error'); }
    };

    // Close header dropdowns on outside click
    useEffect(() => {
        if (!notifOpen && !profileOpen) return;
        const onDocMouseDown = (e) => {
            if (!e.target.closest?.('[data-header-dropdown]')) { setNotifOpen(false); setProfileOpen(false); }
        };
        document.addEventListener('mousedown', onDocMouseDown);
        return () => document.removeEventListener('mousedown', onDocMouseDown);
    }, [notifOpen, profileOpen]);

    const handleLogout = () => {
        setProfileOpen(false);
        logout?.();
    };

    const visibleTabs = TABS.filter(t => !t.superAdmin || isSuperAdmin);
    const activeTabDef = visibleTabs.find(t => t.id === activeTab);

    // Recent Activity data list (top 5 real audit logs or fallback beautiful mocks)
    const displayActivities = auditLogs.length > 0 
        ? auditLogs.slice(0, 5).map(l => ({
            text: `${l.user_email || 'System'} ${l.action}`,
            time: l.created_at ? new Date(l.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'recently',
            dot: 'bg-green-500'
          }))
        : [];

    // Modules list excluding dashboard — `tone` styles the icon tile in the grid
    const modulesList = [
        { id: 'branding', title: 'Institution Profile', icon: Building, desc: 'Manage college information, logo, contacts and official details.', tone: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400' },
        { id: 'academic', title: 'Academic Settings', icon: GraduationCap, desc: 'Programs, courses, departments, and intakes.', tone: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400' },
        { id: 'calendar', title: 'Academic Calendar', icon: Calendar, desc: 'Configure term dates, examination periods, holidays, and events.', tone: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400' },
        { id: 'student', title: 'Student Settings', icon: Users, desc: 'Admission settings, student categories, status definitions.', tone: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-400' },
        { id: 'portal_customization', title: 'Student Portal Options', icon: Globe, desc: 'Customize features, announcement banners, maintenance modes, and support.', tone: 'bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-400' },
        { id: 'staff', title: 'Staff Settings', icon: UserPlus, desc: 'Staff categories, roles, permissions and staff management.', tone: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400' },
        { id: 'exams', title: 'Examination Settings', icon: Award, desc: 'Exam types, grading system, templates and result configurations.', tone: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-400' },
        { id: 'attendance', title: 'Attendance Settings', icon: Clock, desc: 'Attendance modes, status types and attendance configurations.', tone: 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400' },
        { id: 'finance', title: 'Finance Settings', icon: CreditCard, desc: 'Fee categories, payment methods, penalties and financial controls.', tone: 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400' },
        { id: 'communications', title: 'Communication Settings', icon: Mail, desc: 'SMS gateways, SMTP server, and WhatsApp configuration.', tone: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-400' },
        { id: 'notify_templates', title: 'Notification Templates', icon: MessageSquare, desc: 'Customize message templates for SMS and system alerts.', tone: 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-500/15 dark:text-fuchsia-400' },
        { id: 'inventory_settings', title: 'Inventory Configuration', icon: Package, desc: 'Set stock thresholds, depreciation methods, and stores settings.', tone: 'bg-lime-100 text-lime-700 dark:bg-lime-500/15 dark:text-lime-400' },
        { id: 'report_builder', title: 'Report & Document Settings', icon: Sliders, desc: 'Configure printed PDF templates, transcript headers, footers and layouts.', tone: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400' },
        { id: 'certificates', title: 'Certificates & Graduation', icon: FileCheck, desc: 'Certificate templates, numbering and graduation settings.', tone: 'bg-gold/20 text-amber-600 dark:bg-gold/15 dark:text-gold' },
        { id: 'lms', title: 'Learning Management', icon: BookOpen, desc: 'LMS features, assignments, quizzes and online learning settings.', tone: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400' },
        ...(isSuperAdmin ? [
            { id: 'security', title: 'Security Settings', icon: ShieldAlert, desc: 'Password policies, 2FA, login attempts and security configurations.', tone: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400' },
            { id: 'backup', title: 'Backup & Recovery', icon: HardDrive, desc: 'System backups, restore, backup schedules and database logs.', tone: 'bg-zinc-200 text-zinc-700 dark:bg-zinc-500/20 dark:text-zinc-300' },
            { id: 'integrations', title: 'Integrations', icon: Cpu, desc: 'API integrations, payment gateways and third-party services.', tone: 'bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-400' },
        ] : []),
        { id: 'branding_themes', title: 'Branding & Themes', icon: Palette, desc: 'Customize system appearance, colors, logos and templates.', tone: 'bg-pink-100 text-pink-700 dark:bg-pink-500/15 dark:text-pink-400' },
        { id: 'system', title: 'System Configuration', icon: SettingsIcon, desc: 'General system settings and configuration management.', tone: 'bg-slate-200 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300' },
        ...(isSuperAdmin ? [
            { id: 'audit', title: 'Audit Logs', icon: Terminal, desc: 'View all system activities and configuration changes.', tone: 'bg-stone-200 text-stone-700 dark:bg-stone-500/20 dark:text-stone-300' }
        ] : [])
    ];

    // Filter modules based on header search settings query
    const filteredModules = modulesList.filter(m => 
        m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.desc.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // ── Department modal a11y: focus trap, Escape to close, focus restore ──
    const deptModalRef = useRef(null);
    useEffect(() => {
        if (!showDeptModal) return;
        const modal = deptModalRef.current;
        const previouslyFocused = document.activeElement;
        modal?.querySelector('input, textarea, select')?.focus();
        const onKeyDown = (e) => {
            if (e.key === 'Escape') { setShowDeptModal(false); return; }
            if (e.key !== 'Tab' || !modal) return;
            const focusables = Array.from(modal.querySelectorAll('button, input, textarea, select, [href], [tabindex]:not([tabindex="-1"])')).filter(el => !el.disabled);
            if (!focusables.length) return;
            const firstEl = focusables[0], lastEl = focusables[focusables.length - 1];
            if (e.shiftKey && document.activeElement === firstEl) { e.preventDefault(); lastEl.focus(); }
            else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); firstEl.focus(); }
        };
        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.removeEventListener('keydown', onKeyDown);
            if (previouslyFocused && typeof previouslyFocused.focus === 'function') previouslyFocused.focus();
        };
    }, [showDeptModal]);

    const ctx = {
        settings, set, isSuperAdmin, user, showToast, loading, saving,
        activeTab, setActiveTab, searchQuery, setSearchQuery, sidebarOpen, setSidebarOpen,
        counts, statsLoading, statsError, loadCounts, navigate,
        unreadCount, notifications, notifOpen, toggleNotifPanel, markAllNotificationsRead,
        uploadingLogo, setUploadingLogo, uploadingStamp, setUploadingStamp,
        uploadingSignature, setUploadingSignature, logoRef, stampRef, sigRef,
        departments, loadingDepts, showDeptModal, setShowDeptModal, editingDept, setEditingDept,
        deptForm, setDeptForm, savingDept, handleDeptSubmit, handleDeptDelete, openNewDept, openEditDept,
        auditLogs, loadingAudit, auditSearch, setAuditSearch, auditPage, auditPageSize, auditPagination, auditError, changeAuditPage, changeAuditPageSize, restoring,
        handleBackup, handleRestore, testingIntegration, integrationStatus, triggerTestIntegration, systemStatus, fetchIntegrationOverview, loadingIntegrationOverview,
        activeSmsPreview, setActiveSmsPreview, displayActivities, filteredModules, visibleTabs, activeTabDef,
        handleFileUpload, GOLD, GOLD_BRIGHT,
    };

    const sidebarContent = (
        <div className="flex flex-col h-full text-white" style={{ backgroundColor: settings.sidebar_colors || '#7a0000' }}>
            {/* Sidebar Title */}
            <div className="px-5 py-4 border-b border-white/10 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/10 border border-gold/30 flex items-center justify-center shrink-0">
                    <SettingsIcon className="w-4.5 h-4.5 text-gold" />
                </div>
                <div className="min-w-0">
                    <p className="text-[10px] font-black text-gold uppercase tracking-[0.2em] leading-none">Settings</p>
                    <p className="text-[7.5px] font-bold text-white/60 uppercase tracking-widest mt-1 leading-none truncate">Control Center</p>
                </div>
            </div>
            
            {/* Sidebar Scrollable Menu */}
            <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-0.5 custom-scrollbar-settings" aria-label="Settings sections">
                {visibleTabs.map(tab => {
                    const Icon = tab.icon;
                    const isAct = activeTab === tab.id;
                    return (
                        <button key={tab.id} aria-current={isAct ? 'page' : undefined}
                            onClick={() => { setActiveTab(tab.id); setSidebarOpen(false); }}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-left transition-all duration-200 group relative ${isAct ? 'bg-gold text-maroon font-bold shadow-lg animate-in fade-in zoom-in-95 duration-150' : 'text-white/70 hover:text-white hover:bg-white/5'}`}>
                            {isAct && (
                                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-white rounded-r-full" />
                            )}
                            <Icon className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-105 ${isAct ? 'text-maroon' : 'text-white/40'}`} />
                            <span className="text-[11px] font-bold tracking-wide uppercase flex-1 truncate">{tab.label}</span>
                            <ChevronRight className={`w-3 h-3 shrink-0 transition-transform ${isAct ? 'text-maroon' : 'text-white/25 group-hover:translate-x-0.5'}`} />
                        </button>
                    );
                })}
            </nav>

            {/* Sidebar Footer */}
            <div className="px-6 py-5 border-t border-white/10 bg-black/10 space-y-3">
                <Link to="/dashboard" className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl border border-white/20 text-white hover:bg-white/10 transition-colors text-[10px] font-black uppercase tracking-wider bg-black/20">
                    <LogOut className="w-3.5 h-3.5 text-yellow-300" />
                    Exit Settings
                </Link>
                <div className="text-center pt-1">
                    <p className="text-[8px] font-black text-white/50 uppercase tracking-[0.1em] leading-tight">Beautex Technical Training College</p>
                    <p className="text-[7.5px] font-bold text-gold italic mt-0.5">{settings.college_motto || 'Empowering Minds. Shaping Innovation.'}</p>
                </div>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-[#fafbfd] dark:bg-[#0b0b0c] text-zinc-800 dark:text-zinc-200 flex flex-col font-sans transition-colors duration-300">
            {/* ── TOAST ──────────────────────────────────────────────────────── */}
            {toast && (
                <div className={`fixed top-5 right-6 z-[100] flex items-center gap-2.5 px-5 py-3.5 rounded-2xl shadow-2xl text-white text-xs font-bold animate-in slide-in-from-top duration-300 ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
                    {toast.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                    {toast.message}
                </div>
            )}

            {/* ── TOP NAVBAR ─────────────────────────────────────────────────── */}
            <header className="h-16 text-white flex items-center justify-between px-6 z-50 border-b border-white/10 shrink-0" style={{ backgroundColor: settings.sidebar_colors || '#7a0000' }}>
                <div className="flex items-center gap-4">
                    {/* Hamburger for mobile */}
                    <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden p-2 rounded-xl text-white hover:bg-white/10 transition-colors">
                        <Menu className="w-5 h-5" />
                    </button>
                    {/* Logo Crest & College Title */}
                    <Link to="/dashboard" className="flex items-center gap-3 group">
                        <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center p-0.5 overflow-hidden border border-white/20 transition-transform group-hover:scale-105 shadow-sm">
                            <img src={settings.college_logo || '/beautex-crest.png'} alt="Beautex Technical Training College Crest" className="w-full h-full object-contain" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-base font-black tracking-[0.12em] text-gold uppercase leading-none" style={{ fontFamily: 'Georgia, serif' }}>Beautex</span>
                            <span className="text-[7.5px] font-bold text-white/80 uppercase tracking-widest leading-tight mt-0.5">Technical Training College</span>
                            <span className="hidden sm:block text-[6.5px] font-semibold italic text-gold/70 tracking-wide mt-0.5 leading-tight">{settings.college_motto || 'Empowering Minds. Shaping Innovation.'}</span>
                        </div>
                    </Link>
                </div>

                {/* Central Search Bar */}
                <div className="hidden md:flex items-center bg-black/20 border border-white/10 rounded-xl px-3 py-1.5 w-80 max-w-lg transition-all focus-within:border-gold focus-within:bg-black/35">
                    <input 
                        type="text" 
                        placeholder="Search settings..." 
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="bg-transparent border-0 outline-none text-xs text-white placeholder-white/40 w-full font-semibold"
                    />
                    <Search className="w-4 h-4 text-white/40" />
                </div>

                {/* Right: Notifications, Preferences, Profile */}
                <div className="flex items-center gap-3">
                    {/* Notifications bell — real unread count */}
                    <div className="relative" data-header-dropdown>
                        <button onClick={toggleNotifPanel} aria-label="Notifications" aria-expanded={notifOpen}
                            className={`relative p-2 bg-black/20 rounded-xl transition-colors border ${notifOpen ? 'border-gold/60 bg-black/35' : 'border-white/5 hover:bg-white/5'}`}>
                            <Bell className="w-4 h-4 text-white/80" />
                            {unreadCount > 0 && (
                                <span className="absolute -top-1 -right-1 bg-gold text-maroon text-[8px] font-black min-w-[17px] h-[17px] px-0.5 rounded-full flex items-center justify-center border-2 border-maroon tabular-nums">
                                    {unreadCount > 99 ? '99+' : unreadCount}
                                </span>
                            )}
                        </button>
                        {notifOpen && (
                            <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-white/10 shadow-2xl overflow-hidden z-[110] animate-in fade-in slide-in-from-top-2 duration-150">
                                <div className="px-4 py-3 flex items-center justify-between bg-maroon text-white">
                                    <span className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2"><BellRing className="w-3.5 h-3.5 text-yellow-300" /> Notifications</span>
                                    {unreadCount > 0 && (
                                        <button onClick={markAllNotificationsRead} className="text-[8px] font-black uppercase tracking-widest text-gold hover:underline">Mark all read</button>
                                    )}
                                </div>
                                <div className="max-h-72 overflow-y-auto custom-scrollbar-settings-main divide-y divide-zinc-100 dark:divide-white/5">
                                    {notifications.length === 0 && (
                                        <p className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider text-center py-6 px-4">No notifications yet.</p>
                                    )}
                                    {notifications.slice(0, 10).map(n => (
                                        <div key={n.id} className={`px-4 py-3 ${n.read ? 'opacity-60' : ''}`}>
                                            <p className="text-[10px] font-black text-zinc-700 dark:text-zinc-200 uppercase tracking-wide leading-snug">{n.title}</p>
                                            <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5 line-clamp-2 leading-snug">{n.content}</p>
                                            <span className="text-[8px] text-zinc-400 font-bold uppercase block mt-1">{n.time ? new Date(n.time).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Quick access to system preferences */}
                    <button onClick={() => setActiveTab('system')} title="System Preferences" aria-label="System preferences"
                        className="p-2 bg-black/20 rounded-xl hover:bg-white/5 transition-colors border border-white/5">
                        <SettingsIcon className="w-4 h-4 text-white/80" />
                    </button>

                    {/* Profile dropdown */}
                    <div className="relative" data-header-dropdown>
                        <button onClick={() => { setProfileOpen(p => !p); setNotifOpen(false); }} aria-label="User menu" aria-expanded={profileOpen}
                            className={`flex items-center gap-2 border-l pl-3 pr-2 py-1.5 rounded-xl transition-colors ${profileOpen ? 'bg-white/10 border-gold/50' : 'border-white/10 hover:bg-white/5'}`}>
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#c8a94a] to-[#e4c264] border border-white/20 flex items-center justify-center text-xs font-black text-white overflow-hidden uppercase shadow-sm shrink-0">
                                {user?.name ? user.name.slice(0, 2) : 'SA'}
                            </div>
                            <div className="hidden sm:flex flex-col text-left">
                                <span className="text-[10px] font-black uppercase text-white tracking-wider leading-none">{user?.name || 'Super Admin'}</span>
                                <span className="text-[7.5px] font-bold text-gold uppercase tracking-widest mt-0.5 leading-none">{isSuperAdmin ? 'Super Administrator' : (user?.role || 'Administrator')}</span>
                            </div>
                            <ChevronDown className={`w-3.5 h-3.5 text-white/60 transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {profileOpen && (
                            <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-white/10 shadow-2xl overflow-hidden z-[110] animate-in fade-in slide-in-from-top-2 duration-150">
                                <div className="px-4 py-3.5 border-b border-zinc-100 dark:border-white/5">
                                    <p className="text-[11px] font-black text-maroon dark:text-gold uppercase tracking-wide truncate">{user?.name || 'Super Admin'}</p>
                                    <p className="text-[9px] text-zinc-400 font-semibold truncate mt-0.5">{user?.email || '—'}</p>
                                    <span className="inline-block mt-1.5 px-2 py-0.5 rounded-full bg-maroon/5 dark:bg-gold/10 text-maroon dark:text-gold text-[8px] font-black uppercase tracking-widest border border-maroon/10 dark:border-gold/20">{isSuperAdmin ? 'Super Administrator' : (user?.role || 'Administrator')}</span>
                                </div>
                                <div className="p-1.5">
                                    <button onClick={() => { setProfileOpen(false); setActiveTab('branding_themes'); }}
                                        className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left text-[10px] font-black uppercase tracking-wide text-zinc-600 dark:text-zinc-300 hover:bg-maroon/5 dark:hover:bg-white/5 transition-colors">
                                        <Palette className="w-3.5 h-3.5 text-gold" /> Branding & Themes
                                    </button>
                                    <Link to="/dashboard" onClick={() => setProfileOpen(false)}
                                        className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left text-[10px] font-black uppercase tracking-wide text-zinc-600 dark:text-zinc-300 hover:bg-maroon/5 dark:hover:bg-white/5 transition-colors">
                                        <LayoutGrid className="w-3.5 h-3.5 text-gold" /> Main Dashboard
                                    </Link>
                                    <button onClick={handleLogout}
                                        className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left text-[10px] font-black uppercase tracking-wide text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors">
                                        <LogOut className="w-3.5 h-3.5" /> Logout
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {/* ── MAIN WORKSPACE ──────────────────────────────────────────────── */}
            <div className="flex-1 flex overflow-hidden relative">
                
                {/* ── LEFT DESKTOP SIDEBAR ─────────────────────────────────────── */}
                <aside className="w-64 border-r border-zinc-200 dark:border-white/10 shrink-0 hidden lg:block z-40">
                    {sidebarContent}
                </aside>

                {/* ── MOBILE SIDEBAR DRAWER ────────────────────────────────────── */}
                {sidebarOpen && (
                    <>
                        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[98] lg:hidden animate-in fade-in duration-200" onClick={() => setSidebarOpen(false)} />
                        <aside className="fixed left-0 top-0 bottom-0 w-64 z-[99] shadow-2xl lg:hidden animate-in slide-in-from-left duration-300" style={{ backgroundColor: settings.sidebar_colors || '#7a0000' }}>
                            {sidebarContent}
                        </aside>
                    </>
                )}

                {/* ── CENTRAL CONTENT VIEW ─────────────────────────────────────── */}
                <main className="flex-1 overflow-y-auto p-6 lg:p-8 custom-scrollbar-settings-main bg-[#fafbfd] dark:bg-[#080809]">
                    
                    {/* ══ DASHBOARD OVERVIEW VIEW ═══════════════════════════════ */}
                    {/* TabDashboard */}
                    {activeTab === 'dashboard' && <TabDashboard {...ctx} />}

                    {/* ══ SETTINGS FORM CONTAINER VIEWS ═════════════════════════ */}
                    {activeTab !== 'dashboard' && (
                        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/50 dark:border-white/5 shadow-sm overflow-hidden animate-in fade-in duration-300">
                            
                            {/* Section header */}
                            <div className="px-7 py-5 border-b border-zinc-100 dark:border-white/5 flex items-center justify-between bg-gradient-to-r from-maroon/5 to-gold/5">
                                <div className="flex items-center gap-3">
                                    {activeTabDef && (() => { const Icon = activeTabDef.icon; return (
                                        <div className="w-10 h-10 rounded-2xl flex items-center justify-center bg-maroon text-white shadow-md">
                                            <Icon className="w-4.5 h-4.5 text-gold" />
                                        </div>
                                    ); })()}
                                    <div>
                                        <h2 className="text-sm font-black uppercase tracking-wider text-maroon dark:text-gold leading-none">{activeTabDef?.label}</h2>
                                        <p className="text-[8px] text-zinc-400 font-black uppercase tracking-widest mt-1.5">Beautex Technical Training College</p>
                                    </div>
                                </div>
                                <button onClick={() => setActiveTab('dashboard')}
                                    className="flex items-center gap-1.5 px-4 py-2 bg-zinc-100 dark:bg-white/5 hover:bg-maroon/10 rounded-xl text-[9px] font-black uppercase tracking-widest text-maroon dark:text-gold transition-all">
                                    <ArrowLeft className="w-3.5 h-3.5" /> Dashboard Overview
                                </button>
                            </div>

                            <div className="p-7">
                                
                                {/* ══ INSTITUTION PROFILE ══════════════════════════════ */}
                                {/* TabBranding */}
                                {activeTab === 'branding' && <TabBranding {...ctx} />}

                                {/* ══ ACADEMIC SETTINGS ════════════════════════════════ */}
                                {/* TabAcademic */}
                                {activeTab === 'academic' && <TabAcademic {...ctx} />}

                                {/* ══ ACADEMIC CALENDAR ════════════════════════════════ */}
                                {/* TabCalendar */}
                                {activeTab === 'calendar' && <TabCalendar {...ctx} />}

                                {/* ══ STUDENT SETTINGS ══════════════════════════════════ */}
                                {/* TabStudent */}
                                {activeTab === 'student' && <TabStudent {...ctx} />}

                                {/* ══ PORTAL OPTIONS ══════════════════════════════════ */}
                                {/* TabPortalCustomization */}
                                {activeTab === 'portal_customization' && <TabPortalCustomization {...ctx} />}

                                {/* ══ STAFF SETTINGS ════════════════════════════════════ */}
                                {/* TabStaff */}
                                {activeTab === 'staff' && <TabStaff {...ctx} />}

                                {/* ══ EXAMS & GRADING ═══════════════════════════════════ */}
                                {/* TabExams */}
                                {activeTab === 'exams' && <TabExams {...ctx} />}

                                {/* ══ ATTENDANCE ════════════════════════════════════════ */}
                                {/* TabAttendance */}
                                {activeTab === 'attendance' && <TabAttendance {...ctx} />}

                                {/* ══ FINANCE ═══════════════════════════════════════════ */}
                                {/* TabFinance */}
                                {activeTab === 'finance' && <TabFinance {...ctx} />}

                                {/* ══ COMMUNICATIONS ════════════════════════════════════ */}
                                {/* TabCommunications */}
                                {activeTab === 'communications' && <TabCommunications {...ctx} />}

                                {/* ══ NOTIFICATION TEMPLATES ════════════════════════════ */}
                                {/* TabNotifyTemplates */}
                                {activeTab === 'notify_templates' && <TabNotifyTemplates {...ctx} />}

                                {/* ══ INVENTORY CONFIGURATION ═══════════════════════════ */}
                                {/* TabInventorySettings */}
                                {activeTab === 'inventory_settings' && <TabInventorySettings {...ctx} />}

                                {/* ══ REPORT & DOCUMENT BUILDER ══════════════════════════ */}
                                {/* TabReportBuilder */}
                                {activeTab === 'report_builder' && <TabReportBuilder {...ctx} />}

                                {/* ══ CERTIFICATES ══════════════════════════════════════ */}
                                {/* TabCertificates */}
                                {activeTab === 'certificates' && <TabCertificates {...ctx} />}

                                {/* ══ LMS ═══════════════════════════════════════════════ */}
                                {/* TabLms */}
                                {activeTab === 'lms' && <TabLms {...ctx} />}

                                {/* ══ SECURITY ══════════════════════════════════════════ */}
                                {/* TabSecurity */}
                                {activeTab === 'security' && isSuperAdmin && <TabSecurity {...ctx} />}

                                {/* ══ INTEGRATIONS ══════════════════════════════════════ */}
                                {/* TabIntegrations */}
                                {activeTab === 'integrations' && isSuperAdmin && <TabIntegrations {...ctx} />}

                                {/* ══ BACKUP ════════════════════════════════════════════ */}
                                {/* TabBackup */}
                                {activeTab === 'backup' && isSuperAdmin && <TabBackup {...ctx} />}

                                {/* ══ THEMES ════════════════════════════════════════════ */}
                                {/* TabBrandingThemes */}
                                {activeTab === 'branding_themes' && <TabBrandingThemes {...ctx} />}

                                {/* ══ SYSTEM CONFIGURATION ══════════════════════════════ */}
                                {/* TabSystem */}
                                {activeTab === 'system' && <TabSystem {...ctx} />}

                                {/* ══ AUDIT LOGS ════════════════════════════════════════ */}
                                {/* TabAudit */}
                                {activeTab === 'audit' && isSuperAdmin && <TabAudit {...ctx} />}
                            </div>

                            {/* ── SAVE CHANGES FOOTER ─────────────────────────────── */}
                            <div className="px-7 py-4 border-t border-gray-100 dark:border-white/5 flex items-center justify-between gap-4 bg-gray-50/50 dark:bg-white/[0.02]">
                                {isDirty ? (
                                    <div className="flex items-center gap-3 min-w-0">
                                        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 text-[9px] font-black uppercase tracking-widest shrink-0 border border-amber-200/60 dark:border-amber-500/20">
                                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                            {dirtyKeys.length} unsaved change{dirtyKeys.length === 1 ? '' : 's'}
                                        </span>
                                        <button type="button" onClick={discardChanges}
                                            className="text-[9px] font-black uppercase tracking-widest text-zinc-400 hover:text-red-500 transition-colors shrink-0">
                                            Discard
                                        </button>
                                        <span className="text-[8.5px] text-zinc-400 font-mono truncate hidden lg:block" title={dirtyKeys.join(', ')}>{dirtyKeys.join(', ')}</span>
                                    </div>
                                ) : (
                                    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400 text-[9px] font-black uppercase tracking-widest border border-green-200/60 dark:border-green-500/20">
                                        <CheckCircle className="w-3 h-3" /> {loading ? 'Loading settings…' : 'All changes saved'}
                                    </span>
                                )}
                                <button onClick={handleSave} disabled={saving || !isDirty}
                                    className="flex items-center gap-2 text-white px-7 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest disabled:opacity-50 transition-all shadow-md hover:shadow-lg hover:opacity-90 ml-auto"
                                    style={{ backgroundColor: settings.sidebar_colors || '#7a0000', border: `1px solid ${GOLD}25` }}>
                                    {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5 text-yellow-300" />}
                                    {saving ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>

                        </div>
                    )}
                </main>
            </div>

            {/* ── DEPARTMENT MODAL ─────────────────────────────────────────────── */}
            {showDeptModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-[100] animate-in fade-in duration-200"
                    onClick={(e) => { if (e.target === e.currentTarget) setShowDeptModal(false); }}>
                    <div ref={deptModalRef} role="dialog" aria-modal="true" aria-labelledby="dept-modal-title"
                        className="bg-white dark:bg-zinc-900 rounded-3xl p-7 max-w-md w-full shadow-2xl relative overflow-hidden border border-maroon/10">
                        <div className="absolute top-0 left-0 right-0 h-1"
                            style={{ background: `linear-gradient(90deg, ${settings.sidebar_colors || '#7a0000'}, ${GOLD}, ${settings.portal_theme_colors || '#800000'})` }} />
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h2 id="dept-modal-title" className="text-base font-black text-maroon dark:text-gold uppercase tracking-tight">
                                    {editingDept ? 'Update Department' : 'New Department'}
                                </h2>
                                <div className="w-8 h-0.5 mt-1.5" style={{ background: GOLD }} />
                            </div>
                            <button onClick={()=>setShowDeptModal(false)} aria-label="Close department dialog" className="p-1.5 hover:bg-maroon/5 rounded-full transition-colors">
                                <XCircle className="w-5 h-5 text-gray-300 hover:text-red-500" />
                            </button>
                        </div>
                        <form onSubmit={handleDeptSubmit} className="space-y-4">
                            <div>
                                <label htmlFor="dept-name-input" className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block mb-1.5">Department Name *</label>
                                <input id="dept-name-input" type="text" value={deptForm.name} onChange={e=>setDeptForm({...deptForm,name:e.target.value})} required placeholder="e.g. Department of Cosmetology" className="w-full px-3.5 py-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-maroon/30 focus:border-maroon" />
                            </div>
                            <div>
                                <label htmlFor="dept-hod-input" className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block mb-1.5">Head of Department (HOD)</label>
                                <input id="dept-hod-input" type="text" value={deptForm.head_of_department} onChange={e=>setDeptForm({...deptForm,head_of_department:e.target.value})} placeholder="e.g. Ms. Grace Kemunto" className="w-full px-3.5 py-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-maroon/30 focus:border-maroon" />
                            </div>
                            <div>
                                <label htmlFor="dept-desc-input" className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block mb-1.5">Description</label>
                                <textarea id="dept-desc-input" value={deptForm.description} onChange={e=>setDeptForm({...deptForm,description:e.target.value})} placeholder="Brief department overview..." rows={3} className="w-full px-3.5 py-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-maroon/30 focus:border-maroon resize-none" />
                            </div>
                            <button type="submit" disabled={savingDept} className="w-full text-yellow-100 py-3.5 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg transition-all hover:opacity-90 disabled:opacity-60"
                                style={{ backgroundColor: settings.sidebar_colors || '#7a0000', border: `1px solid ${GOLD}25` }}>
                                {savingDept ? 'Saving...' : (editingDept ? 'Update Department' : 'Create Department')}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            <style>{`
                .custom-scrollbar-settings::-webkit-scrollbar { width: 3px; }
                .custom-scrollbar-settings::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar-settings::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.12); border-radius: 9px; }
                
                .custom-scrollbar-settings-main::-webkit-scrollbar { width: 5px; }
                .custom-scrollbar-settings-main::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar-settings-main::-webkit-scrollbar-thumb { background: rgba(122, 0, 0, 0.15); border-radius: 9px; }
                .dark .custom-scrollbar-settings-main::-webkit-scrollbar-thumb { background: rgba(200, 169, 74, 0.2); }
            `}</style>
        </div>
    );
}
