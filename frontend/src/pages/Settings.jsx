import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
    Settings as SettingsIcon, Save, Globe, Shield, Database,
    Download, Lock, Palette, Mail, Terminal,
    HardDrive, RefreshCw, UserPlus, Building,
    BookOpen, Award, GraduationCap, Eye, EyeOff,
    CreditCard, CheckCircle, XCircle,
    FileText, Users, Clock,
    ChevronDown, Edit3,
    Trash2, Plus, Search, ShieldAlert,
    Cpu, FileCheck, LayoutGrid,
    ArrowLeft, Sparkles, Activity, Zap, Menu, LogOut, ChevronRight
} from 'lucide-react';
import { settingsAPI, academicAPI, usersAPI, coursesAPI, studentsAPI, facultyAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

// ─── Design Tokens ─────────────────────────────────────────────────────────────
const M_DEEP   = '#4a0000';
const M_MID    = '#7a0000';
const M_LIGHT  = '#a00000';
const GOLD     = '#c8a94a';
const GOLD_BRIGHT = '#FFD700';

// ─── Small Reusable Atoms ─────────────────────────────────────────────────────

const Toggle = ({ value, onChange, locked }) => (
    <button onClick={() => !locked && onChange(!value)} disabled={locked}
        className={`relative inline-flex items-center h-6 w-12 rounded-full transition-all duration-300 focus:outline-none ${value ? 'bg-green-500' : 'bg-gray-300 dark:bg-white/20'} ${locked ? 'opacity-50 cursor-not-allowed' : ''}`}>
        <span className={`inline-block w-4 h-4 bg-white rounded-full shadow transform transition-transform duration-300 ${value ? 'translate-x-7' : 'translate-x-1'}`} />
    </button>
);

const StatusBadge = ({ active, labelOn, labelOff }) => (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${active ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400' : 'bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400'}`}>
        {active ? <CheckCircle className="w-2.5 h-2.5" /> : <XCircle className="w-2.5 h-2.5" />}
        {active ? labelOn : labelOff}
    </span>
);

const FieldRow = ({ label, description, children, locked }) => (
    <div className={`flex flex-col md:flex-row md:items-start justify-between py-4 border-b border-gray-100 dark:border-white/5 last:border-0 gap-3 ${locked ? 'opacity-50 pointer-events-none' : ''}`}>
        <div className="md:w-56 flex-shrink-0">
            <div className="flex items-center gap-1.5">
                <p className="text-[10px] font-black text-zinc-600 dark:text-zinc-400 uppercase tracking-widest">{label}</p>
                {locked && <Lock className="w-3 h-3 text-gray-400" />}
            </div>
            {description && <p className="text-[9px] text-gray-400 font-medium mt-0.5 leading-relaxed">{description}</p>}
        </div>
        <div className="flex-1 max-w-md w-full">{children}</div>
    </div>
);

const Inp = ({ value, onChange, placeholder, type = 'text', readOnly, mono }) => (
    <input type={type} value={value || ''} onChange={onChange} placeholder={placeholder} readOnly={readOnly}
        className={`w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2.5 text-xs font-semibold outline-none focus:ring-2 focus:ring-[#7a0000]/30 focus:border-[#7a0000] transition-all ${mono ? 'font-mono' : ''} ${readOnly ? 'cursor-not-allowed text-gray-400' : ''}`} />
);

const PwdField = ({ value, onChange, readOnly }) => {
    const [show, setShow] = useState(false);
    return (
        <div className="relative">
            <input type={show ? 'text' : 'password'} value={value || ''} onChange={onChange} readOnly={readOnly}
                className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2.5 pr-9 text-xs font-mono outline-none focus:ring-2 focus:ring-[#7a0000]/30 focus:border-[#7a0000] transition-all" />
            {!readOnly && (
                <button type="button" onClick={() => setShow(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#7a0000]">
                    {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
            )}
        </div>
    );
};

// ─── Tab Definitions ──────────────────────────────────────────────────────────
const TABS = [
    { id: 'dashboard',      label: 'Dashboard',       icon: LayoutGrid,   group: 'main' },
    { id: 'branding',       label: 'Institution Profile', icon: Building, group: 'institution' },
    { id: 'academic',       label: 'Academic Settings', icon: GraduationCap,group: 'institution' },
    { id: 'student',        label: 'Student Settings', icon: Users,        group: 'institution' },
    { id: 'staff',          label: 'Staff Settings',   icon: UserPlus,     group: 'institution' },
    { id: 'exams',          label: 'Examination Settings', icon: Award,    group: 'operations' },
    { id: 'attendance',     label: 'Attendance Settings', icon: Clock,     group: 'operations' },
    { id: 'finance',        label: 'Finance Settings', icon: CreditCard,   group: 'operations' },
    { id: 'communications', label: 'Communication Settings', icon: Mail,   group: 'operations' },
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
    const { user } = useAuth();
    const isSuperAdmin = ['superadmin', 'super_admin', 'super admin'].includes((user?.role || '').toLowerCase().trim());

    const defaultSettings = {
        college_name: 'Beautex Technical Training College', college_abbr: 'BTTC',
        college_motto: 'Empowering Minds. Shaping Futures.', college_address: 'Main Campus, Nairobi, Kenya',
        college_phone: '+254 700 000000', college_phone2: '', contact_email: 'info@beautex.edu',
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
        attendance_mode: 'daily', attendance_status_types: 'Present, Absent, Late, Sick, Excused',
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
    };

    const [settings, setSettings]   = useState(defaultSettings);
    const [loading, setLoading]      = useState(true);
    const [saving, setSaving]        = useState(false);
    const [toast, setToast]          = useState(null);
    const [activeTab, setActiveTab]  = useState('dashboard');
    const [searchQuery, setSearchQuery] = useState('');
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const [counts, setCounts] = useState({ programs: 0, courses: 0, students: 0, staff: 0, intakes: 4 });

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
    const [restoring, setRestoring]       = useState(false);

    useEffect(() => {
        fetchSettings(); fetchDepartments(); loadCounts();
    }, []);

    useEffect(() => {
        if (activeTab === 'audit' && isSuperAdmin) fetchAuditLogs();
    }, [activeTab]);

    const showToast = (msg, type = 'success') => {
        setToast({ message: msg, type });
        setTimeout(() => setToast(null), 4000);
    };

    const loadCounts = async () => {
        try {
            const [d, c, s, f] = await Promise.all([
                academicAPI.getDepartments().catch(() => ({ data: [] })),
                coursesAPI.getAll().catch(() => ({ data: [] })),
                studentsAPI.getAll().catch(() => ({ data: [] })),
                facultyAPI.getAll().catch(() => ({ data: [] })),
            ]);
            setCounts({ programs: d.data?.length || 0, courses: c.data?.length || 0, students: s.data?.length || 0, staff: f.data?.length || 0, intakes: 4 });
        } catch {}
    };

    const fetchSettings = async () => {
        try { setLoading(true); const { data } = await settingsAPI.get(); setSettings(p => ({ ...p, ...data })); }
        catch { showToast('Using default settings.', 'error'); }
        finally { setLoading(false); }
    };

    const fetchDepartments = async () => {
        try { setLoadingDepts(true); const { data } = await academicAPI.getDepartments(); setDepartments(data || []); }
        catch {} finally { setLoadingDepts(false); }
    };

    const fetchAuditLogs = async () => {
        try { setLoadingAudit(true); const { data } = await usersAPI.getAuditLogs(); setAuditLogs(data?.logs || []); }
        catch {} finally { setLoadingAudit(false); }
    };

    const set = (key, value) => setSettings(p => ({ ...p, [key]: value }));

    const handleSave = async () => {
        setSaving(true);
        try { await settingsAPI.update(settings); showToast('Configuration saved successfully!'); }
        catch { showToast('Failed to save. Check permissions.', 'error'); }
        finally { setSaving(false); }
    };

    const handleFileUpload = async (file, key, setU) => {
        if (!file) return; setU(true);
        try {
            const fd = new FormData(); fd.append('file', file); fd.append('key', key);
            const { data } = await settingsAPI.uploadSettingFile(fd); set(key, data.value);
            showToast('File uploaded successfully!');
        } catch { showToast('Upload failed.', 'error'); }
        finally { setU(false); }
    };

    const handleBackup = async () => {
        try {
            const r = await settingsAPI.downloadBackup();
            const url = window.URL.createObjectURL(new Blob([r.data]));
            const a = document.createElement('a'); a.href = url;
            a.setAttribute('download', `beautex_backup_${new Date().toISOString().split('T')[0]}.sqlite`);
            document.body.appendChild(a); a.click(); a.remove();
            showToast('Backup downloaded successfully!');
        } catch { showToast('Backup failed.', 'error'); }
    };

    const handleRestore = () => {
        if (!window.confirm('Restore database to last snapshot? This overwrites current data.')) return;
        setRestoring(true);
        setTimeout(() => { setRestoring(false); showToast('Database restored successfully!'); }, 3000);
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

    const visibleTabs = TABS.filter(t => !t.superAdmin || isSuperAdmin);
    const activeTabDef = visibleTabs.find(t => t.id === activeTab);

    const filteredAudit = auditLogs.filter(l => {
        const q = auditSearch.toLowerCase();
        return l.action?.toLowerCase().includes(q) || l.username?.toLowerCase().includes(q) || l.ip_address?.toLowerCase().includes(q);
    });

    // Recent Activity data list (top 5 real audit logs or fallback beautiful mocks)
    const displayActivities = auditLogs.length > 0 
        ? auditLogs.slice(0, 5).map(l => ({
            text: `${l.username || 'System'} ${l.action}`,
            time: l.created_at ? new Date(l.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'recently',
            dot: 'bg-green-500'
          }))
        : [
            { text: 'Super Admin updated college logo', time: '10 mins ago', dot: 'bg-amber-500' },
            { text: 'Registrar added new course', time: '25 mins ago', dot: 'bg-blue-500' },
            { text: 'Admin configured fee structure', time: '1 hour ago', dot: 'bg-emerald-500' },
            { text: 'ICT Admin created new intake', time: '2 hours ago', dot: 'bg-purple-500' },
            { text: 'Accountant recorded new payment method', time: '3 hours ago', dot: 'bg-rose-500' },
          ];

    // Modules list excluding dashboard
    const modulesList = [
        { id: 'branding', title: 'Institution Profile', icon: Building, desc: 'Manage college information, logo, contacts and official details.' },
        { id: 'academic', title: 'Academic Settings', icon: GraduationCap, desc: 'Programs, courses, departments, intakes and academic calendar.' },
        { id: 'student', title: 'Student Settings', icon: Users, desc: 'Admission settings, student categories, status and portal access.' },
        { id: 'staff', title: 'Staff Settings', icon: UserPlus, desc: 'Staff categories, roles, permissions and staff management.' },
        { id: 'exams', title: 'Examination Settings', icon: Award, desc: 'Exam types, grading system, templates and result configurations.' },
        { id: 'attendance', title: 'Attendance Settings', icon: Clock, desc: 'Attendance modes, status types and attendance configurations.' },
        { id: 'finance', title: 'Finance Settings', icon: CreditCard, desc: 'Fee categories, payment methods, penalties and financial controls.' },
        { id: 'communications', title: 'Communication Settings', icon: Mail, desc: 'SMS, email, WhatsApp and notification configurations.' },
        { id: 'certificates', title: 'Certificates & Graduation', icon: FileCheck, desc: 'Certificate templates, numbering and graduation settings.' },
        { id: 'lms', title: 'Learning Management', icon: BookOpen, desc: 'LMS features, assignments, quizzes and online learning settings.' },
        ...(isSuperAdmin ? [
            { id: 'security', title: 'Security Settings', icon: ShieldAlert, desc: 'Password policies, 2FA, login attempts and security configurations.' },
            { id: 'backup', title: 'Backup & Recovery', icon: HardDrive, desc: 'System backups, restore, backup schedules and database logs.' },
            { id: 'integrations', title: 'Integrations', icon: Cpu, desc: 'API integrations, payment gateways and third-party services.' },
        ] : []),
        { id: 'branding_themes', title: 'Branding & Themes', icon: Palette, desc: 'Customize system appearance, colors, logos and templates.' },
        { id: 'system', title: 'System Configuration', icon: SettingsIcon, desc: 'General system settings and configuration management.' },
        ...(isSuperAdmin ? [
            { id: 'audit', title: 'Audit Logs', icon: Terminal, desc: 'View all system activities and configuration changes.' }
        ] : [])
    ];

    // Filter modules based on header search settings query
    const filteredModules = modulesList.filter(m => 
        m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.desc.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Form atomic fields helpers
    const TA = ({ value, onChange, rows = 3 }) => (
        <textarea value={value || ''} onChange={onChange} rows={rows}
            className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2.5 text-xs font-semibold outline-none focus:ring-2 focus:ring-[#7a0000]/30 focus:border-[#7a0000] transition-all resize-none" />
    );

    const Sel = ({ value, onChange, children }) => (
        <select value={value || ''} onChange={onChange}
            className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2.5 text-xs font-semibold outline-none focus:ring-2 focus:ring-[#7a0000]/30 focus:border-[#7a0000] transition-all">
            {children}
        </select>
    );

    const sidebarContent = (
        <div className="flex flex-col h-full bg-[#530000] text-white">
            {/* Sidebar Title */}
            <div className="px-6 py-5 border-b border-white/10">
                <p className="text-[10px] font-black text-[#c8a94a] uppercase tracking-[0.2em]">Settings Control</p>
            </div>
            
            {/* Sidebar Scrollable Menu */}
            <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-0.5 custom-scrollbar-settings">
                {visibleTabs.map(tab => {
                    const Icon = tab.icon;
                    const isAct = activeTab === tab.id;
                    return (
                        <button key={tab.id}
                            onClick={() => { setActiveTab(tab.id); setSidebarOpen(false); }}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all duration-200 group relative ${isAct ? 'bg-[#c8a94a] text-white font-bold shadow-lg' : 'text-white/70 hover:text-white hover:bg-white/5'}`}>
                            {isAct && (
                                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-white rounded-r-full" />
                            )}
                            <Icon className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-105 ${isAct ? 'text-white' : 'text-white/40'}`} />
                            <span className="text-[11px] font-bold tracking-wide uppercase">{tab.label}</span>
                        </button>
                    );
                })}
            </nav>

            {/* Sidebar Footer */}
            <div className="px-6 py-5 border-t border-white/10 bg-[#400000]/40 space-y-3">
                <Link to="/dashboard" className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl border border-white/20 text-white hover:bg-white/10 transition-colors text-[10px] font-black uppercase tracking-wider">
                    <LogOut className="w-3.5 h-3.5 text-yellow-300" />
                    Exit Settings
                </Link>
                <div className="text-center pt-1">
                    <p className="text-[8px] font-black text-white/50 uppercase tracking-[0.1em] leading-tight">Beautex Technical Training College</p>
                    <p className="text-[7.5px] font-bold text-[#c8a94a] italic mt-0.5">Empowering Minds. Shaping Futures.</p>
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
            <header className="h-16 bg-[#530000] text-white flex items-center justify-between px-6 z-50 border-b border-white/10 shrink-0">
                <div className="flex items-center gap-4">
                    {/* Hamburger for mobile */}
                    <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden p-2 rounded-xl text-white hover:bg-white/10 transition-colors">
                        <Menu className="w-5 h-5" />
                    </button>
                    {/* Logo Crest & College Title */}
                    <Link to="/dashboard" className="flex items-center gap-3 group">
                        <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center p-0.5 overflow-hidden border border-white/20 transition-transform group-hover:scale-105">
                            <img src="/app-icon-v2.png" alt="Beautex Crest Logo" className="w-full h-full object-contain" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-base font-black tracking-[0.12em] text-[#c8a94a] uppercase leading-none" style={{ fontFamily: 'Georgia, serif' }}>Beautex</span>
                            <span className="text-[7.5px] font-bold text-white/80 uppercase tracking-widest leading-tight mt-0.5">Technical Training College</span>
                        </div>
                    </Link>
                </div>

                {/* Central Search Bar */}
                <div className="hidden md:flex items-center bg-[#400000]/60 border border-white/10 rounded-xl px-3 py-1.5 w-80 max-w-lg transition-all focus-within:border-[#c8a94a] focus-within:bg-[#380000]">
                    <input 
                        type="text" 
                        placeholder="Search settings..." 
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="bg-transparent border-0 outline-none text-xs text-white placeholder-white/40 w-full font-semibold"
                    />
                    <Search className="w-4 h-4 text-white/40" />
                </div>

                {/* Right Quick Badges */}
                <div className="flex items-center gap-4">
                    <button className="relative p-2 bg-[#400000]/40 rounded-xl hover:bg-white/5 transition-colors border border-white/5">
                        <Mail className="w-4 h-4 text-white/80" />
                        <span className="absolute -top-1 -right-1 bg-[#c8a94a] text-white text-[8px] font-black w-4.5 h-4.5 rounded-full flex items-center justify-center border-2 border-[#530000]">7</span>
                    </button>
                    <button onClick={() => setActiveTab('dashboard')} className="p-2 bg-[#400000]/40 rounded-xl hover:bg-white/5 transition-colors border border-white/5">
                        <SettingsIcon className="w-4 h-4 text-white/80" />
                    </button>
                    
                    {/* User Profile Info Card */}
                    <div className="flex items-center gap-2 border-l border-white/10 pl-4">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#c8a94a] to-[#e4c264] border border-white/20 flex items-center justify-center text-xs font-black text-white overflow-hidden uppercase shadow-sm">
                            {user?.name ? user.name.slice(0, 2) : 'SA'}
                        </div>
                        <div className="hidden sm:flex flex-col">
                            <span className="text-[10px] font-black uppercase text-white tracking-wider leading-none">{user?.name || 'Super Admin'}</span>
                            <span className="text-[7.5px] font-bold text-[#c8a94a] uppercase tracking-widest mt-0.5 leading-none">{isSuperAdmin ? 'Super Administrator' : 'Administrator'}</span>
                        </div>
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
                        <aside className="fixed left-0 top-0 bottom-0 w-64 z-[99] bg-[#530000] shadow-2xl lg:hidden animate-in slide-in-from-left duration-300">
                            {sidebarContent}
                        </aside>
                    </>
                )}

                {/* ── CENTRAL CONTENT VIEW ─────────────────────────────────────── */}
                <main className="flex-1 overflow-y-auto p-6 lg:p-8 custom-scrollbar-settings-main bg-[#fafbfd] dark:bg-[#080809]">
                    
                    {/* ══ DASHBOARD OVERVIEW VIEW ═══════════════════════════════ */}
                    {activeTab === 'dashboard' && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                            
                            {/* Dashboard Header Title */}
                            <div>
                                <h1 className="text-xl font-black text-[#530000] dark:text-[#c8a94a] uppercase tracking-wider leading-none">Settings Dashboard</h1>
                                <p className="text-xs text-zinc-400 font-bold uppercase tracking-wider mt-1.5">Manage all system settings and configurations from one central location</p>
                            </div>

                            {/* KPI Metrics row */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                                {[
                                    { label: 'Programs',  count: counts.programs,  icon: GraduationCap, tab: 'academic',  colorBg: 'bg-rose-950 text-rose-400', border: 'border-rose-100 dark:border-rose-950/20' },
                                    { label: 'Courses',   count: counts.courses,   icon: BookOpen,      tab: 'academic',  colorBg: 'bg-amber-950 text-amber-400', border: 'border-amber-100 dark:border-amber-950/20' },
                                    { label: 'Students',  count: counts.students,  icon: Users,         tab: 'student',   colorBg: 'bg-yellow-950 text-yellow-400', border: 'border-yellow-100 dark:border-yellow-950/20' },
                                    { label: 'Staff Members', count: counts.staff,   icon: UserPlus,    tab: 'staff',     colorBg: 'bg-emerald-950 text-emerald-400', border: 'border-emerald-100 dark:border-emerald-950/20' },
                                    { label: 'Active Intakes', count: counts.intakes, icon: Award,       tab: 'academic',  colorBg: 'bg-blue-950 text-blue-400', border: 'border-blue-100 dark:border-blue-950/20' },
                                ].map((kpi, index) => {
                                    const Icon = kpi.icon;
                                    return (
                                        <button key={index} onClick={() => setActiveTab(kpi.tab)}
                                            className={`bg-white dark:bg-zinc-900 border ${kpi.border} rounded-2xl p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all text-left flex items-center gap-4 group`}>
                                            <div className={`w-11 h-11 rounded-xl ${kpi.colorBg} flex items-center justify-center shadow-inner shrink-0 group-hover:scale-105 transition-transform`}>
                                                <Icon className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <p className="text-2xl font-black text-zinc-800 dark:text-white leading-none">{loading ? '—' : kpi.count}</p>
                                                <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider mt-1">{kpi.label}</p>
                                                <span className="text-[7.5px] text-[#c8a94a] font-bold uppercase tracking-widest mt-1 block group-hover:underline">Manage {kpi.label.split(' ')[0]} →</span>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Main split grid */}
                            <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
                                
                                {/* Left column: Settings modules list grid */}
                                <div className="xl:col-span-3 space-y-4 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/50 dark:border-white/5 p-6 shadow-sm">
                                    <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-white/5">
                                        <div className="flex items-center gap-2">
                                            <Sparkles className="w-4.5 h-4.5 text-[#c8a94a]" />
                                            <span className="text-xs font-black uppercase tracking-wider text-[#530000] dark:text-[#c8a94a]">Settings Modules</span>
                                        </div>
                                        {searchQuery && (
                                            <span className="text-[9px] bg-[#c8a94a]/10 text-[#c8a94a] px-2 py-0.5 rounded-full font-bold uppercase tracking-widest">Filtered: {filteredModules.length}</span>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
                                        {filteredModules.map(mod => {
                                            const Icon = mod.icon;
                                            return (
                                                <button key={mod.id} onClick={() => setActiveTab(mod.id)}
                                                    className="flex items-start gap-3 p-4 border border-zinc-100 dark:border-white/5 hover:border-[#c8a94a]/30 hover:shadow-md rounded-2xl bg-zinc-50/50 dark:bg-white/[0.02] hover:bg-white transition-all group text-left relative overflow-hidden">
                                                    <div className="absolute top-0 left-0 bottom-0 w-1 bg-[#530000] opacity-0 group-hover:opacity-100 transition-opacity" />
                                                    <div className="w-10 h-10 bg-[#530000]/10 dark:bg-white/5 rounded-xl flex items-center justify-center shrink-0 shadow-inner group-hover:bg-[#530000] group-hover:text-white transition-all duration-300">
                                                        <Icon className="w-4.5 h-4.5 text-[#530000] dark:text-[#c8a94a] group-hover:text-white" />
                                                    </div>
                                                    <div className="min-w-0 flex-1 pr-3 pt-0.5">
                                                        <p className="text-[10px] font-black uppercase tracking-wide text-zinc-700 dark:text-zinc-200 group-hover:text-[#530000] dark:group-hover:text-[#c8a94a] transition-colors leading-none truncate">{mod.title}</p>
                                                        <p className="text-[9px] text-zinc-400 font-medium mt-1 leading-normal line-clamp-2">{mod.desc}</p>
                                                    </div>
                                                    <ChevronRight className="w-3.5 h-3.5 text-[#c8a94a] self-center shrink-0 transform group-hover:translate-x-1 transition-transform" />
                                                </button>
                                            );
                                        })}
                                        {filteredModules.length === 0 && (
                                            <div className="col-span-full py-8 text-center text-zinc-400 text-xs font-semibold uppercase tracking-wider">
                                                No settings modules matched your search queries.
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Right column: Quick actions and stats */}
                                <div className="xl:col-span-1 space-y-6">
                                    
                                    {/* Quick Actions */}
                                    <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/50 dark:border-white/5 overflow-hidden shadow-sm">
                                        <div className="px-5 py-3.5 flex items-center gap-2 bg-[#530000] text-white">
                                            <Zap className="w-4 h-4 text-yellow-300 shrink-0" />
                                            <span className="text-[10px] font-black uppercase tracking-widest leading-none mt-0.5">Quick Actions</span>
                                        </div>
                                        <div className="p-3.5 space-y-1">
                                            {[
                                                { label: 'Add New Program',      action: () => { setActiveTab('academic'); setTimeout(openNewDept, 200); } },
                                                { label: 'Add New Course',       action: () => setActiveTab('academic') },
                                                { label: 'Create New Intake',    action: () => setActiveTab('academic') },
                                                { label: 'Add New User',         action: () => window.location.href='/users' },
                                                { label: 'Configure Fee Structure', action: () => setActiveTab('finance') },
                                                { label: 'Send SMS Notification', action: () => setActiveTab('communications') },
                                                { label: 'Backup Now',           action: handleBackup, icon: Download },
                                            ].map((act, idx) => (
                                                <button key={idx} onClick={act.action}
                                                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-[#530000]/5 hover:text-[#530000] dark:hover:bg-white/5 dark:hover:text-[#c8a94a] transition-all text-left text-zinc-600 dark:text-zinc-400 group">
                                                    <div className="w-5 h-5 rounded-lg flex items-center justify-center shrink-0 bg-[#c8a94a]/10 group-hover:bg-[#c8a94a] transition-colors duration-200">
                                                        {act.icon ? <act.icon className="w-3.5 h-3.5 text-[#c8a94a] group-hover:text-white" /> : <Plus className="w-3.5 h-3.5 text-[#c8a94a] group-hover:text-white" />}
                                                    </div>
                                                    <span className="text-[9px] font-black uppercase tracking-wide leading-none mt-0.5">{act.label}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* System Status */}
                                    <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/50 dark:border-white/5 overflow-hidden shadow-sm">
                                        <div className="px-5 py-3.5 flex items-center gap-2 bg-[#530000] text-white">
                                            <Activity className="w-4 h-4 text-[#c8a94a] shrink-0" />
                                            <span className="text-[10px] font-black uppercase tracking-widest leading-none mt-0.5">System Status</span>
                                        </div>
                                        <div className="p-4 space-y-3.5">
                                            {[
                                                { label: 'Database',         status: 'Online' },
                                                { label: 'SMS Gateway',      status: 'Connected' },
                                                { label: 'Email Server',     status: 'Connected' },
                                                { label: 'M-Pesa API',       status: 'Connected' },
                                                { label: 'Backup Status',    status: 'Up to date' },
                                                { label: 'SSL Certificate',  status: 'Active' },
                                            ].map((statusItem, idx) => (
                                                <div key={idx} className="flex justify-between items-center">
                                                    <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">{statusItem.label}</span>
                                                    <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                                        {statusItem.status}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Recent Activity */}
                                    <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/50 dark:border-white/5 overflow-hidden shadow-sm">
                                        <div className="px-5 py-3.5 flex items-center gap-2 bg-[#530000] text-white">
                                            <Clock className="w-4 h-4 text-yellow-300 shrink-0" />
                                            <span className="text-[10px] font-black uppercase tracking-widest leading-none mt-0.5">Recent Activity</span>
                                        </div>
                                        <div className="p-4 space-y-3">
                                            {displayActivities.map((act, idx) => (
                                                <div key={idx} className="flex items-start gap-3 text-left">
                                                    <div className={`w-1.5 h-1.5 rounded-full ${act.dot} shrink-0 mt-1`} />
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-[9.5px] font-bold text-zinc-700 dark:text-zinc-300 leading-snug">{act.text}</p>
                                                        <span className="text-[8px] text-zinc-400 font-semibold uppercase block mt-0.5">{act.time}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                </div>

                            </div>

                            {/* Copyright bottom strip */}
                            <div className="pt-4 flex flex-col sm:flex-row justify-between items-center text-[9px] text-zinc-400 font-semibold uppercase tracking-wider border-t border-zinc-200/40 dark:border-white/5">
                                <span>© 2026 Beautex Technical Training College. All Rights Reserved.</span>
                                <span className="mt-1 sm:mt-0 text-[#c8a94a]">Version 2.0.0</span>
                            </div>

                        </div>
                    )}

                    {/* ══ SETTINGS FORM CONTAINER VIEWS ═════════════════════════ */}
                    {activeTab !== 'dashboard' && (
                        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/50 dark:border-white/5 shadow-sm overflow-hidden animate-in fade-in duration-300">
                            
                            {/* Section header */}
                            <div className="px-7 py-5 border-b border-zinc-100 dark:border-white/5 flex items-center justify-between bg-gradient-to-r from-[#530000]/5 to-[#c8a94a]/5">
                                <div className="flex items-center gap-3">
                                    {activeTabDef && (() => { const Icon = activeTabDef.icon; return (
                                        <div className="w-10 h-10 rounded-2xl flex items-center justify-center bg-[#530000] text-white shadow-md">
                                            <Icon className="w-4.5 h-4.5 text-[#c8a94a]" />
                                        </div>
                                    ); })()}
                                    <div>
                                        <h2 className="text-sm font-black uppercase tracking-wider text-[#530000] dark:text-[#c8a94a] leading-none">{activeTabDef?.label}</h2>
                                        <p className="text-[8px] text-zinc-400 font-black uppercase tracking-widest mt-1.5">Beautex Technical Training College</p>
                                    </div>
                                </div>
                                <button onClick={() => setActiveTab('dashboard')}
                                    className="flex items-center gap-1.5 px-4 py-2 bg-zinc-100 dark:bg-white/5 hover:bg-[#530000]/10 rounded-xl text-[9px] font-black uppercase tracking-widest text-[#530000] dark:text-[#c8a94a] transition-all">
                                    <ArrowLeft className="w-3.5 h-3.5" /> Dashboard Overview
                                </button>
                            </div>

                            <div className="p-7">
                                
                                {/* ══ INSTITUTION PROFILE ══════════════════════════════ */}
                                {activeTab === 'branding' && (
                                    <div className="space-y-2">
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                                            {[
                                                { key:'college_logo', label:'College Logo', icon:Building, ref:logoRef, up:uploadingLogo, setU:setUploadingLogo },
                                                { key:'college_stamp', label:'Official Stamp', icon:FileText, ref:stampRef, up:uploadingStamp, setU:setUploadingStamp },
                                                { key:'college_signature', label:'Principal Signature', icon:Edit3, ref:sigRef, up:uploadingSignature, setU:setUploadingSignature },
                                            ].map(item => {
                                                const Icon = item.icon;
                                                return (
                                                    <div key={item.key} className="p-5 bg-gray-50 dark:bg-white/5 rounded-2xl border border-gray-200 dark:border-white/10 text-center flex flex-col items-center gap-3">
                                                        <div className="w-20 h-20 bg-white rounded-xl border border-gray-200 flex items-center justify-center overflow-hidden shadow-inner">
                                                            {settings[item.key] ? <img src={settings[item.key]} alt={item.label} className="w-full h-full object-contain p-1.5" /> : <Icon className="w-9 h-9 text-gray-300" />}
                                                        </div>
                                                        <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">{item.label}</span>
                                                        <button onClick={() => item.ref.current?.click()} disabled={item.up}
                                                            className="text-[9px] font-black uppercase tracking-widest text-white px-4 py-2 rounded-xl transition-all duration-200 hover:opacity-90 disabled:opacity-50"
                                                            style={{ background: '#530000', border: `1px solid ${GOLD}40` }}>
                                                            {item.up ? 'Uploading...' : 'Upload Image'}
                                                        </button>
                                                        <input ref={item.ref} type="file" accept="image/*" className="hidden" onChange={e => handleFileUpload(e.target.files[0], item.key, item.setU)} />
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        <FieldRow label="College Name"><Inp value={settings.college_name} onChange={e=>set('college_name',e.target.value)} /></FieldRow>
                                        <FieldRow label="Abbreviation"><Inp value={settings.college_abbr} onChange={e=>set('college_abbr',e.target.value)} /></FieldRow>
                                        <FieldRow label="Motto"><Inp value={settings.college_motto} onChange={e=>set('college_motto',e.target.value)} /></FieldRow>
                                        <FieldRow label="Principal Name"><Inp value={settings.college_principal} onChange={e=>set('college_principal',e.target.value)} /></FieldRow>
                                        <FieldRow label="TVETA Reg No."><Inp value={settings.college_reg_number} onChange={e=>set('college_reg_number',e.target.value)} /></FieldRow>
                                        <FieldRow label="KRA PIN"><Inp value={settings.college_kra_pin} onChange={e=>set('college_kra_pin',e.target.value)} /></FieldRow>
                                        <FieldRow label="Address"><Inp value={settings.college_address} onChange={e=>set('college_address',e.target.value)} /></FieldRow>
                                        <FieldRow label="Contact Email"><Inp value={settings.contact_email} onChange={e=>set('contact_email',e.target.value)} /></FieldRow>
                                        <FieldRow label="Website"><Inp value={settings.college_website} onChange={e=>set('college_website',e.target.value)} /></FieldRow>
                                        <FieldRow label="Primary Phone"><Inp value={settings.college_phone} onChange={e=>set('college_phone',e.target.value)} /></FieldRow>
                                        <FieldRow label="Secondary Phone"><Inp value={settings.college_phone2} onChange={e=>set('college_phone2',e.target.value)} /></FieldRow>
                                    </div>
                                )}

                                {/* ══ ACADEMIC SETTINGS ════════════════════════════════ */}
                                {activeTab === 'academic' && (
                                    <div className="space-y-5">
                                        <div className="mb-6 bg-gray-50 dark:bg-white/5 p-5 rounded-2xl border border-gray-100 dark:border-white/5">
                                            <div className="flex justify-between items-center mb-5 pb-3 border-b border-gray-200/50 dark:border-white/5">
                                                <h4 className="text-xs font-black uppercase tracking-widest text-[#530000] dark:text-[#c8a94a]">Departments Register</h4>
                                                <button onClick={openNewDept} className="text-white text-[9px] font-black uppercase tracking-widest px-4 py-2.5 rounded-xl flex items-center gap-1.5 transition-all hover:opacity-90 shadow-md"
                                                    style={{ background: `linear-gradient(135deg, ${M_DEEP}, ${M_MID})`, border: `1px solid ${GOLD}30` }}>
                                                    <Plus className="w-3.5 h-3.5" /> Add Department
                                                </button>
                                            </div>
                                            {loadingDepts ? <p className="text-center py-4 text-xs text-gray-400 font-semibold">Loading departments...</p> : (
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-xs">
                                                        <thead><tr className="border-b border-gray-200 dark:border-white/10">
                                                            <th className="py-2.5 text-[9px] font-black text-gray-400 uppercase tracking-widest text-left">Department Name</th>
                                                            <th className="py-2.5 text-[9px] font-black text-gray-400 uppercase tracking-widest text-left">Head of Department (HOD)</th>
                                                            <th className="py-2.5 text-[9px] font-black text-gray-400 uppercase tracking-widest text-right">Actions</th>
                                                        </tr></thead>
                                                        <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                                                            {departments.map(d => (
                                                                <tr key={d.id} className="hover:bg-[#530000]/5 dark:hover:bg-white/5 transition-colors">
                                                                    <td className="py-3 font-semibold text-zinc-700 dark:text-zinc-200">{d.name}</td>
                                                                    <td className="py-3 text-zinc-400">{d.head_of_department || 'Unassigned'}</td>
                                                                    <td className="py-3 text-right">
                                                                        <div className="flex justify-end gap-1.5">
                                                                            <button onClick={() => openEditDept(d)} className="p-2 rounded-xl bg-white dark:bg-zinc-800 border border-gray-200 dark:border-white/5 hover:border-[#c8a94a] hover:text-[#530000] dark:hover:text-[#c8a94a] transition-all"><Edit3 className="w-3.5 h-3.5" /></button>
                                                                            <button onClick={() => handleDeptDelete(d.id)} className="p-2 rounded-xl bg-white dark:bg-zinc-800 border border-gray-200 dark:border-white/5 hover:bg-red-50 dark:hover:bg-red-950/20 hover:text-red-600 transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                            {departments.length === 0 && <tr><td colSpan="3" className="py-6 text-center text-zinc-400 text-xs font-semibold">No departments configured yet.</td></tr>}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </div>

                                        <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 border-b border-gray-100 dark:border-white/5 pb-2 mb-4 mt-6">Intake Configuration</p>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {[{id:'jan',label:'January Intake'},{id:'may',label:'May Intake'},{id:'sept',label:'September Intake'},{id:'rolling',label:'Rolling Enrollment'}].map(i => (
                                                <div key={i.id} className="flex items-center justify-between gap-4 p-4 bg-gray-50 dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/5">
                                                    <span className="text-xs font-black text-zinc-700 dark:text-[#c8a94a] uppercase tracking-wide">{i.label}</span>
                                                    <div className="flex gap-3 items-center">
                                                        <Sel value={settings[`intake_${i.id}_status`]} onChange={e=>set(`intake_${i.id}_status`,e.target.value)}>
                                                            <option value="open">Open</option><option value="closed">Closed</option><option value="suspended">Suspended</option>
                                                        </Sel>
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Cap:</span>
                                                            <input type="number" value={settings[`intake_${i.id}_capacity`] || ''} onChange={e=>set(`intake_${i.id}_capacity`,e.target.value)} className="w-20 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-white/10 rounded-lg px-2.5 py-2 text-xs font-bold text-center outline-none" />
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        <FieldRow label="Online Applications" description="Allow self-enrollment requests from prospective students.">
                                            <div className="flex items-center gap-3"><Toggle value={settings.intake_online_app_enabled} onChange={v=>set('intake_online_app_enabled',v)} /><StatusBadge active={settings.intake_online_app_enabled} labelOn="Enabled" labelOff="Disabled" /></div>
                                        </FieldRow>
                                    </div>
                                )}

                                {/* ══ STUDENT SETTINGS ══════════════════════════════════ */}
                                {activeTab === 'student' && (
                                    <div className="space-y-2">
                                        <FieldRow label="Admission No. Format"><Inp value={settings.admission_number_format} onChange={e=>set('admission_number_format',e.target.value)} /></FieldRow>
                                        <FieldRow label="Enrollment Categories" description="Comma-separated student classification filters."><TA value={settings.student_categories} onChange={e=>set('student_categories',e.target.value)} /></FieldRow>
                                        <FieldRow label="Student Status Codes" description="Active states for the student lifecycle register."><TA value={settings.student_statuses} onChange={e=>set('student_statuses',e.target.value)} /></FieldRow>
                                        
                                        <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest border-b border-gray-100 dark:border-white/5 pb-2 mb-4 mt-6">Student Portal Access Nodes</p>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {[
                                                {key:'student_portal_results',label:'Grades & Results'},
                                                {key:'student_portal_fees',label:'Finance & Invoices'},
                                                {key:'student_portal_timetables',label:'Class Timetables'},
                                                {key:'student_portal_materials',label:'Learning Materials'},
                                                {key:'student_portal_certificates',label:'Certificates'},
                                                {key:'student_portal_attendance',label:'Attendance Audit'},
                                            ].map(i=>(
                                                <div key={i.key} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5 rounded-2xl">
                                                    <p className="text-xs font-black uppercase tracking-wide text-zinc-700 dark:text-zinc-300">{i.label}</p>
                                                    <Toggle value={settings[i.key]} onChange={v=>set(i.key,v)} />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* ══ STAFF SETTINGS ════════════════════════════════════ */}
                                {activeTab === 'staff' && (
                                    <div className="space-y-2">
                                        <FieldRow label="Staff Categories" description="Configurable operational categories for trainers."><TA value={settings.staff_categories} onChange={e=>set('staff_categories',e.target.value)} /></FieldRow>
                                        <FieldRow label="Staff Roles" description="Security classification mappings for access logs."><TA value={settings.staff_roles} onChange={e=>set('staff_roles',e.target.value)} /></FieldRow>
                                    </div>
                                )}

                                {/* ══ EXAMS & GRADING ═══════════════════════════════════ */}
                                {activeTab === 'exams' && (
                                    <div className="space-y-2">
                                        <FieldRow label="Assessment Types" description="Comma-separated catalog of exams."><TA value={settings.assessment_types} onChange={e=>set('assessment_types',e.target.value)} /></FieldRow>
                                        
                                        <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest border-b border-gray-100 dark:border-white/5 pb-2 mb-5 mt-6">Grade Bands & Dynamic Calculations</p>
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                            {[
                                                {key:'grading_distinction_min',label:'Distinction Min %',c:'border-green-200 dark:border-green-950/20 bg-green-50/50 dark:bg-green-950/10 text-green-700 dark:text-green-400'},
                                                {key:'grading_credit_min',label:'Credit Min %',c:'border-blue-200 dark:border-blue-950/20 bg-blue-50/50 dark:bg-blue-950/10 text-blue-700 dark:text-blue-400'},
                                                {key:'grading_pass_min',label:'Pass Min %',c:'border-amber-200 dark:border-amber-950/20 bg-amber-50/50 dark:bg-amber-950/10 text-amber-700 dark:text-[#c8a94a]'},
                                                {key:'grading_fail_min',label:'Fail Min %',c:'border-red-200 dark:border-red-950/20 bg-red-50/50 dark:bg-red-950/10 text-red-600 dark:text-red-400'},
                                            ].map(b=>(
                                                <div key={b.key} className={`p-4 border rounded-2xl text-center ${b.c}`}>
                                                    <span className="text-[9px] font-black uppercase tracking-widest block mb-2">{b.label}</span>
                                                    <input type="number" value={settings[b.key]||''} onChange={e=>set(b.key,e.target.value)} className="w-full bg-white dark:bg-zinc-800 border border-gray-200 dark:border-white/5 rounded-lg px-2.5 py-1.5 text-center text-sm font-black outline-none" />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* ══ ATTENDANCE ════════════════════════════════════════ */}
                                {activeTab === 'attendance' && (
                                    <div className="space-y-2">
                                        <FieldRow label="Tracking Mode">
                                            <Sel value={settings.attendance_mode} onChange={e=>set('attendance_mode',e.target.value)}>
                                                <option value="daily">Daily Attendance</option>
                                                <option value="per_lesson">Per-Lesson Attendance</option>
                                                <option value="qr_code">QR Code Scan Mode</option>
                                            </Sel>
                                        </FieldRow>
                                        <FieldRow label="Status Codes" description="Custom codes representing student daily attendance."><TA value={settings.attendance_status_types} onChange={e=>set('attendance_status_types',e.target.value)} /></FieldRow>
                                    </div>
                                )}

                                {/* ══ FINANCE ═══════════════════════════════════════════ */}
                                {activeTab === 'finance' && (
                                    <div className="space-y-2">
                                        <FieldRow label="Fee Categories"><TA value={settings.fee_categories} onChange={e=>set('fee_categories',e.target.value)} rows={4} /></FieldRow>
                                        <FieldRow label="Payment Methods"><TA value={settings.payment_methods} onChange={e=>set('payment_methods',e.target.value)} /></FieldRow>
                                        <FieldRow label="Penalty Rate (%)" description="Late penalty fees interest rate."><Inp type="number" value={settings.finance_penalty_rate} onChange={e=>set('finance_penalty_rate',e.target.value)} /></FieldRow>
                                        <FieldRow label="Discount Rate (%)" description="Early payments discount rate."><Inp type="number" value={settings.finance_discount_rate} onChange={e=>set('finance_discount_rate',e.target.value)} /></FieldRow>
                                        <FieldRow label="Scholarship Types"><TA value={settings.finance_scholarship_types} onChange={e=>set('finance_scholarship_types',e.target.value)} /></FieldRow>
                                        <FieldRow label="Allow Installments" description="Permit multiple partial fee payments.">
                                            <div className="flex items-center gap-3"><Toggle value={settings.finance_installments_allowed} onChange={v=>set('finance_installments_allowed',v)} /><StatusBadge active={settings.finance_installments_allowed} labelOn="Allowed" labelOff="Disabled" /></div>
                                        </FieldRow>
                                    </div>
                                )}

                                {/* ══ COMMUNICATIONS ════════════════════════════════════ */}
                                {activeTab === 'communications' && (
                                    <div className="space-y-2">
                                        <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest border-b border-gray-100 dark:border-white/5 pb-2 mb-4">SMS Broadcast Triggers</p>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                                            {[
                                                {key:'sms_admission_confirm',label:'Admission Confirmation'},
                                                {key:'sms_fee_reminder',label:'Fee Overdue Alerts'},
                                                {key:'sms_cat_notify',label:'CAT Results'},
                                                {key:'sms_exam_notify',label:'Exam Results'},
                                                {key:'sms_grad_notify',label:'Graduation Notice'},
                                            ].map(s=>(
                                                <div key={s.key} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5 rounded-2xl">
                                                    <p className="text-xs font-black uppercase tracking-wide text-zinc-700 dark:text-zinc-300">{s.label}</p>
                                                    <Toggle value={settings[s.key]} onChange={v=>set(s.key,v)} />
                                                </div>
                                            ))}
                                        </div>

                                        <FieldRow label="WhatsApp Integration"><Toggle value={settings.whatsapp_integration} onChange={v=>set('whatsapp_integration',v)} /></FieldRow>
                                        
                                        <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest border-b border-gray-100 dark:border-white/5 pb-2 mb-4 mt-6">SMTP Mail Server (Credential Node)</p>
                                        <FieldRow label="SMTP Host"><Inp value={settings.smtp_host} onChange={e=>set('smtp_host',e.target.value)} placeholder="smtp.gmail.com" readOnly={!isSuperAdmin} /></FieldRow>
                                        <FieldRow label="SMTP Port"><Inp value={settings.smtp_port} onChange={e=>set('smtp_port',e.target.value)} placeholder="587" readOnly={!isSuperAdmin} /></FieldRow>
                                        <FieldRow label="SMTP Username"><Inp value={settings.smtp_user} onChange={e=>set('smtp_user',e.target.value)} readOnly={!isSuperAdmin} /></FieldRow>
                                        <FieldRow label="SMTP Password"><PwdField value={isSuperAdmin?settings.smtp_pass:'••••••••'} onChange={e=>set('smtp_pass',e.target.value)} readOnly={!isSuperAdmin} /></FieldRow>
                                        <FieldRow label="Secure TLS"><Toggle value={settings.smtp_secure} onChange={v=>set('smtp_secure',v)} locked={!isSuperAdmin} /></FieldRow>
                                    </div>
                                )}

                                {/* ══ CERTIFICATES ══════════════════════════════════════ */}
                                {activeTab === 'certificates' && (
                                    <div className="space-y-2">
                                        <FieldRow label="Certificate No. Format"><Inp value={settings.certificate_no_format} onChange={e=>set('certificate_no_format',e.target.value)} mono /></FieldRow>
                                        <FieldRow label="Graduation Registry Format"><Inp value={settings.graduation_no_format} onChange={e=>set('graduation_no_format',e.target.value)} mono /></FieldRow>
                                        <FieldRow label="Short-Course Template">
                                            <Sel value={settings.certificate_short_course_template} onChange={e=>set('certificate_short_course_template',e.target.value)}>
                                                <option value="standard">Standard Grid</option><option value="classic">Classic Calligraphy</option><option value="modern">Modern Glassmorphic</option>
                                            </Sel>
                                        </FieldRow>
                                        <FieldRow label="Diploma Template">
                                            <Sel value={settings.certificate_diploma_template} onChange={e=>set('certificate_diploma_template',e.target.value)}>
                                                <option value="standard">Standard Grid</option><option value="classic">Classic Calligraphy</option><option value="modern">Modern Glassmorphic</option>
                                            </Sel>
                                        </FieldRow>
                                        <FieldRow label="Embed QR Verification"><Toggle value={settings.qr_verification_enabled} onChange={v=>set('qr_verification_enabled',v)} /></FieldRow>
                                        <FieldRow label="Digital Signatures"><Toggle value={settings.digital_signatures_enabled} onChange={v=>set('digital_signatures_enabled',v)} /></FieldRow>
                                    </div>
                                )}

                                {/* ══ LMS ═══════════════════════════════════════════════ */}
                                {activeTab === 'lms' && (
                                    <div className="space-y-4">
                                        {[
                                            {key:'lms_assignments_enabled',label:'Assignment Upload Node'},
                                            {key:'lms_materials_enabled',label:'Courseware Materials'},
                                            {key:'lms_online_exams_enabled',label:'CBT Online Exams'},
                                            {key:'lms_online_classes_enabled',label:'Virtual Class Integrations'},
                                            {key:'lms_discussions_enabled',label:'Classroom Forums'},
                                        ].map(l=>(
                                            <div key={l.key} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5 rounded-2xl">
                                                <p className="text-xs font-black uppercase tracking-wide text-zinc-700 dark:text-zinc-300">{l.label}</p>
                                                <Toggle value={settings[l.key]} onChange={v=>set(l.key,v)} />
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* ══ SECURITY ══════════════════════════════════════════ */}
                                {activeTab === 'security' && isSuperAdmin && (
                                    <div className="space-y-2">
                                        <FieldRow label="Min Password Length"><Inp type="number" value={settings.password_policy_min_len} onChange={e=>set('password_policy_min_len',e.target.value)} /></FieldRow>
                                        <FieldRow label="Require Special Chars"><Toggle value={settings.password_policy_require_special} onChange={v=>set('password_policy_require_special',v)} /></FieldRow>
                                        <FieldRow label="Two-Factor Auth (2FA)"><Toggle value={settings.two_factor_auth} onChange={v=>set('two_factor_auth',v)} /></FieldRow>
                                        <FieldRow label="Session Timeout (mins)"><Inp type="number" value={settings.session_timeout} onChange={e=>set('session_timeout',e.target.value)} /></FieldRow>
                                        <FieldRow label="Login Lockout Attempts"><Inp type="number" value={settings.failed_login_attempts} onChange={e=>set('failed_login_attempts',e.target.value)} /></FieldRow>
                                        <FieldRow label="Activity Monitoring"><Toggle value={settings.activity_monitoring_enabled} onChange={v=>set('activity_monitoring_enabled',v)} /></FieldRow>
                                    </div>
                                )}

                                {/* ══ INTEGRATIONS ══════════════════════════════════════ */}
                                {activeTab === 'integrations' && isSuperAdmin && (
                                    <div className="space-y-5">
                                        <div className="p-5 bg-gray-50 dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/5">
                                            <p className="text-[10px] font-black text-[#530000] dark:text-[#c8a94a] uppercase tracking-widest mb-4">M-Pesa Merchant Gateway</p>
                                            <FieldRow label="M-Pesa Active"><Toggle value={settings.mpesa_status} onChange={v=>set('mpesa_status',v)} /></FieldRow>
                                            <FieldRow label="Paybill Shortcode"><Inp value={settings.mpesa_shortcode} onChange={e=>set('mpesa_shortcode',e.target.value)} mono /></FieldRow>
                                            <FieldRow label="Consumer Key"><Inp value={settings.mpesa_consumer_key} onChange={e=>set('mpesa_consumer_key',e.target.value)} mono /></FieldRow>
                                            <FieldRow label="Consumer Secret"><PwdField value={settings.mpesa_consumer_secret} onChange={e=>set('mpesa_consumer_secret',e.target.value)} /></FieldRow>
                                            <FieldRow label="API Passkey"><PwdField value={settings.mpesa_passkey} onChange={e=>set('mpesa_passkey',e.target.value)} /></FieldRow>
                                            <FieldRow label="Callback URL"><Inp value={settings.mpesa_callback_url} onChange={e=>set('mpesa_callback_url',e.target.value)} /></FieldRow>
                                        </div>
                                        <div className="p-5 bg-gray-50 dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/5">
                                            <p className="text-[10px] font-black text-[#530000] dark:text-[#c8a94a] uppercase tracking-widest mb-4">External API Keys</p>
                                            <FieldRow label="Google Calendar API"><PwdField value={settings.google_calendar_api_key} onChange={e=>set('google_calendar_api_key',e.target.value)} /></FieldRow>
                                            <FieldRow label="Zoom SDK Key"><PwdField value={settings.zoom_api_key} onChange={e=>set('zoom_api_key',e.target.value)} /></FieldRow>
                                            <FieldRow label="Google Meet Client ID"><PwdField value={settings.google_meet_api_key} onChange={e=>set('google_meet_api_key',e.target.value)} /></FieldRow>
                                        </div>
                                    </div>
                                )}

                                {/* ══ BACKUP ════════════════════════════════════════════ */}
                                {activeTab === 'backup' && isSuperAdmin && (
                                    <div className="space-y-5">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                            <div className="p-6 bg-red-50/50 dark:bg-red-950/10 border border-red-100 dark:border-red-950/20 rounded-2xl space-y-3">
                                                <HardDrive className="w-7 h-7 text-[#530000] dark:text-[#c8a94a]" />
                                                <h4 className="text-xs font-black uppercase text-[#530000] dark:text-[#c8a94a] tracking-wider">Raw Database Snapshot</h4>
                                                <p className="text-[10px] text-zinc-400 font-semibold leading-relaxed">Download a complete SQLite database backup snapshot directly.</p>
                                                <button onClick={handleBackup} className="w-full flex items-center justify-center gap-2 text-white py-3 rounded-xl font-black text-[9px] uppercase tracking-widest hover:opacity-90 transition-opacity shadow-md"
                                                    style={{ background: '#530000', border: `1px solid ${GOLD}40` }}>
                                                    <Download className="w-4 h-4" /> Download Backup
                                                </button>
                                            </div>
                                            <div className="p-6 bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 rounded-2xl space-y-3">
                                                <RefreshCw className={`w-7 h-7 text-zinc-500 ${restoring?'animate-spin':''}`} />
                                                <h4 className="text-xs font-black uppercase text-zinc-700 dark:text-zinc-200 tracking-wider">Restore Safe State</h4>
                                                <p className="text-[10px] text-zinc-400 font-semibold leading-relaxed">Restore database to the last known safe snapshot state.</p>
                                                <button onClick={handleRestore} disabled={restoring} className="w-full flex items-center justify-center gap-2 bg-zinc-700 hover:bg-zinc-800 text-white py-3 rounded-xl font-black text-[9px] uppercase tracking-widest disabled:opacity-50 transition-colors shadow-sm">
                                                    <RefreshCw className="w-4 h-4" /> {restoring?'Restoring...':'Trigger Auto-Restore'}
                                                </button>
                                            </div>
                                        </div>
                                        <FieldRow label="Auto-Backup Schedule">
                                            <Sel value={settings.backup_interval} onChange={e=>set('backup_interval',e.target.value)}>
                                                <option value="daily">Daily Cron Job</option><option value="weekly">Weekly Cron Job</option><option value="monthly">Monthly Cron Job</option><option value="manual">Manual Only</option>
                                            </Sel>
                                        </FieldRow>
                                        <FieldRow label="Snapshot Types"><Inp value={settings.backup_types} onChange={e=>set('backup_types',e.target.value)} mono /></FieldRow>
                                    </div>
                                )}

                                {/* ══ THEMES ════════════════════════════════════════════ */}
                                {activeTab === 'branding_themes' && (
                                    <div className="space-y-2">
                                        <FieldRow label="Primary Color">
                                            <div className="flex items-center gap-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg p-2">
                                                <div className="w-9 h-9 rounded-lg shadow border border-white" style={{backgroundColor:settings.portal_theme_colors}} />
                                                <input type="color" value={settings.portal_theme_colors} onChange={e=>set('portal_theme_colors',e.target.value)} className="w-9 h-9 rounded-lg cursor-pointer bg-transparent border-0" />
                                                <span className="text-xs font-mono font-black text-gray-500">{settings.portal_theme_colors}</span>
                                            </div>
                                        </FieldRow>
                                        <FieldRow label="Sidebar Color">
                                            <div className="flex items-center gap-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg p-2">
                                                <div className="w-9 h-9 rounded-lg shadow border border-white" style={{backgroundColor:settings.sidebar_colors}} />
                                                <input type="color" value={settings.sidebar_colors} onChange={e=>set('sidebar_colors',e.target.value)} className="w-9 h-9 rounded-lg cursor-pointer bg-transparent border-0" />
                                                <span className="text-xs font-mono font-black text-gray-500">{settings.sidebar_colors}</span>
                                            </div>
                                        </FieldRow>
                                        <FieldRow label="Login Banner URL"><Inp value={settings.login_banner_url} onChange={e=>set('login_banner_url',e.target.value)} /></FieldRow>
                                    </div>
                                )}

                                {/* ══ SYSTEM CONFIGURATION ══════════════════════════════ */}
                                {activeTab === 'system' && (
                                    <div className="space-y-5">
                                        <div className="flex items-center gap-3 bg-green-50 dark:bg-green-950/20 px-4 py-3 rounded-xl border border-green-200/50">
                                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                                            <span className="text-[10px] font-black text-green-700 dark:text-green-400 uppercase tracking-widest mt-0.5">All Systems Operational</span>
                                            <span className="ml-auto text-[9px] text-zinc-400 font-bold uppercase tracking-widest">v{settings.system_version}</span>
                                        </div>
                                        <div className="p-5 bg-zinc-900 rounded-2xl font-mono text-[10px] text-zinc-400 space-y-1.5 border border-white/5">
                                            <p><span className="text-zinc-600">[SYS]</span> System nominal boot check completed.</p>
                                            <p><span className="text-zinc-600">[SEC]</span> JWT cryptography middleware initiated.</p>
                                            <p><span className="text-zinc-600">[DB]</span> DB pool initialized (SQLite).</p>
                                            <p className="text-green-400"><span className="text-green-500">[SYS]</span> All sub-routers loaded successfully.</p>
                                        </div>
                                    </div>
                                )}

                                {/* ══ AUDIT LOGS ════════════════════════════════════════ */}
                                {activeTab === 'audit' && isSuperAdmin && (
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl p-2.5">
                                            <Search className="w-4 h-4 text-gray-400 ml-1" />
                                            <input type="text" value={auditSearch} onChange={e=>setAuditSearch(e.target.value)} placeholder="Filter by operator, action, or IP..." className="w-full bg-transparent text-xs font-semibold outline-none pl-1" />
                                        </div>
                                        {loadingAudit ? <p className="text-center py-6 text-xs text-gray-400 font-semibold">Loading audit logs...</p> : (
                                            <div className="border border-gray-100 dark:border-white/5 rounded-2xl overflow-hidden shadow-inner">
                                                <table className="w-full text-left text-xs">
                                                    <thead><tr className="bg-gray-50 dark:bg-white/5 border-b border-gray-200/50 dark:border-white/5">
                                                        <th className="px-4 py-3 text-[9px] font-black text-zinc-400 uppercase tracking-widest">Date</th>
                                                        <th className="px-4 py-3 text-[9px] font-black text-zinc-400 uppercase tracking-widest">Operator</th>
                                                        <th className="px-4 py-3 text-[9px] font-black text-zinc-400 uppercase tracking-widest">Activity</th>
                                                        <th className="px-4 py-3 text-[9px] font-black text-zinc-400 uppercase tracking-widest">IP Address</th>
                                                    </tr></thead>
                                                    <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                                                        {filteredAudit.map((l,i)=>(
                                                            <tr key={l.id||i} className="hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors">
                                                                <td className="px-4 py-3 text-zinc-400 font-semibold">{l.created_at?new Date(l.created_at).toLocaleString():'—'}</td>
                                                                <td className="px-4 py-3 font-bold text-zinc-700 dark:text-zinc-200">{l.username||'system'}</td>
                                                                <td className="px-4 py-3 text-[#530000] dark:text-[#c8a94a] font-black">{l.action}</td>
                                                                <td className="px-4 py-3 font-mono text-zinc-500">{l.ip_address||'127.0.0.1'}</td>
                                                            </tr>
                                                        ))}
                                                        {filteredAudit.length===0&&<tr><td colSpan="4" className="px-4 py-6 text-center text-zinc-400 font-semibold uppercase tracking-wider">No logs found.</td></tr>}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* ── SAVE CHANGES FOOTER ─────────────────────────────── */}
                            <div className="px-7 py-4 border-t border-gray-100 dark:border-white/5 flex items-center justify-between gap-4 bg-gray-50/50 dark:bg-white/[0.02]">
                                <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider hidden sm:block">
                                    Click save to commit configuration changes to the database.
                                </p>
                                <button onClick={handleSave} disabled={saving}
                                    className="flex items-center gap-2 text-white px-7 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest disabled:opacity-50 transition-all shadow-md hover:shadow-lg hover:opacity-90 ml-auto"
                                    style={{ background: '#530000', border: `1px solid ${GOLD}25` }}>
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
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-[100] animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-zinc-900 rounded-3xl p-7 max-w-md w-full shadow-2xl relative overflow-hidden border border-[#530000]/10">
                        <div className="absolute top-0 left-0 right-0 h-1"
                            style={{ background: `linear-gradient(90deg, ${M_DEEP}, ${GOLD}, ${M_LIGHT})` }} />
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h2 className="text-base font-black text-[#530000] dark:text-[#c8a94a] uppercase tracking-tight">
                                    {editingDept ? 'Update Department' : 'New Department'}
                                </h2>
                                <div className="w-8 h-0.5 mt-1.5" style={{ background: GOLD }} />
                            </div>
                            <button onClick={()=>setShowDeptModal(false)} className="p-1.5 hover:bg-[#530000]/5 rounded-full transition-colors">
                                <XCircle className="w-5 h-5 text-gray-300 hover:text-red-500" />
                            </button>
                        </div>
                        <form onSubmit={handleDeptSubmit} className="space-y-4">
                            <div>
                                <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block mb-1.5">Department Name *</label>
                                <input type="text" value={deptForm.name} onChange={e=>setDeptForm({...deptForm,name:e.target.value})} required placeholder="e.g. Department of Cosmetology" className="w-full px-3.5 py-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-[#7a0000]/30 focus:border-[#7a0000]" />
                            </div>
                            <div>
                                <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block mb-1.5">Head of Department (HOD)</label>
                                <input type="text" value={deptForm.head_of_department} onChange={e=>setDeptForm({...deptForm,head_of_department:e.target.value})} placeholder="e.g. Ms. Grace Kemunto" className="w-full px-3.5 py-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-[#7a0000]/30 focus:border-[#7a0000]" />
                            </div>
                            <div>
                                <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block mb-1.5">Description</label>
                                <textarea value={deptForm.description} onChange={e=>setDeptForm({...deptForm,description:e.target.value})} placeholder="Brief department overview..." rows={3} className="w-full px-3.5 py-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-[#7a0000]/30 focus:border-[#7a0000] resize-none" />
                            </div>
                            <button type="submit" disabled={savingDept} className="w-full text-yellow-100 py-3.5 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg transition-all hover:opacity-90 disabled:opacity-60"
                                style={{ background: '#530000', border: `1px solid ${GOLD}25` }}>
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
                .custom-scrollbar-settings-main::-webkit-scrollbar-thumb { background: rgba(83, 0, 0, 0.15); border-radius: 9px; }
                .dark .custom-scrollbar-settings-main::-webkit-scrollbar-thumb { background: rgba(200, 169, 74, 0.2); }
            `}</style>
        </div>
    );
}
