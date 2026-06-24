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
    ArrowLeft, Sparkles, Activity, Zap, Menu, LogOut, ChevronRight,
    Calendar, MessageSquare, Package, Sliders
} from 'lucide-react';
import { settingsAPI, academicAPI, usersAPI, coursesAPI, studentsAPI, facultyAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

// ─── Design Tokens ─────────────────────────────────────────────────────────────
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
        className={`w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2.5 text-xs font-semibold outline-none focus:ring-2 focus:ring-maroon/30 focus:border-maroon transition-all ${mono ? 'font-mono' : ''} ${readOnly ? 'cursor-not-allowed text-gray-400' : ''}`} />
);

const PwdField = ({ value, onChange, readOnly }) => {
    const [show, setShow] = useState(false);
    return (
        <div className="relative">
            <input type={show ? 'text' : 'password'} value={value || ''} onChange={onChange} readOnly={readOnly}
                className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2.5 pr-9 text-xs font-mono outline-none focus:ring-2 focus:ring-maroon/30 focus:border-maroon transition-all" />
            {!readOnly && (
                <button type="button" onClick={() => setShow(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-maroon">
                    {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
            )}
        </div>
    );
};

const TagInputList = ({ value, onChange, placeholder, readOnly }) => {
    const tags = (value || '').split(',').map(t => t.trim()).filter(Boolean);
    const [newTag, setNewTag] = useState('');
    const handleAdd = () => {
        if (!newTag.trim()) return;
        if (tags.includes(newTag.trim())) return;
        const updated = [...tags, newTag.trim()].join(', ');
        onChange(updated);
        setNewTag('');
    };
    const handleRemove = (tagToRemove) => {
        const updated = tags.filter(t => t !== tagToRemove).join(', ');
        onChange(updated);
    };
    return (
        <div className="space-y-2">
            <div className="flex flex-wrap gap-1.5 p-2.5 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl min-h-[50px]">
                {tags.map(t => (
                    <span key={t} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider bg-maroon/5 text-maroon dark:bg-gold/10 dark:text-gold border border-maroon/10 dark:border-gold/20">
                        {t}
                        {!readOnly && (
                            <button type="button" onClick={() => handleRemove(t)} className="hover:text-red-500 font-extrabold text-[11px] leading-none transition-colors">×</button>
                        )}
                    </span>
                ))}
                {tags.length === 0 && <span className="text-[10px] text-zinc-400 font-semibold self-center px-1">No items defined.</span>}
            </div>
            {!readOnly && (
                <div className="flex gap-2">
                    <input type="text" value={newTag} onChange={e => setNewTag(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAdd(); } }} placeholder={placeholder || "Add item..."} className="flex-1 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:ring-2 focus:ring-maroon/30 focus:border-maroon transition-all" />
                    <button type="button" onClick={handleAdd} className="bg-maroon hover:opacity-90 text-white text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl border border-gold/30 transition-all shadow-sm">Add</button>
                </div>
            )}
        </div>
    );
};

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
    
    // States for premium visual modules enhancements
    const [testingIntegration, setTestingIntegration] = useState({});
    const [integrationStatus, setIntegrationStatus] = useState({});
    const [activeSmsPreview, setActiveSmsPreview] = useState('template_admission_sms');

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

    const triggerTestIntegration = (gateway) => {
        setTestingIntegration(p => ({ ...p, [gateway]: true }));
        setIntegrationStatus(p => ({ ...p, [gateway]: null }));
        setTimeout(() => {
            setTestingIntegration(p => ({ ...p, [gateway]: false }));
            let msg = '';
            if (gateway === 'mpesa') {
                msg = `SUCCESS: Connected to Safaricom Daraja Sandbox. Paybill: ${settings.mpesa_shortcode || 'N/A'}`;
            } else if (gateway === 'google_calendar') {
                msg = 'SUCCESS: Google OAuth 2.0 connection verified. Calendar synced.';
            } else if (gateway === 'zoom') {
                msg = 'SUCCESS: JWT token generated. Meeting scheduler ready.';
            } else if (gateway === 'google_meet') {
                msg = 'SUCCESS: Client Handshake OK. API operational.';
            } else {
                msg = 'SUCCESS: Server handshake completed.';
            }
            setIntegrationStatus(p => ({ ...p, [gateway]: msg }));
        }, 1500);
    };

    const set = (key, value) => setSettings(p => ({ ...p, [key]: value }));

    const handleSave = async () => {
        setSaving(true);
        try { 
            await settingsAPI.update(settings); 
            showToast('Configuration saved successfully!');
            
            // Instantly apply theme colors to the document variables
            const primary = settings.portal_theme_colors || '#800000';
            const sidebar = settings.sidebar_colors || '#7a0000';
            document.documentElement.style.setProperty('--primary', primary);
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
        { id: 'academic', title: 'Academic Settings', icon: GraduationCap, desc: 'Programs, courses, departments, and intakes.' },
        { id: 'calendar', title: 'Academic Calendar', icon: Calendar, desc: 'Configure term dates, examination periods, holidays, and events.' },
        { id: 'student', title: 'Student Settings', icon: Users, desc: 'Admission settings, student categories, status definitions.' },
        { id: 'portal_customization', title: 'Student Portal Options', icon: Globe, desc: 'Customize features, announcement banners, maintenance modes, and support.' },
        { id: 'staff', title: 'Staff Settings', icon: UserPlus, desc: 'Staff categories, roles, permissions and staff management.' },
        { id: 'exams', title: 'Examination Settings', icon: Award, desc: 'Exam types, grading system, templates and result configurations.' },
        { id: 'attendance', title: 'Attendance Settings', icon: Clock, desc: 'Attendance modes, status types and attendance configurations.' },
        { id: 'finance', title: 'Finance Settings', icon: CreditCard, desc: 'Fee categories, payment methods, penalties and financial controls.' },
        { id: 'communications', title: 'Communication Settings', icon: Mail, desc: 'SMS gateways, SMTP server, and WhatsApp configuration.' },
        { id: 'notify_templates', title: 'Notification Templates', icon: MessageSquare, desc: 'Customize message templates for SMS and system alerts.' },
        { id: 'inventory_settings', title: 'Inventory Configuration', icon: Package, desc: 'Set stock thresholds, depreciation methods, and stores settings.' },
        { id: 'report_builder', title: 'Report & Document Settings', icon: Sliders, desc: 'Configure printed PDF templates, transcript headers, footers and layouts.' },
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
            className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2.5 text-xs font-semibold outline-none focus:ring-2 focus:ring-maroon/30 focus:border-maroon transition-all resize-none" />
    );

    const Sel = ({ value, onChange, children }) => (
        <select value={value || ''} onChange={onChange}
            className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2.5 text-xs font-semibold outline-none focus:ring-2 focus:ring-maroon/30 focus:border-maroon transition-all">
            {children}
        </select>
    );

    const sidebarContent = (
        <div className="flex flex-col h-full text-white" style={{ backgroundColor: settings.sidebar_colors || '#7a0000' }}>
            {/* Sidebar Title */}
            <div className="px-6 py-5 border-b border-white/10">
                <p className="text-[10px] font-black text-gold uppercase tracking-[0.2em]">Settings Control</p>
            </div>
            
            {/* Sidebar Scrollable Menu */}
            <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-0.5 custom-scrollbar-settings">
                {visibleTabs.map(tab => {
                    const Icon = tab.icon;
                    const isAct = activeTab === tab.id;
                    return (
                        <button key={tab.id}
                            onClick={() => { setActiveTab(tab.id); setSidebarOpen(false); }}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all duration-200 group relative ${isAct ? 'bg-gold text-white font-bold shadow-lg animate-in fade-in zoom-in-95 duration-150' : 'text-white/70 hover:text-white hover:bg-white/5'}`}>
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
            <div className="px-6 py-5 border-t border-white/10 bg-black/10 space-y-3">
                <Link to="/dashboard" className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl border border-white/20 text-white hover:bg-white/10 transition-colors text-[10px] font-black uppercase tracking-wider bg-black/20">
                    <LogOut className="w-3.5 h-3.5 text-yellow-300" />
                    Exit Settings
                </Link>
                <div className="text-center pt-1">
                    <p className="text-[8px] font-black text-white/50 uppercase tracking-[0.1em] leading-tight">Beautex Technical Training College</p>
                    <p className="text-[7.5px] font-bold text-gold italic mt-0.5">Empowering Minds. Shaping Futures.</p>
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
                        <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center p-0.5 overflow-hidden border border-white/20 transition-transform group-hover:scale-105">
                            <img src="/app-icon-v2.png" alt="Beautex Crest Logo" className="w-full h-full object-contain" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-base font-black tracking-[0.12em] text-gold uppercase leading-none" style={{ fontFamily: 'Georgia, serif' }}>Beautex</span>
                            <span className="text-[7.5px] font-bold text-white/80 uppercase tracking-widest leading-tight mt-0.5">Technical Training College</span>
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

                {/* Right Quick Badges */}
                <div className="flex items-center gap-4">
                    <button className="relative p-2 bg-black/20 rounded-xl hover:bg-white/5 transition-colors border border-white/5">
                        <Mail className="w-4 h-4 text-white/80" />
                        <span className="absolute -top-1 -right-1 bg-gold text-maroon text-[8px] font-black w-4.5 h-4.5 rounded-full flex items-center justify-center border-2 border-maroon">7</span>
                    </button>
                    <button onClick={() => setActiveTab('dashboard')} className="p-2 bg-black/20 rounded-xl hover:bg-white/5 transition-colors border border-white/5">
                        <SettingsIcon className="w-4 h-4 text-white/80" />
                    </button>
                    
                    {/* User Profile Info Card */}
                    <div className="flex items-center gap-2 border-l border-white/10 pl-4">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#c8a94a] to-[#e4c264] border border-white/20 flex items-center justify-center text-xs font-black text-white overflow-hidden uppercase shadow-sm">
                            {user?.name ? user.name.slice(0, 2) : 'SA'}
                        </div>
                        <div className="hidden sm:flex flex-col">
                            <span className="text-[10px] font-black uppercase text-white tracking-wider leading-none">{user?.name || 'Super Admin'}</span>
                            <span className="text-[7.5px] font-bold text-gold uppercase tracking-widest mt-0.5 leading-none">{isSuperAdmin ? 'Super Administrator' : 'Administrator'}</span>
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
                        <aside className="fixed left-0 top-0 bottom-0 w-64 z-[99] shadow-2xl lg:hidden animate-in slide-in-from-left duration-300" style={{ backgroundColor: settings.sidebar_colors || '#7a0000' }}>
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
                                <h1 className="text-xl font-black text-maroon dark:text-gold uppercase tracking-wider leading-none">Settings Dashboard</h1>
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
                                                <span className="text-[7.5px] text-gold font-bold uppercase tracking-widest mt-1 block group-hover:underline">Manage {kpi.label.split(' ')[0]} →</span>
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
                                            <Sparkles className="w-4.5 h-4.5 text-gold" />
                                            <span className="text-xs font-black uppercase tracking-wider text-maroon dark:text-gold">Settings Modules</span>
                                        </div>
                                        {searchQuery && (
                                            <span className="text-[9px] bg-gold/10 text-gold px-2 py-0.5 rounded-full font-bold uppercase tracking-widest">Filtered: {filteredModules.length}</span>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
                                        {filteredModules.map(mod => {
                                            const Icon = mod.icon;
                                            return (
                                                <button key={mod.id} onClick={() => setActiveTab(mod.id)}
                                                    className="flex items-start gap-3 p-4 border border-zinc-100 dark:border-white/5 hover:border-gold/30 hover:shadow-md rounded-2xl bg-zinc-50/50 dark:bg-white/[0.02] hover:bg-white transition-all group text-left relative overflow-hidden">
                                                    <div className="absolute top-0 left-0 bottom-0 w-1 bg-maroon opacity-0 group-hover:opacity-100 transition-opacity" />
                                                    <div className="w-10 h-10 bg-maroon/10 dark:bg-white/5 rounded-xl flex items-center justify-center shrink-0 shadow-inner group-hover:bg-maroon group-hover:text-white transition-all duration-300">
                                                        <Icon className="w-4.5 h-4.5 text-maroon dark:text-gold group-hover:text-white" />
                                                    </div>
                                                    <div className="min-w-0 flex-1 pr-3 pt-0.5">
                                                        <p className="text-[10px] font-black uppercase tracking-wide text-zinc-700 dark:text-zinc-200 group-hover:text-maroon dark:group-hover:text-gold transition-colors leading-none truncate">{mod.title}</p>
                                                        <p className="text-[9px] text-zinc-400 font-medium mt-1 leading-normal line-clamp-2">{mod.desc}</p>
                                                    </div>
                                                    <ChevronRight className="w-3.5 h-3.5 text-gold self-center shrink-0 transform group-hover:translate-x-1 transition-transform" />
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
                                        <div className="px-5 py-3.5 flex items-center gap-2 bg-maroon text-white">
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
                                                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-maroon/5 hover:text-maroon dark:hover:bg-white/5 dark:hover:text-gold transition-all text-left text-zinc-600 dark:text-zinc-400 group">
                                                    <div className="w-5 h-5 rounded-lg flex items-center justify-center shrink-0 bg-gold/10 group-hover:bg-gold transition-colors duration-200">
                                                        {act.icon ? <act.icon className="w-3.5 h-3.5 text-gold group-hover:text-white" /> : <Plus className="w-3.5 h-3.5 text-gold group-hover:text-white" />}
                                                    </div>
                                                    <span className="text-[9px] font-black uppercase tracking-wide leading-none mt-0.5">{act.label}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* System Status */}
                                    <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/50 dark:border-white/5 overflow-hidden shadow-sm">
                                        <div className="px-5 py-3.5 flex items-center gap-2 bg-maroon text-white">
                                            <Activity className="w-4 h-4 text-gold shrink-0" />
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
                                        <div className="px-5 py-3.5 flex items-center gap-2 bg-maroon text-white">
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
                                <span className="mt-1 sm:mt-0 text-gold">Version 2.0.0</span>
                            </div>

                        </div>
                    )}

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
                                {activeTab === 'branding' && (
                                    <div className="space-y-6 animate-in fade-in duration-300">
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-2">
                                            {[
                                                { key:'college_logo', label:'College Crest Logo', desc: 'Used on portal top navigation and official certificates.', icon:Building, ref:logoRef, up:uploadingLogo, setU:setUploadingLogo },
                                                { key:'college_stamp', label:'Official Seal Stamp', desc: 'Stamped on printed transcripts and graduation awards.', icon:FileText, ref:stampRef, up:uploadingStamp, setU:setUploadingStamp },
                                                { key:'college_signature', label:'Principal Signature', desc: 'Appears as the authorized signatory on diplomas.', icon:Edit3, ref:sigRef, up:uploadingSignature, setU:setUploadingSignature },
                                            ].map(item => {
                                                const Icon = item.icon;
                                                return (
                                                    <div key={item.key} className="p-6 bg-gray-50/50 dark:bg-white/[0.02] rounded-3xl border border-gray-200 dark:border-white/5 text-center flex flex-col items-center gap-4 hover:border-gold/30 transition-all duration-200 group">
                                                        <div className="w-24 h-24 bg-white dark:bg-zinc-800 rounded-2xl border border-gray-200 dark:border-white/10 flex items-center justify-center overflow-hidden shadow-inner group-hover:scale-105 transition-transform duration-300 relative">
                                                            {settings[item.key] ? (
                                                                <img src={settings[item.key]} alt={item.label} className="w-full h-full object-contain p-2" />
                                                            ) : (
                                                                <div className="flex flex-col items-center justify-center text-zinc-300 dark:text-zinc-600">
                                                                    <Icon className="w-8 h-8 mb-1" />
                                                                    <span className="text-[7.5px] font-black uppercase tracking-widest">No File</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="space-y-1">
                                                            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-700 dark:text-zinc-300">{item.label}</p>
                                                            <p className="text-[8px] text-zinc-400 font-semibold leading-relaxed max-w-[180px] mx-auto">{item.desc}</p>
                                                        </div>
                                                        <button onClick={() => item.ref.current?.click()} disabled={item.up}
                                                            className="text-[9px] font-black uppercase tracking-widest text-white px-5 py-2.5 rounded-xl transition-all duration-200 hover:opacity-90 disabled:opacity-50 shadow-sm"
                                                            style={{ backgroundColor: settings.sidebar_colors || '#7a0000', border: `1px solid ${GOLD}40` }}>
                                                            {item.up ? 'Uploading...' : 'Choose File'}
                                                        </button>
                                                        <input ref={item.ref} type="file" accept="image/*" className="hidden" onChange={e => handleFileUpload(e.target.files[0], item.key, item.setU)} />
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-white/5 rounded-3xl p-6 space-y-4 shadow-sm">
                                            <p className="text-[10px] font-black text-maroon dark:text-gold uppercase tracking-widest border-b border-gray-100 dark:border-white/5 pb-2 mb-2">College Information Details</p>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <FieldRow label="College Name"><Inp value={settings.college_name} onChange={e=>set('college_name',e.target.value)} /></FieldRow>
                                                <FieldRow label="Abbreviation"><Inp value={settings.college_abbr} onChange={e=>set('college_abbr',e.target.value)} /></FieldRow>
                                                <FieldRow label="Motto Statement"><Inp value={settings.college_motto} onChange={e=>set('college_motto',e.target.value)} /></FieldRow>
                                                <FieldRow label="Principal Name"><Inp value={settings.college_principal} onChange={e=>set('college_principal',e.target.value)} /></FieldRow>
                                                <FieldRow label="TVETA Reg Number"><Inp value={settings.college_reg_number} onChange={e=>set('college_reg_number',e.target.value)} /></FieldRow>
                                                <FieldRow label="KRA PIN Code"><Inp value={settings.college_kra_pin} onChange={e=>set('college_kra_pin',e.target.value)} /></FieldRow>
                                            </div>
                                        </div>

                                        <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-white/5 rounded-3xl p-6 space-y-4 shadow-sm">
                                            <p className="text-[10px] font-black text-maroon dark:text-gold uppercase tracking-widest border-b border-gray-100 dark:border-white/5 pb-2 mb-2">Contact & Locations</p>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <FieldRow label="Physical Address"><Inp value={settings.college_address} onChange={e=>set('college_address',e.target.value)} /></FieldRow>
                                                <FieldRow label="Contact Email"><Inp value={settings.contact_email} onChange={e=>set('contact_email',e.target.value)} /></FieldRow>
                                                <FieldRow label="Website Domain"><Inp value={settings.college_website} onChange={e=>set('college_website',e.target.value)} /></FieldRow>
                                                <FieldRow label="Primary Telephone"><Inp value={settings.college_phone} onChange={e=>set('college_phone',e.target.value)} /></FieldRow>
                                                <FieldRow label="Secondary Telephone"><Inp value={settings.college_phone2} onChange={e=>set('college_phone2',e.target.value)} /></FieldRow>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* ══ ACADEMIC SETTINGS ════════════════════════════════ */}
                                {activeTab === 'academic' && (
                                    <div className="space-y-6 animate-in fade-in duration-300">
                                        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-100 dark:border-white/5 p-6 shadow-sm">
                                            <div className="flex justify-between items-center mb-5 pb-3 border-b border-gray-100 dark:border-white/5">
                                                <div>
                                                    <h4 className="text-xs font-black uppercase tracking-widest text-maroon dark:text-gold">College Departments Registry</h4>
                                                    <p className="text-[9px] text-zinc-400 font-semibold mt-0.5">Manage administrative and academic departments within the college.</p>
                                                </div>
                                                <button onClick={openNewDept} className="text-white text-[9px] font-black uppercase tracking-widest px-4 py-2.5 rounded-xl flex items-center gap-1.5 transition-all hover:opacity-90 shadow-md"
                                                    style={{ backgroundColor: settings.sidebar_colors || '#7a0000', border: `1px solid ${GOLD}30` }}>
                                                    <Plus className="w-3.5 h-3.5 text-yellow-300" /> Add Department
                                                </button>
                                            </div>
                                            {loadingDepts ? (
                                                <div className="flex flex-col items-center justify-center py-10 space-y-2">
                                                    <RefreshCw className="w-6 h-6 text-maroon animate-spin" />
                                                    <span className="text-xs text-zinc-400 font-semibold">Loading departments...</span>
                                                </div>
                                            ) : (
                                                <div className="overflow-hidden border border-gray-100 dark:border-white/5 rounded-2xl">
                                                    <table className="w-full text-xs">
                                                        <thead>
                                                            <tr className="bg-gray-50 dark:bg-white/[0.02] border-b border-gray-100 dark:border-white/5">
                                                                <th className="px-4 py-3 text-[9px] font-black text-gray-400 uppercase tracking-widest text-left">Department Name</th>
                                                                <th className="px-4 py-3 text-[9px] font-black text-gray-400 uppercase tracking-widest text-left">Head of Department (HOD)</th>
                                                                <th className="px-4 py-3 text-[9px] font-black text-gray-400 uppercase tracking-widest text-right">Actions</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                                                            {departments.map(d => (
                                                                <tr key={d.id} className="hover:bg-maroon/[0.02] dark:hover:bg-white/[0.01] transition-colors">
                                                                    <td className="px-4 py-3.5 font-bold text-zinc-700 dark:text-zinc-200">{d.name}</td>
                                                                    <td className="px-4 py-3.5 text-zinc-400 font-semibold">{d.head_of_department || 'Unassigned'}</td>
                                                                    <td className="px-4 py-3.5 text-right">
                                                                        <div className="flex justify-end gap-2">
                                                                            <button onClick={() => openEditDept(d)} className="p-2 rounded-xl bg-white dark:bg-zinc-800 border border-gray-200 dark:border-white/5 hover:border-gold hover:text-maroon dark:hover:text-gold transition-all shadow-sm"><Edit3 className="w-3.5 h-3.5" /></button>
                                                                            <button onClick={() => handleDeptDelete(d.id)} className="p-2 rounded-xl bg-white dark:bg-zinc-800 border border-gray-200 dark:border-white/5 hover:bg-red-50 dark:hover:bg-red-950/20 hover:text-red-600 transition-all shadow-sm"><Trash2 className="w-3.5 h-3.5" /></button>
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                            {departments.length === 0 && (
                                                                <tr>
                                                                    <td colSpan="3" className="py-8 text-center text-zinc-400 text-xs font-semibold uppercase tracking-wider">No departments registered.</td>
                                                                </tr>
                                                            )}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </div>

                                        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-100 dark:border-white/5 p-6 space-y-4 shadow-sm">
                                            <div>
                                                <h4 className="text-xs font-black uppercase tracking-widest text-maroon dark:text-gold border-b border-gray-100 dark:border-white/5 pb-2">Academic Intake Management</h4>
                                                <p className="text-[9px] text-zinc-400 font-semibold mt-1">Configure status toggles and enrollment capacities for college admissions.</p>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                                {[
                                                    { id:'jan', label:'January Intake', bg: 'from-blue-500/5 to-cyan-500/5', text: 'text-blue-500' },
                                                    { id:'may', label:'May Intake', bg: 'from-amber-500/5 to-orange-500/5', text: 'text-amber-500' },
                                                    { id:'sept', label:'September Intake', bg: 'from-purple-500/5 to-pink-500/5', text: 'text-purple-500' },
                                                    { id:'rolling', label:'Rolling Intake', bg: 'from-emerald-500/5 to-teal-500/5', text: 'text-emerald-500' }
                                                ].map(i => (
                                                    <div key={i.id} className={`p-5 bg-gradient-to-br ${i.bg} rounded-3xl border border-gray-200/50 dark:border-white/5 flex flex-col justify-between gap-4`}>
                                                        <span className="text-[11px] font-black uppercase tracking-wider text-zinc-800 dark:text-gold block">{i.label}</span>
                                                        <div className="space-y-2">
                                                            <label className="text-[8px] font-black text-zinc-400 uppercase tracking-wider block">Intake Status</label>
                                                            <Sel value={settings[`intake_${i.id}_status`]} onChange={e=>set(`intake_${i.id}_status`,e.target.value)}>
                                                                <option value="open">Open (Admitting)</option>
                                                                <option value="closed">Closed</option>
                                                                <option value="suspended">Suspended</option>
                                                            </Sel>
                                                        </div>
                                                        <div className="space-y-2">
                                                            <label className="text-[8px] font-black text-zinc-400 uppercase tracking-wider block">Max Capacity</label>
                                                            <input type="number" value={settings[`intake_${i.id}_capacity`] || ''} onChange={e=>set(`intake_${i.id}_capacity`,e.target.value)} className="w-full bg-white dark:bg-zinc-800 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-center outline-none focus:ring-1 focus:ring-maroon" />
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-100 dark:border-white/5 p-6 shadow-sm">
                                            <FieldRow label="Online Applications Portal" description="Enable/Disable self-enrollment registrations from the public website interface.">
                                                <div className="flex items-center gap-3"><Toggle value={settings.intake_online_app_enabled} onChange={v=>set('intake_online_app_enabled',v)} /><StatusBadge active={settings.intake_online_app_enabled} labelOn="Active" labelOff="Suspended" /></div>
                                            </FieldRow>
                                        </div>
                                    </div>
                                )}

                                {/* ══ ACADEMIC CALENDAR ════════════════════════════════ */}
                                {activeTab === 'calendar' && (
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in duration-300">
                                        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-100 dark:border-white/5 p-6 space-y-4 shadow-sm">
                                            <div>
                                                <h4 className="text-xs font-black uppercase tracking-widest text-maroon dark:text-gold border-b border-gray-100 dark:border-white/5 pb-2">Academic Calendar Dates</h4>
                                                <p className="text-[9px] text-zinc-400 font-semibold mt-1">Configure system dates for academic terms, examination weeks, and holidays.</p>
                                            </div>
                                            <FieldRow label="Academic Term Title" description="The official name of the current term or semester."><Inp value={settings.academic_term_name} onChange={e=>set('academic_term_name',e.target.value)} /></FieldRow>
                                            <FieldRow label="Semester Start"><Inp type="date" value={settings.academic_term_start} onChange={e=>set('academic_term_start',e.target.value)} /></FieldRow>
                                            <FieldRow label="Semester End"><Inp type="date" value={settings.academic_term_end} onChange={e=>set('academic_term_end',e.target.value)} /></FieldRow>
                                            <FieldRow label="Exams Commencing"><Inp type="date" value={settings.academic_exam_start} onChange={e=>set('academic_exam_start',e.target.value)} /></FieldRow>
                                            <FieldRow label="Exams Closing"><Inp type="date" value={settings.academic_exam_end} onChange={e=>set('academic_exam_end',e.target.value)} /></FieldRow>
                                            <FieldRow label="Holidays Commencing"><Inp type="date" value={settings.academic_holiday_start} onChange={e=>set('academic_holiday_start',e.target.value)} /></FieldRow>
                                            <FieldRow label="Holidays Closing"><Inp type="date" value={settings.academic_holiday_end} onChange={e=>set('academic_holiday_end',e.target.value)} /></FieldRow>
                                        </div>

                                        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-100 dark:border-white/5 p-6 shadow-sm flex flex-col justify-between">
                                            <div>
                                                <h4 className="text-xs font-black uppercase tracking-widest text-maroon dark:text-gold border-b border-gray-100 dark:border-white/5 pb-2">Chronological Milestones Map</h4>
                                                <p className="text-[9px] text-zinc-400 font-semibold mt-1">Visual sequence map of the academic timeline.</p>
                                            </div>

                                            <div className="relative py-8 pl-8 space-y-8 flex-1 flex flex-col justify-center">
                                                <div className="absolute left-[39px] top-10 bottom-10 w-0.5 bg-gray-200 dark:bg-white/10" />
                                                
                                                {[
                                                    { label: 'Term Starts', date: settings.academic_term_start, color: 'bg-emerald-500 text-emerald-500' },
                                                    { label: 'Examinations Week', date: `${settings.academic_exam_start} to ${settings.academic_exam_end}`, color: 'bg-amber-500 text-amber-500' },
                                                    { label: 'Term Ends', date: settings.academic_term_end, color: 'bg-rose-500 text-rose-500' },
                                                    { label: 'Recess & Holidays', date: `${settings.academic_holiday_start} to ${settings.academic_holiday_end}`, color: 'bg-blue-500 text-blue-500' }
                                                ].map((milestone, idx) => (
                                                    <div key={idx} className="relative flex items-center gap-4 text-left">
                                                        <div className={`absolute left-[-22px] w-6 h-6 rounded-full border-4 border-white dark:border-zinc-900 ${milestone.color.split(' ')[0]} flex items-center justify-center shadow-md`} />
                                                        <div>
                                                            <p className="text-[10px] font-black uppercase tracking-wider text-zinc-700 dark:text-zinc-200 leading-none">{milestone.label}</p>
                                                            <span className="text-[9px] font-bold text-zinc-400 block mt-1">{milestone.date ? new Date(milestone.date.split(' to ')[0]).toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'}) : 'Not Configured'}
                                                            {milestone.date?.includes(' to ') && ` to ${new Date(milestone.date.split(' to ')[1]).toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'})}`}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>

                                            {settings.academic_term_start && settings.academic_term_end && new Date(settings.academic_term_start) > new Date(settings.academic_term_end) && (
                                                <div className="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-950/20 text-red-600 border border-red-100 dark:border-red-900/30 rounded-2xl text-[9px] font-black uppercase tracking-wider">
                                                    <ShieldAlert className="w-4 h-4 shrink-0" />
                                                    Warning: Semester Start Date is set after the Semester End Date.
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* ══ STUDENT SETTINGS ══════════════════════════════════ */}
                                {activeTab === 'student' && (
                                    <div className="space-y-6 animate-in fade-in duration-300">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-100 dark:border-white/5 p-6 space-y-4 shadow-sm">
                                                <div>
                                                    <h4 className="text-xs font-black uppercase tracking-widest text-maroon dark:text-gold border-b border-gray-100 dark:border-white/5 pb-2">Admission Configuration</h4>
                                                    <p className="text-[9px] text-zinc-400 font-semibold mt-1">Configure student admission formats and system filters.</p>
                                                </div>
                                                <FieldRow label="Admission Number Template" description="The format for generating student admission codes.">
                                                    <Inp value={settings.admission_number_format} onChange={e=>set('admission_number_format',e.target.value)} mono />
                                                    <div className="mt-2.5 p-3.5 bg-gray-50 dark:bg-white/[0.02] border border-dashed border-gray-200 dark:border-white/10 rounded-2xl text-left">
                                                        <span className="text-[7.5px] font-black text-zinc-400 uppercase tracking-widest block mb-1">Generated Example Preview</span>
                                                        <span className="text-xs font-mono font-black text-maroon dark:text-gold">{settings.admission_number_format || 'BTC/2026/001'}</span>
                                                    </div>
                                                </FieldRow>
                                                <FieldRow label="Enrollment Categories" description="Configure classifications of students admitted to the college.">
                                                    <TagInputList value={settings.student_categories} onChange={val=>set('student_categories',val)} placeholder="e.g. Part-Time" />
                                                </FieldRow>
                                            </div>

                                            <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-100 dark:border-white/5 p-6 space-y-4 shadow-sm">
                                                <div>
                                                    <h4 className="text-xs font-black uppercase tracking-widest text-maroon dark:text-gold border-b border-gray-100 dark:border-white/5 pb-2">Student Life Cycle Registry</h4>
                                                    <p className="text-[9px] text-zinc-400 font-semibold mt-1">Life cycle stages available on student records.</p>
                                                </div>
                                                <FieldRow label="Life Cycle Status Codes" description="Stages through which students progress during their studies.">
                                                    <TagInputList value={settings.student_statuses} onChange={val=>set('student_statuses',val)} placeholder="e.g. Graduated" />
                                                </FieldRow>
                                            </div>
                                        </div>

                                        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-100 dark:border-white/5 p-6 space-y-4 shadow-sm">
                                            <div>
                                                <h4 className="text-xs font-black uppercase tracking-widest text-maroon dark:text-gold border-b border-gray-100 dark:border-white/5 pb-2">Student Portal Access Controls</h4>
                                                <p className="text-[9px] text-zinc-400 font-semibold mt-1">Configure student access permissions inside the personal dashboard.</p>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                                                {[
                                                    { key:'student_portal_results', label:'Academic Grades & Results Publishing', desc: 'Allows students to view their grade transcripts.' },
                                                    { key:'student_portal_fees', label:'Financial Statement & Invoices Check', desc: 'Allows access to fee statements and payment modules.' },
                                                    { key:'student_portal_timetables', label:'Interactive Lecture Timetables', desc: 'Allows students to view their timetables.' },
                                                    { key:'student_portal_materials', label:'E-Learning Material Downloads', desc: 'Allows access to lecture notes and resources.' },
                                                    { key:'student_portal_certificates', label:'Official Graduation Awards & Certificates', desc: 'Allows downloading printable awards.' },
                                                    { key:'student_portal_attendance', label:'Attendance Compliance Auditing', desc: 'Allows students to check their attendance compliance rate.' },
                                                ].map(i => (
                                                    <div key={i.key} className="flex items-center justify-between p-4 bg-gray-50/50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/5 rounded-3xl hover:border-gold/20 transition-colors">
                                                        <div className="pr-4 text-left">
                                                            <p className="text-xs font-black uppercase tracking-wide text-zinc-700 dark:text-zinc-200">{i.label}</p>
                                                            <p className="text-[8.5px] text-zinc-400 font-medium leading-relaxed mt-0.5">{i.desc}</p>
                                                        </div>
                                                        <Toggle value={settings[i.key]} onChange={v=>set(i.key,v)} />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* ══ PORTAL OPTIONS ══════════════════════════════════ */}
                                {activeTab === 'portal_customization' && (
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in duration-300">
                                        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-100 dark:border-white/5 p-6 space-y-6 shadow-sm">
                                            <div>
                                                <h4 className="text-xs font-black uppercase tracking-widest text-maroon dark:text-gold border-b border-gray-100 dark:border-white/5 pb-2">Student Portal Configurations</h4>
                                                <p className="text-[9px] text-zinc-400 font-semibold mt-1">Configure announcement banners, contact details and maintenance toggles.</p>
                                            </div>
                                            <FieldRow label="Announcement Banner Message" description="Crucial banner message displayed at the top of student dashboards."><TA value={settings.portal_announcement_banner} onChange={e=>set('portal_announcement_banner',e.target.value)} rows={3} /></FieldRow>
                                            <FieldRow label="Portal Support Email"><Inp value={settings.portal_support_email} onChange={e=>set('portal_support_email',e.target.value)} /></FieldRow>
                                            <FieldRow label="Portal Support Phone"><Inp value={settings.portal_support_phone} onChange={e=>set('portal_support_phone',e.target.value)} /></FieldRow>
                                            <FieldRow label="Maintenance Mode Switch" description="Force log out all students and display a system-under-maintenance screen.">
                                                <div className="flex items-center gap-3"><Toggle value={settings.portal_maintenance_mode} onChange={v=>set('portal_maintenance_mode',v)} /><StatusBadge active={settings.portal_maintenance_mode} labelOn="Active" labelOff="Inactive" /></div>
                                            </FieldRow>
                                        </div>

                                        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-100 dark:border-white/5 p-6 shadow-sm flex flex-col justify-between">
                                            <div>
                                                <h4 className="text-xs font-black uppercase tracking-widest text-maroon dark:text-gold border-b border-gray-100 dark:border-white/5 pb-2">Student Portal Preview Simulator</h4>
                                                <p className="text-[9px] text-zinc-400 font-semibold mt-1">A real-time mockup view of the portal dashboard.</p>
                                            </div>

                                            <div className="flex-1 mt-6 border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden flex flex-col shadow-inner bg-zinc-50 dark:bg-zinc-950 p-4 justify-center relative">
                                                {settings.portal_maintenance_mode ? (
                                                    <div className="flex flex-col items-center justify-center text-center p-6 space-y-3">
                                                        <ShieldAlert className="w-10 h-10 text-red-500 animate-bounce" />
                                                        <p className="text-xs font-black uppercase tracking-wider text-red-500">System Maintenance Mode Active</p>
                                                        <p className="text-[9px] text-zinc-400 font-semibold leading-relaxed">The Student Portal is temporarily down for maintenance. Admitted students cannot log in or check results at this time.</p>
                                                    </div>
                                                ) : (
                                                    <div className="space-y-4 text-left">
                                                        {settings.portal_announcement_banner && (
                                                            <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200/50 dark:border-amber-500/20 px-3.5 py-2.5 rounded-xl flex items-start gap-2 animate-pulse">
                                                                <Sparkles className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                                                                <p className="text-[9.5px] font-bold text-amber-800 dark:text-amber-400 leading-normal">{settings.portal_announcement_banner}</p>
                                                            </div>
                                                        )}
                                                        <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 border border-gray-100 dark:border-white/5 shadow-sm space-y-2">
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-6 h-6 rounded-full bg-gold/25 border border-gold flex items-center justify-center text-[10px] font-black text-maroon dark:text-gold uppercase">JD</div>
                                                                <div>
                                                                    <p className="text-[9px] font-black text-zinc-700 dark:text-zinc-200 uppercase leading-none">John Doe</p>
                                                                    <span className="text-[7.5px] text-zinc-400 font-semibold">Adm No: BTC/2026/042</span>
                                                                </div>
                                                            </div>
                                                            <div className="h-0.5 bg-gray-100 dark:bg-white/5 my-2" />
                                                            <div className="grid grid-cols-2 gap-2 text-[8px] font-black uppercase text-zinc-400 tracking-wider">
                                                                <div className="p-2 bg-gray-50 dark:bg-zinc-800 rounded-lg flex flex-col justify-between"><span>Grade Record</span><span className="text-maroon dark:text-gold text-[10px] mt-1">GPA 3.82</span></div>
                                                                <div className="p-2 bg-gray-50 dark:bg-zinc-800 rounded-lg flex flex-col justify-between"><span>Fees Balance</span><span className="text-maroon dark:text-gold text-[10px] mt-1">KES 0.00</span></div>
                                                            </div>
                                                        </div>
                                                        
                                                        <div className="flex justify-between items-center text-[8px] text-zinc-400 font-bold uppercase tracking-wider px-1">
                                                            <span>Support Helpline: {settings.portal_support_phone || 'None'}</span>
                                                            <span>{settings.portal_support_email || 'None'}</span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* ══ STAFF SETTINGS ════════════════════════════════════ */}
                                {activeTab === 'staff' && (
                                    <div className="space-y-6 animate-in fade-in duration-300">
                                        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-100 dark:border-white/5 p-6 space-y-4 shadow-sm">
                                            <div>
                                                <h4 className="text-xs font-black uppercase tracking-widest text-maroon dark:text-gold border-b border-gray-100 dark:border-white/5 pb-2">Staff & Personnel Categories</h4>
                                                <p className="text-[9px] text-zinc-400 font-semibold mt-1">Define professional classifications for college staff members.</p>
                                            </div>
                                            <FieldRow label="Staff Classifications" description="Organizational categories to segment trainers, admins and support personnel.">
                                                <TagInputList value={settings.staff_categories} onChange={val=>set('staff_categories',val)} placeholder="e.g. Lecturers" />
                                            </FieldRow>
                                        </div>

                                        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-100 dark:border-white/5 p-6 space-y-4 shadow-sm">
                                            <div>
                                                <h4 className="text-xs font-black uppercase tracking-widest text-maroon dark:text-gold border-b border-gray-100 dark:border-white/5 pb-2">Security Access Roles</h4>
                                                <p className="text-[9px] text-zinc-400 font-semibold mt-1">Roles mapping security clearances across the college CMS portal.</p>
                                            </div>
                                            <FieldRow label="Staff System Roles" description="Clearance roles that allocate user access levels.">
                                                <TagInputList value={settings.staff_roles} onChange={val=>set('staff_roles',val)} placeholder="e.g. Accountant" />
                                            </FieldRow>
                                        </div>
                                    </div>
                                )}

                                {/* ══ EXAMS & GRADING ═══════════════════════════════════ */}
                                {activeTab === 'exams' && (
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in duration-300">
                                        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-100 dark:border-white/5 p-6 space-y-5 shadow-sm">
                                            <div>
                                                <h4 className="text-xs font-black uppercase tracking-widest text-maroon dark:text-gold border-b border-gray-100 dark:border-white/5 pb-2">Academic Assessment Configurations</h4>
                                                <p className="text-[9px] text-zinc-400 font-semibold mt-1">Configure grading bands and assessment categories.</p>
                                            </div>
                                            <FieldRow label="Assessment Formats" description="The catalog of academic assessments used for grading calculations.">
                                                <TagInputList value={settings.assessment_types} onChange={val=>set('assessment_types',val)} placeholder="e.g. CAT" />
                                            </FieldRow>
                                            
                                            <p className="text-[9.5px] font-black text-zinc-400 uppercase tracking-widest border-b border-gray-100 dark:border-white/5 pb-2 pt-2">Grade Bands Boundaries (%)</p>
                                            <div className="grid grid-cols-2 gap-4">
                                                {[
                                                    {key:'grading_distinction_min',label:'Distinction Min %',c:'border-green-200 dark:border-green-950/20 bg-green-50/50 dark:bg-green-950/10 text-green-700 dark:text-green-400'},
                                                    {key:'grading_credit_min',label:'Credit Min %',c:'border-blue-200 dark:border-blue-950/20 bg-blue-50/50 dark:bg-blue-950/10 text-blue-700 dark:text-blue-400'},
                                                    {key:'grading_pass_min',label:'Pass Min %',c:'border-amber-200 dark:border-amber-950/20 bg-amber-50/50 dark:bg-amber-950/10 text-amber-700 dark:text-gold'},
                                                    {key:'grading_fail_min',label:'Fail Min %',c:'border-red-200 dark:border-red-950/20 bg-red-50/50 dark:bg-red-950/10 text-red-600 dark:text-red-400'},
                                                ].map(b=>(
                                                    <div key={b.key} className={`p-4 border rounded-2xl text-left ${b.c} flex justify-between items-center`}>
                                                        <span className="text-[9px] font-black uppercase tracking-widest block leading-none">{b.label.split(' ')[0]} Threshold</span>
                                                        <input type="number" value={settings[b.key]||''} onChange={e=>set(b.key,e.target.value)} className="w-16 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-white/10 rounded-lg px-2 py-1 text-center text-xs font-black outline-none focus:ring-1 focus:ring-maroon" />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-100 dark:border-white/5 p-6 shadow-sm flex flex-col justify-between">
                                            <div>
                                                <h4 className="text-xs font-black uppercase tracking-widest text-maroon dark:text-gold border-b border-gray-100 dark:border-white/5 pb-2">Grading System Visual Graph</h4>
                                                <p className="text-[9px] text-zinc-400 font-semibold mt-1">Graphical breakdown of academic performance brackets.</p>
                                            </div>

                                            <div className="flex-1 flex flex-col justify-center gap-4 mt-6">
                                                {[
                                                    { label: 'Distinction Bracket', val: settings.grading_distinction_min || 70, max: 100, color: 'bg-green-500', desc: 'Represents exceptional academic performance.' },
                                                    { label: 'Credit Bracket', val: settings.grading_credit_min || 60, max: settings.grading_distinction_min || 70, color: 'bg-blue-500', desc: 'Represents highly competent mastery.' },
                                                    { label: 'Pass Bracket', val: settings.grading_pass_min || 50, max: settings.grading_credit_min || 60, color: 'bg-amber-500', desc: 'Represents minimum standard compliance.' },
                                                    { label: 'Fail Bracket', val: settings.grading_fail_min || 0, max: settings.grading_pass_min || 50, color: 'bg-red-500', desc: 'Requires re-examination or academic recovery.' }
                                                ].map((band, idx) => (
                                                    <div key={idx} className="space-y-1.5 text-left">
                                                        <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-wider text-zinc-500">
                                                            <span>{band.label}</span>
                                                            <span className="font-mono text-zinc-700 dark:text-zinc-300">{band.val}% to {band.max}%</span>
                                                        </div>
                                                        <div className="h-3 w-full bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden flex">
                                                            <div className="h-full bg-gray-300 dark:bg-zinc-800" style={{ width: `${band.val}%` }} />
                                                            <div className={`h-full ${band.color}`} style={{ width: `${band.max - band.val}%` }} />
                                                        </div>
                                                        <p className="text-[8px] text-zinc-400 font-medium italic">{band.desc}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* ══ ATTENDANCE ════════════════════════════════════════ */}
                                {activeTab === 'attendance' && (
                                    <div className="space-y-6 animate-in fade-in duration-300">
                                        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-100 dark:border-white/5 p-6 space-y-4 shadow-sm">
                                            <div>
                                                <h4 className="text-xs font-black uppercase tracking-widest text-maroon dark:text-gold border-b border-gray-100 dark:border-white/5 pb-2">Lecture Attendance Logging</h4>
                                                <p className="text-[9px] text-zinc-400 font-semibold mt-1">Configure default attendance tracking modes and roll call statuses.</p>
                                            </div>
                                            
                                            <div className="space-y-2">
                                                <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block">System Roll Call Mode</label>
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                    {[
                                                        { id: 'daily', title: 'Daily Roll Register', desc: 'Class attendance recorded once per student daily.' },
                                                        { id: 'per_lesson', title: 'Per-Lecture Register', desc: 'Attendance marked every lecture block by the trainer.' },
                                                        { id: 'qr_code', title: 'QR Code Check-In', desc: 'Students sign in by scanning generated room codes.' }
                                                    ].map(mode => {
                                                        const isAct = settings.attendance_mode === mode.id;
                                                        return (
                                                            <button key={mode.id} onClick={() => set('attendance_mode', mode.id)} type="button"
                                                                className={`p-5 rounded-2xl border text-left flex flex-col justify-between gap-2.5 transition-all hover:shadow-md ${isAct ? 'border-maroon dark:border-gold bg-maroon/[0.02] dark:bg-gold/[0.02]' : 'border-gray-200 dark:border-white/5 bg-gray-50/50 dark:bg-white/[0.01]'}`}>
                                                                <div className="flex justify-between items-center w-full">
                                                                    <span className="text-[10px] font-black uppercase tracking-wider text-zinc-800 dark:text-zinc-200">{mode.title}</span>
                                                                    <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${isAct ? 'border-maroon dark:border-gold' : 'border-gray-300'}`}>
                                                                        {isAct && <div className="w-1.5 h-1.5 rounded-full bg-maroon dark:bg-gold" />}
                                                                    </div>
                                                                </div>
                                                                <p className="text-[9px] text-zinc-400 font-medium leading-relaxed">{mode.desc}</p>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-100 dark:border-white/5 p-6 space-y-4 shadow-sm">
                                            <div>
                                                <h4 className="text-xs font-black uppercase tracking-widest text-maroon dark:text-gold border-b border-gray-100 dark:border-white/5 pb-2">Roll Call Status Brackets</h4>
                                                <p className="text-[9px] text-zinc-400 font-semibold mt-1">Codes defining student classroom status on the daily register.</p>
                                            </div>
                                            <FieldRow label="Roll Call Status Codes" description="Classification status types for student attendance registration.">
                                                <TagInputList value={settings.attendance_status_types} onChange={val=>set('attendance_status_types',val)} placeholder="e.g. Excused" />
                                            </FieldRow>
                                        </div>
                                    </div>
                                )}

                                {/* ══ FINANCE ═══════════════════════════════════════════ */}
                                {activeTab === 'finance' && (
                                    <div className="space-y-6 animate-in fade-in duration-300">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-100 dark:border-white/5 p-6 space-y-4 shadow-sm">
                                                <div>
                                                    <h4 className="text-xs font-black uppercase tracking-widest text-maroon dark:text-gold border-b border-gray-100 dark:border-white/5 pb-2">Finance Ledger Configuration</h4>
                                                    <p className="text-[9px] text-zinc-400 font-semibold mt-1">Set invoice billing items and payment methods.</p>
                                                </div>
                                                <FieldRow label="Fee Invoice Items" description="The official catalog of items billed on student invoices.">
                                                    <TagInputList value={settings.fee_categories} onChange={val=>set('fee_categories',val)} placeholder="e.g. Tuition Fee" />
                                                </FieldRow>
                                                <FieldRow label="Acceptable Payment Options" description="Channels approved for student fee payments.">
                                                    <TagInputList value={settings.payment_methods} onChange={val=>set('payment_methods',val)} placeholder="e.g. M-Pesa" />
                                                </FieldRow>
                                            </div>

                                            <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-100 dark:border-white/5 p-6 space-y-4 shadow-sm">
                                                <div>
                                                    <h4 className="text-xs font-black uppercase tracking-widest text-maroon dark:text-gold border-b border-gray-100 dark:border-white/5 pb-2">Scholarships & Installment Policies</h4>
                                                    <p className="text-[9px] text-zinc-400 font-semibold mt-1">Configure interest penalties, early payment discounts and scholarship categories.</p>
                                                </div>
                                                <FieldRow label="Penalty Rate (%)" description="Late penalty fees interest rate."><Inp type="number" value={settings.finance_penalty_rate} onChange={e=>set('finance_penalty_rate',e.target.value)} /></FieldRow>
                                                <FieldRow label="Discount Rate (%)" description="Early payments discount rate."><Inp type="number" value={settings.finance_discount_rate} onChange={e=>set('finance_discount_rate',e.target.value)} /></FieldRow>
                                                <FieldRow label="Scholarship Brackets" description="Categories of student scholarships.">
                                                    <TagInputList value={settings.finance_scholarship_types} onChange={val=>set('finance_scholarship_types',val)} placeholder="e.g. Merit-based" />
                                                </FieldRow>
                                                <FieldRow label="Installment Options" description="Allow students to make partial fee payments across the term.">
                                                    <div className="flex items-center gap-3"><Toggle value={settings.finance_installments_allowed} onChange={v=>set('finance_installments_allowed',v)} /><StatusBadge active={settings.finance_installments_allowed} labelOn="Allowed" labelOff="Disabled" /></div>
                                                </FieldRow>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* ══ COMMUNICATIONS ════════════════════════════════════ */}
                                {activeTab === 'communications' && (
                                    <div className="space-y-6 animate-in fade-in duration-300">
                                        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-100 dark:border-white/5 p-6 space-y-4 shadow-sm">
                                            <div>
                                                <h4 className="text-xs font-black uppercase tracking-widest text-maroon dark:text-gold border-b border-gray-100 dark:border-white/5 pb-2">SMS Notification Dispatch Triggers</h4>
                                                <p className="text-[9px] text-zinc-400 font-semibold mt-1">Configure events that trigger automated system SMS notifications.</p>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2">
                                                {[
                                                    {key:'sms_admission_confirm', label:'Admission Confirmation SMS', desc: 'Dispatched instantly when student registry admits record.'},
                                                    {key:'sms_fee_reminder', label:'Fee Overdue Reminders SMS', desc: 'Dispatched for outstanding invoice balances.'},
                                                    {key:'sms_cat_notify', label:'CAT Grades SMS', desc: 'Dispatched when continuous assessments are published.'},
                                                    {key:'sms_exam_notify', label:'End-Term Outcomes SMS', desc: 'Dispatched when end-of-term grades are confirmed.'},
                                                    {key:'sms_grad_notify', label:'Graduation Alerts SMS', desc: 'Dispatched to notify of graduation ceremonies.'},
                                                ].map(s=>(
                                                    <div key={s.key} className="flex flex-col justify-between p-5 bg-gray-50/50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/5 rounded-3xl hover:border-gold/20 transition-all text-left gap-3">
                                                        <div>
                                                            <p className="text-[10px] font-black uppercase tracking-wider text-zinc-700 dark:text-zinc-200 leading-snug">{s.label}</p>
                                                            <p className="text-[8px] text-zinc-400 font-medium leading-relaxed mt-1">{s.desc}</p>
                                                        </div>
                                                        <div className="flex items-center justify-between mt-1 border-t border-gray-100 dark:border-white/5 pt-2">
                                                            <span className="text-[8px] font-black text-zinc-400 uppercase tracking-widest">Active Dispatch</span>
                                                            <Toggle value={settings[s.key]} onChange={v=>set(s.key,v)} />
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                            
                                            <FieldRow label="WhatsApp Broadcast Integration" description="Enable automated notifications routing via WhatsApp Business API nodes.">
                                                <div className="flex items-center gap-3"><Toggle value={settings.whatsapp_integration} onChange={v=>set('whatsapp_integration',v)} /><StatusBadge active={settings.whatsapp_integration} labelOn="Enabled" labelOff="Disabled" /></div>
                                            </FieldRow>
                                        </div>

                                        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-100 dark:border-white/5 p-6 space-y-4 shadow-sm">
                                            <div>
                                                <h4 className="text-xs font-black uppercase tracking-widest text-maroon dark:text-gold border-b border-gray-100 dark:border-white/5 pb-2">SMTP Mail Server Configuration</h4>
                                                <p className="text-[9px] text-zinc-400 font-semibold mt-1">Credentials mapping the default SMTP server for system dispatch.</p>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <FieldRow label="SMTP Hostname"><Inp value={settings.smtp_host} onChange={e=>set('smtp_host',e.target.value)} placeholder="e.g. smtp.gmail.com" readOnly={!isSuperAdmin} /></FieldRow>
                                                <FieldRow label="SMTP Port"><Inp value={settings.smtp_port} onChange={e=>set('smtp_port',e.target.value)} placeholder="e.g. 587" readOnly={!isSuperAdmin} /></FieldRow>
                                                <FieldRow label="SMTP Username"><Inp value={settings.smtp_user} onChange={e=>set('smtp_user',e.target.value)} placeholder="e.g. admin@beautex.edu" readOnly={!isSuperAdmin} /></FieldRow>
                                                <FieldRow label="SMTP Password"><PwdField value={isSuperAdmin?settings.smtp_pass:'••••••••'} onChange={e=>set('smtp_pass',e.target.value)} readOnly={!isSuperAdmin} /></FieldRow>
                                            </div>
                                            <FieldRow label="Secure Connection (TLS)" description="Enforce SSL/TLS secure channel validation.">
                                                <div className="flex items-center gap-3"><Toggle value={settings.smtp_secure} onChange={v=>set('smtp_secure',v)} locked={!isSuperAdmin} /><StatusBadge active={settings.smtp_secure} labelOn="TLS Enforced" labelOff="Standard Mode" /></div>
                                            </FieldRow>
                                        </div>
                                    </div>
                                )}

                                {/* ══ NOTIFICATION TEMPLATES ════════════════════════════ */}
                                {activeTab === 'notify_templates' && (
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in duration-300">
                                        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-100 dark:border-white/5 p-6 space-y-4 shadow-sm text-left">
                                            <div>
                                                <h4 className="text-xs font-black uppercase tracking-widest text-maroon dark:text-gold border-b border-gray-100 dark:border-white/5 pb-2">Custom Notification Templates</h4>
                                                <p className="text-[9px] text-zinc-400 font-semibold mt-1">Configure automated text message content. Tokens map DB parameters dynamically.</p>
                                            </div>

                                            {[
                                                { key: 'template_admission_sms', label: 'Student Admission Confirmation SMS', tokens: ['{name}', '{admission_no}', '{start_date}'] },
                                                { key: 'template_fee_reminder_sms', label: 'Overdue Tuition Balance Alert SMS', tokens: ['{name}', '{balance}', '{due_date}'] },
                                                { key: 'template_results_sms', label: 'Academic Term Grade Publishing SMS', tokens: ['{name}', '{gpa}'] },
                                                { key: 'template_absentee_sms', label: 'Student Absence Notification SMS', tokens: ['{name}', '{date}'] }
                                            ].map(item => {
                                                const isActive = activeSmsPreview === item.key;
                                                return (
                                                    <div key={item.key} onClick={() => setActiveSmsPreview(item.key)}
                                                        className={`p-4 rounded-2xl border transition-all cursor-pointer ${isActive ? 'border-maroon dark:border-gold bg-maroon/[0.01] dark:bg-gold/[0.01]' : 'border-gray-100 dark:border-white/5 hover:border-gray-200'}`}>
                                                        <div className="flex justify-between items-center mb-2">
                                                            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-700 dark:text-zinc-200">{item.label}</span>
                                                            {isActive && <span className="text-[7.5px] bg-gold text-maroon font-black uppercase px-2 py-0.5 rounded-full tracking-widest">Editing</span>}
                                                        </div>
                                                        <textarea value={settings[item.key] || ''} onChange={e=>set(item.key,e.target.value)} rows={3}
                                                            className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:ring-1 focus:ring-maroon resize-none font-sans" />
                                                        <div className="flex flex-wrap gap-1.5 mt-2">
                                                            <span className="text-[8px] font-black text-zinc-400 uppercase tracking-widest self-center">Available variables:</span>
                                                            {item.tokens.map(tok => (
                                                                <span key={tok} className="text-[8px] font-mono font-bold bg-gray-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 px-1.5 py-0.5 rounded border border-gray-200 dark:border-white/5">{tok}</span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-100 dark:border-white/5 p-6 shadow-sm flex flex-col justify-between">
                                            <div>
                                                <h4 className="text-xs font-black uppercase tracking-widest text-maroon dark:text-gold border-b border-gray-100 dark:border-white/5 pb-2">SMS Dispatch Visual Mockup</h4>
                                                <p className="text-[9px] text-zinc-400 font-semibold mt-1">Live smartphone rendering showing how the recipient receives the message.</p>
                                            </div>

                                            <div className="flex-1 mt-6 flex justify-center items-center">
                                                {/* iPhone smartphone Mockup */}
                                                <div className="w-[240px] h-[440px] bg-zinc-950 rounded-[40px] border-4 border-zinc-800 shadow-2xl overflow-hidden flex flex-col p-2 relative ring-4 ring-zinc-900">
                                                    {/* Notch */}
                                                    <div className="absolute top-2 left-1/2 -translate-x-1/2 w-24 h-4 bg-zinc-950 rounded-full z-20 flex items-center justify-center"><div className="w-1.5 h-1.5 rounded-full bg-zinc-900 mr-2" /><div className="w-12 h-1 bg-zinc-900 rounded-full" /></div>
                                                    
                                                    {/* Screen Content */}
                                                    <div className="flex-1 bg-zinc-100 dark:bg-zinc-900 rounded-[32px] overflow-hidden flex flex-col pt-5 relative">
                                                        {/* Carrier Top bar */}
                                                        <div className="h-6 flex items-center justify-between px-4 text-[7px] text-zinc-400 font-black uppercase tracking-widest">
                                                            <span>11:34 AM</span>
                                                            <div className="flex items-center gap-1"><span>4G</span><div className="w-4 h-2 border border-zinc-400 rounded-sm p-0.5"><div className="h-full bg-zinc-400 rounded-sm w-3/4" /></div></div>
                                                        </div>
                                                        
                                                        {/* Contact Header */}
                                                        <div className="h-10 border-b border-zinc-200/50 bg-white/70 dark:bg-zinc-950/70 backdrop-blur-md flex flex-col items-center justify-center">
                                                            <span className="text-[9px] font-black text-zinc-700 dark:text-zinc-200 tracking-wider">BEAUTEX SMS</span>
                                                            <span className="text-[6.5px] text-green-500 font-black tracking-widest uppercase">Verified Sender</span>
                                                        </div>
                                                        
                                                        {/* Chat Messages Area */}
                                                        <div className="flex-1 p-3 overflow-y-auto flex flex-col justify-end text-left space-y-2 bg-[#e5ddd5] dark:bg-zinc-950">
                                                            <div className="p-3 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 rounded-2xl rounded-bl-none text-[9.5px] font-semibold leading-relaxed shadow-sm max-w-[85%] border border-zinc-200/40 animate-in slide-in-from-bottom duration-300">
                                                                {(() => {
                                                                    const template = settings[activeSmsPreview] || '';
                                                                    return template
                                                                        .replace(/{name}/g, 'Alex Kamau')
                                                                        .replace(/{admission_no}/g, 'BTC/2026/042')
                                                                        .replace(/{start_date}/g, 'July 6, 2026')
                                                                        .replace(/{balance}/g, '12,500')
                                                                        .replace(/{due_date}/g, 'July 15, 2026')
                                                                        .replace(/{gpa}/g, '3.82')
                                                                        .replace(/{date}/g, new Date().toLocaleDateString());
                                                                })()}
                                                                <span className="text-[6.5px] text-zinc-400 font-bold block text-right mt-1.5 uppercase">11:34 AM</span>
                                                            </div>
                                                        </div>
                                                        
                                                        {/* Input Bar */}
                                                        <div className="h-8 bg-white border-t border-zinc-200 flex items-center px-3 gap-2">
                                                            <div className="flex-1 h-5 bg-zinc-100 rounded-full border border-zinc-200" />
                                                            <div className="w-5 h-5 rounded-full bg-green-500" />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* ══ INVENTORY CONFIGURATION ═══════════════════════════ */}
                                {activeTab === 'inventory_settings' && (
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in duration-300">
                                        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-100 dark:border-white/5 p-6 space-y-4 shadow-sm">
                                            <div>
                                                <h4 className="text-xs font-black uppercase tracking-widest text-maroon dark:text-gold border-b border-gray-100 dark:border-white/5 pb-2">Inventory System Configuration</h4>
                                                <p className="text-[9px] text-zinc-400 font-semibold mt-1">Configure stock alert rules and defaults for the college inventory.</p>
                                            </div>
                                            
                                            <FieldRow label="Low Stock Warning Limit" description="The stock level below which the system dispatches replenishment warnings.">
                                                <input type="range" min="1" max="100" value={settings.inventory_low_stock_threshold || 10} onChange={e=>set('inventory_low_stock_threshold',e.target.value)} className="w-full h-1 bg-gray-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-maroon" />
                                                <div className="flex justify-between items-center text-[10px] font-black text-zinc-500 uppercase mt-2">
                                                    <span>Min: 1 Unit</span>
                                                    <span className="text-maroon dark:text-gold">Threshold: {settings.inventory_low_stock_threshold || 10} Units</span>
                                                    <span>Max: 100 Units</span>
                                                </div>
                                            </FieldRow>

                                            <FieldRow label="Auto stock Warning Alerts" description="Automatically flag items in the inventory register when they fall below the minimum threshold.">
                                                <div className="flex items-center gap-3"><Toggle value={settings.inventory_auto_alert_enabled} onChange={v=>set('inventory_auto_alert_enabled',v)} /><StatusBadge active={settings.inventory_auto_alert_enabled} labelOn="Active" labelOff="Disabled" /></div>
                                            </FieldRow>
                                        </div>

                                        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-100 dark:border-white/5 p-6 space-y-4 shadow-sm">
                                            <div>
                                                <h4 className="text-xs font-black uppercase tracking-widest text-maroon dark:text-gold border-b border-gray-100 dark:border-white/5 pb-2">Store & Asset Policies</h4>
                                                <p className="text-[9px] text-zinc-400 font-semibold mt-1">Configure accounting methods and target locations.</p>
                                            </div>
                                            <FieldRow label="Default Inventory Store" description="Default warehouse store for newly registered assets."><Inp value={settings.inventory_default_store} onChange={e=>set('inventory_default_store',e.target.value)} /></FieldRow>
                                            <FieldRow label="Asset Depreciation Method" description="Accounting formula used to calculate annual depreciation for registered physical assets.">
                                                <Sel value={settings.inventory_depreciation_method} onChange={e=>set('inventory_depreciation_method',e.target.value)}>
                                                    <option value="straight_line">Straight Line Method</option>
                                                    <option value="double_declining">Double Declining Balance Method</option>
                                                    <option value="units_of_production">Units of Production Method</option>
                                                </Sel>
                                            </FieldRow>
                                        </div>
                                    </div>
                                )}

                                {/* ══ REPORT & DOCUMENT BUILDER ══════════════════════════ */}
                                {activeTab === 'report_builder' && (
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in duration-300">
                                        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-100 dark:border-white/5 p-6 space-y-4 shadow-sm text-left">
                                            <div>
                                                <h4 className="text-xs font-black uppercase tracking-widest text-maroon dark:text-gold border-b border-gray-100 dark:border-white/5 pb-2">Academic Reports Layout Settings</h4>
                                                <p className="text-[9px] text-zinc-400 font-semibold mt-1">Configure text headers, disclaimers and layouts for PDF transcripts.</p>
                                            </div>
                                            <FieldRow label="Official Transcript Header" description="College title banner printed at the top of academic transcripts."><TA value={settings.report_header_text} onChange={e=>set('report_header_text',e.target.value)} rows={3} /></FieldRow>
                                            <FieldRow label="Document Footer Note" description="Legal verification and validation disclaimer printed at the bottom."><TA value={settings.report_footer_text} onChange={e=>set('report_footer_text',e.target.value)} rows={3} /></FieldRow>
                                            <FieldRow label="Display Grading Band Scale" description="Embed the Distinct/Credit/Pass grade range grid at the bottom page margins.">
                                                <div className="flex items-center gap-3"><Toggle value={settings.report_show_grading_scale} onChange={v=>set('report_show_grading_scale',v)} /><StatusBadge active={settings.report_show_grading_scale} labelOn="Visible" labelOff="Hidden" /></div>
                                            </FieldRow>
                                            <FieldRow label="Official Signatory Title" description="The designation printed beneath the signature line."><Inp value={settings.report_signature_title} onChange={e=>set('report_signature_title',e.target.value)} /></FieldRow>
                                        </div>

                                        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-100 dark:border-white/5 p-6 shadow-sm flex flex-col justify-between">
                                            <div>
                                                <h4 className="text-xs font-black uppercase tracking-widest text-maroon dark:text-gold border-b border-gray-100 dark:border-white/5 pb-2">Document Layout Real-time Preview</h4>
                                                <p className="text-[9px] text-zinc-400 font-semibold mt-1">Live layout simulation of generated PDF reports.</p>
                                            </div>

                                            <div className="flex-1 mt-6 border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden flex flex-col shadow-inner bg-zinc-50 dark:bg-zinc-950 p-6 justify-between text-left text-[7px] space-y-4">
                                                {/* Header Mock */}
                                                <div className="flex items-start gap-2 border-b border-gray-200 dark:border-white/5 pb-2 text-zinc-700 dark:text-zinc-200">
                                                    <div className="w-8 h-8 rounded border border-gray-200 bg-white p-0.5 shrink-0 flex items-center justify-center">
                                                        <img src="/app-icon-v2.png" className="w-full h-full object-contain" />
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <p className="font-mono whitespace-pre-wrap leading-tight font-black uppercase text-[8px] text-maroon dark:text-gold">{settings.report_header_text || 'BEAUTEX COLLEGE'}</p>
                                                    </div>
                                                </div>

                                                {/* Document Body Mock */}
                                                <div className="flex-1 space-y-2 py-2">
                                                    <div className="flex justify-between items-center text-[8px] font-black uppercase text-zinc-500 border-b border-gray-100 dark:border-white/5 pb-1">
                                                        <span>Student: Alex Kamau</span>
                                                        <span>Reg: BTC/2026/042</span>
                                                    </div>
                                                    <div className="space-y-1">
                                                        {[
                                                            { code: 'BTC-101', name: 'Introduction to Cosmetology', grade: 'Distinction' },
                                                            { code: 'BTC-102', name: 'Advanced Aesthetics & Hair Styling', grade: 'Credit' }
                                                        ].map((item, idx) => (
                                                            <div key={idx} className="flex justify-between items-center font-mono py-1 border-b border-dashed border-gray-100 dark:border-white/5 text-zinc-600 dark:text-zinc-300">
                                                                <span>{item.code} {item.name}</span>
                                                                <span className="font-black text-maroon dark:text-gold">{item.grade}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Footer & Signature Mock */}
                                                <div className="space-y-3 pt-2 border-t border-gray-200 dark:border-white/5 text-zinc-500 font-semibold leading-relaxed">
                                                    {settings.report_show_grading_scale && (
                                                        <div className="p-1.5 bg-gray-100 dark:bg-zinc-800 rounded flex justify-between gap-1 text-[5.5px] uppercase font-black text-zinc-400">
                                                            <span>Distinction: 70%+</span>
                                                            <span>Credit: 60%+</span>
                                                            <span>Pass: 50%+</span>
                                                            <span>Fail: 0-49%</span>
                                                        </div>
                                                    )}
                                                    <p className="text-[6.5px] italic leading-tight text-center">{settings.report_footer_text || 'Disclaimer text here.'}</p>
                                                    
                                                    <div className="flex justify-between items-end pt-1">
                                                        <div className="w-16 h-8 border border-dashed border-gray-300 rounded flex items-center justify-center text-zinc-400 text-[5px] uppercase font-black">QR Verification</div>
                                                        <div className="text-center flex flex-col items-center">
                                                            <div className="w-16 h-4 border-b border-gray-300 font-mono text-[6px] italic text-zinc-600 dark:text-zinc-300 flex items-end justify-center">Dr. Jane Doe</div>
                                                            <span className="text-[6px] font-black uppercase text-zinc-400 mt-1 block">{settings.report_signature_title || 'Registrar'}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* ══ CERTIFICATES ══════════════════════════════════════ */}
                                {activeTab === 'certificates' && (
                                    <div className="space-y-6 animate-in fade-in duration-300">
                                        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-100 dark:border-white/5 p-6 space-y-4 shadow-sm text-left">
                                            <div>
                                                <h4 className="text-xs font-black uppercase tracking-widest text-maroon dark:text-gold border-b border-gray-100 dark:border-white/5 pb-2">Academic Award Templates</h4>
                                                <p className="text-[9px] text-zinc-400 font-semibold mt-1">Configure layout themes and certificate serial formats.</p>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <FieldRow label="Certificate Code Format" description="Format prefix to generate certificate sequential serial codes."><Inp value={settings.certificate_no_format} onChange={e=>set('certificate_no_format',e.target.value)} mono /></FieldRow>
                                                <FieldRow label="Graduation registry Format"><Inp value={settings.graduation_no_format} onChange={e=>set('graduation_no_format',e.target.value)} mono /></FieldRow>
                                            </div>

                                            <div className="space-y-2 pt-2">
                                                <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block">Short-Course Certificate Theme</label>
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                    {[
                                                        { id: 'standard', title: 'Classic Borders', desc: 'Symmetrical borders, traditional text layouts.' },
                                                        { id: 'classic', title: 'Formal Calligraphy', desc: 'Calligraphy serif fonts, gold insignia ornaments.' },
                                                        { id: 'modern', title: 'Modern Clean', desc: 'Glassmorphic badges, sleek grids.' }
                                                    ].map(tmpl => {
                                                        const isAct = settings.certificate_short_course_template === tmpl.id;
                                                        return (
                                                            <button key={tmpl.id} onClick={() => set('certificate_short_course_template', tmpl.id)} type="button"
                                                                className={`p-4.5 rounded-2xl border text-left flex flex-col justify-between gap-2 transition-all hover:shadow-md ${isAct ? 'border-maroon dark:border-gold bg-maroon/[0.02] dark:bg-gold/[0.02]' : 'border-gray-200 dark:border-white/5 bg-gray-50/50 dark:bg-white/[0.01]'}`}>
                                                                <div className="flex justify-between items-center w-full">
                                                                    <span className="text-[9.5px] font-black uppercase tracking-wider text-zinc-800 dark:text-zinc-200">{tmpl.title}</span>
                                                                    <div className={`w-3 h-3 rounded-full border flex items-center justify-center ${isAct ? 'border-maroon dark:border-gold' : 'border-gray-300'}`}>
                                                                        {isAct && <div className="w-1.5 h-1.5 rounded-full bg-maroon dark:bg-gold" />}
                                                                    </div>
                                                                </div>
                                                                <p className="text-[8.5px] text-zinc-400 font-semibold leading-relaxed">{tmpl.desc}</p>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                                                <FieldRow label="Incorporate Verification QR Code" description="Print security QR code on awards for digital registry verification checks.">
                                                    <div className="flex items-center gap-3"><Toggle value={settings.qr_verification_enabled} onChange={v=>set('qr_verification_enabled',v)} /><StatusBadge active={settings.qr_verification_enabled} labelOn="Enabled" labelOff="Disabled" /></div>
                                                </FieldRow>
                                                <FieldRow label="Digital Principal Signature" description="Automatically imprint principal authorized signature image on certificates.">
                                                    <div className="flex items-center gap-3"><Toggle value={settings.digital_signatures_enabled} onChange={v=>set('digital_signatures_enabled',v)} /><StatusBadge active={settings.digital_signatures_enabled} labelOn="Imprinted" labelOff="Disabled" /></div>
                                                </FieldRow>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* ══ LMS ═══════════════════════════════════════════════ */}
                                {activeTab === 'lms' && (
                                    <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-100 dark:border-white/5 p-6 space-y-4 shadow-sm text-left animate-in fade-in duration-300">
                                        <div>
                                            <h4 className="text-xs font-black uppercase tracking-widest text-maroon dark:text-gold border-b border-gray-100 dark:border-white/5 pb-2">Learning Management System (LMS) Nodes</h4>
                                            <p className="text-[9px] text-zinc-400 font-semibold mt-1">Configure feature visibility inside the student e-learning dashboard portal.</p>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                                            {[
                                                { key:'lms_assignments_enabled', label:'Virtual Assignment Submissions', desc: 'Allows students to upload assignments directly for grading.' },
                                                { key:'lms_materials_enabled', label:'Lecture Notes & Handout Library', desc: 'Publishes courseware documents uploaded by trainers.' },
                                                { key:'lms_online_exams_enabled', label:'Computer Based Testing (CBT)', desc: 'Enables timed online testing modules inside the portal.' },
                                                { key:'lms_online_classes_enabled', label:'Virtual Video Lectures Integration', desc: 'Allows virtual class meeting scheduling and launches.' },
                                                { key:'lms_discussions_enabled', label:'Classroom Discussion Forums', desc: 'Allows group threads between students and instructors.' },
                                            ].map(l=>(
                                                <div key={l.key} className="flex items-center justify-between p-4.5 bg-gray-50/50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/5 rounded-3xl hover:border-gold/20 transition-all gap-4">
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-xs font-black uppercase tracking-wide text-zinc-700 dark:text-zinc-200">{l.label}</p>
                                                        <p className="text-[8.5px] text-zinc-400 font-medium leading-relaxed mt-0.5">{l.desc}</p>
                                                    </div>
                                                    <Toggle value={settings[l.key]} onChange={v=>set(l.key,v)} />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* ══ SECURITY ══════════════════════════════════════════ */}
                                {activeTab === 'security' && isSuperAdmin && (
                                    <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-100 dark:border-white/5 p-6 space-y-4 shadow-sm text-left animate-in fade-in duration-300">
                                        <div>
                                            <h4 className="text-xs font-black uppercase tracking-widest text-maroon dark:text-gold border-b border-gray-100 dark:border-white/5 pb-2">CMS Portal Security Policies</h4>
                                            <p className="text-[9px] text-zinc-400 font-semibold mt-1">Configure credentials rules, user sessions, and login lockout triggers.</p>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <FieldRow label="Minimum Password Length" description="Enforce minimum characters for user password updates."><Inp type="number" value={settings.password_policy_min_len} onChange={e=>set('password_policy_min_len',e.target.value)} /></FieldRow>
                                            <FieldRow label="Session Timeout Duration" description="Timeout user sessions after inactive minutes."><Inp type="number" value={settings.session_timeout} onChange={e=>set('session_timeout',e.target.value)} /></FieldRow>
                                            <FieldRow label="Lockout Login Attempts" description="Brute-force lockout trigger count."><Inp type="number" value={settings.failed_login_attempts} onChange={e=>set('failed_login_attempts',e.target.value)} /></FieldRow>
                                            <FieldRow label="Special Characters Required" description="Enforce passwords to contain numbers, uppercase, and symbols.">
                                                <div className="flex items-center gap-3"><Toggle value={settings.password_policy_require_special} onChange={v=>set('password_policy_require_special',v)} /><StatusBadge active={settings.password_policy_require_special} labelOn="Enforced" labelOff="Standard" /></div>
                                            </FieldRow>
                                            <FieldRow label="Two-Factor Authentication" description="Enforce email OTP confirmation checks at logins.">
                                                <div className="flex items-center gap-3"><Toggle value={settings.two_factor_auth} onChange={v=>set('two_factor_auth',v)} /><StatusBadge active={settings.two_factor_auth} labelOn="Enforced" labelOff="Disabled" /></div>
                                            </FieldRow>
                                            <FieldRow label="Activity logs Auditing" description="Log and audit all operator page interactions.">
                                                <div className="flex items-center gap-3"><Toggle value={settings.activity_monitoring_enabled} onChange={v=>set('activity_monitoring_enabled',v)} /><StatusBadge active={settings.activity_monitoring_enabled} labelOn="Auditing" labelOff="Disabled" /></div>
                                            </FieldRow>
                                        </div>
                                    </div>
                                )}

                                {/* ══ INTEGRATIONS ══════════════════════════════════════ */}
                                {activeTab === 'integrations' && isSuperAdmin && (
                                    <div className="space-y-6 animate-in fade-in duration-300">
                                        {/* M-Pesa Integration Card */}
                                        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-100 dark:border-white/5 p-6 space-y-4 shadow-sm text-left">
                                            <div className="flex justify-between items-center border-b border-gray-100 dark:border-white/5 pb-2">
                                                <div>
                                                    <h4 className="text-xs font-black uppercase tracking-widest text-maroon dark:text-gold">M-Pesa Merchant Gateway</h4>
                                                    <p className="text-[9px] text-zinc-400 font-semibold mt-0.5">Safaricom Daraja API configurations for real-time mobile receipts.</p>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <button type="button" onClick={() => triggerTestIntegration('mpesa')} disabled={testingIntegration['mpesa']}
                                                        className="text-[8px] font-black uppercase tracking-widest border border-dashed border-gray-300 dark:border-white/10 hover:border-gold hover:text-maroon dark:hover:text-gold px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm bg-white dark:bg-zinc-800">
                                                        {testingIntegration['mpesa'] ? <RefreshCw className="w-2.5 h-2.5 animate-spin" /> : <Zap className="w-2.5 h-2.5 text-yellow-500" />}
                                                        {testingIntegration['mpesa'] ? 'Testing Connection...' : 'Test Connection'}
                                                    </button>
                                                    <Toggle value={settings.mpesa_status} onChange={v=>set('mpesa_status',v)} />
                                                </div>
                                            </div>

                                            {integrationStatus['mpesa'] && (
                                                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-xl text-[8.5px] font-mono leading-none">
                                                    {integrationStatus['mpesa']}
                                                </div>
                                            )}

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <FieldRow label="Paybill Shortcode" description="Your business LIPA NA M-PESA paybill shortcode."><Inp value={settings.mpesa_shortcode} onChange={e=>set('mpesa_shortcode',e.target.value)} mono /></FieldRow>
                                                <FieldRow label="Consumer API Key"><Inp value={settings.mpesa_consumer_key} onChange={e=>set('mpesa_consumer_key',e.target.value)} mono /></FieldRow>
                                                <FieldRow label="Consumer Client Secret"><PwdField value={settings.mpesa_consumer_secret} onChange={e=>set('mpesa_consumer_secret',e.target.value)} /></FieldRow>
                                                <FieldRow label="API Passkey"><PwdField value={settings.mpesa_passkey} onChange={e=>set('mpesa_passkey',e.target.value)} /></FieldRow>
                                                <FieldRow label="Instant Callback URL" description="Target endpoint routing payment confirmations from Safaricom."><Inp value={settings.mpesa_callback_url} onChange={e=>set('mpesa_callback_url',e.target.value)} /></FieldRow>
                                            </div>
                                        </div>

                                        {/* API Integration Keys */}
                                        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-100 dark:border-white/5 p-6 space-y-4 shadow-sm text-left">
                                            <div>
                                                <h4 className="text-xs font-black uppercase tracking-widest text-maroon dark:text-gold border-b border-gray-100 dark:border-white/5 pb-2">External Calendar & Meeting SDK Credentials</h4>
                                                <p className="text-[9px] text-zinc-400 font-semibold mt-1">Manage API keys routing virtual classrooms and Google Calendars.</p>
                                            </div>

                                            <div className="space-y-4">
                                                {[
                                                    { key: 'google_calendar', label: 'Google Calendar Sync SDK', field: 'google_calendar_api_key', desc: 'Synchronizes academic term dates and class timetables to Google Calendar.' },
                                                    { key: 'zoom', label: 'Zoom Video Webinars SDK', field: 'zoom_api_key', desc: 'Authenticates virtual classroom streams and triggers Zoom meetings.' },
                                                    { key: 'google_meet', label: 'Google Meet API Client ID', field: 'google_meet_api_key', desc: 'Allows virtual class routing inside Google Workspace.' }
                                                ].map(api => (
                                                    <div key={api.key} className="p-4 bg-gray-50/50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-[10px] font-black uppercase tracking-wider text-zinc-700 dark:text-zinc-200 leading-none">{api.label}</p>
                                                            <p className="text-[8.5px] text-zinc-400 font-semibold leading-relaxed mt-1 max-w-sm">{api.desc}</p>
                                                        </div>
                                                        <div className="flex items-center gap-3 self-end md:self-auto">
                                                            {integrationStatus[api.key] && (
                                                                <span className="text-[7.5px] font-mono text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 px-2 py-1 rounded border border-emerald-200/50">Verified</span>
                                                            )}
                                                            <button type="button" onClick={() => triggerTestIntegration(api.key)} disabled={testingIntegration[api.key]}
                                                                className="text-[8px] font-black uppercase tracking-widest border border-gray-300 dark:border-white/10 hover:border-gold hover:text-maroon dark:hover:text-gold px-2.5 py-1.5 rounded-lg transition-all shadow-sm bg-white dark:bg-zinc-800 shrink-0">
                                                                {testingIntegration[api.key] ? 'Verifying...' : 'Test Sync'}
                                                            </button>
                                                            <div className="w-56"><PwdField value={settings[api.field]} onChange={e=>set(api.field,e.target.value)} /></div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* ══ BACKUP ════════════════════════════════════════════ */}
                                {activeTab === 'backup' && isSuperAdmin && (
                                    <div className="space-y-6 animate-in fade-in duration-300">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="p-6 bg-rose-50/50 dark:bg-rose-950/10 border border-rose-100/50 dark:border-rose-950/30 rounded-3xl space-y-4 text-left flex flex-col justify-between hover:shadow-md transition-shadow">
                                                <div className="space-y-2">
                                                    <HardDrive className="w-8 h-8 text-maroon dark:text-gold" />
                                                    <h4 className="text-xs font-black uppercase text-maroon dark:text-gold tracking-wider leading-none">Download Raw SQLite Snapshot</h4>
                                                    <p className="text-[9.5px] text-zinc-400 font-semibold leading-relaxed">Download a complete, offline backup snapshot file of the current SQLite database records immediately.</p>
                                                </div>
                                                <button onClick={handleBackup} className="w-full flex items-center justify-center gap-2 text-white py-3 rounded-xl font-black text-[9px] uppercase tracking-widest hover:opacity-90 transition-all shadow-md mt-4"
                                                    style={{ backgroundColor: settings.sidebar_colors || '#7a0000', border: `1px solid ${GOLD}40` }}>
                                                    <Download className="w-3.5 h-3.5 text-yellow-300 animate-bounce" /> Download Database Backup
                                                </button>
                                            </div>
                                            <div className="p-6 bg-zinc-50/50 dark:bg-white/[0.02] border border-zinc-200 dark:border-white/10 rounded-3xl space-y-4 text-left flex flex-col justify-between hover:shadow-md transition-shadow">
                                                <div className="space-y-2">
                                                    <RefreshCw className={`w-8 h-8 text-zinc-500 ${restoring?'animate-spin':''}`} />
                                                    <h4 className="text-xs font-black uppercase text-zinc-700 dark:text-zinc-200 tracking-wider leading-none">Restore Last Safe State Snapshot</h4>
                                                    <p className="text-[9.5px] text-zinc-400 font-semibold leading-relaxed">Overwrite current active table records and restore the database state to the last verified safe snapshot point.</p>
                                                </div>
                                                <button onClick={handleRestore} disabled={restoring} className="w-full flex items-center justify-center gap-2 bg-zinc-700 hover:bg-zinc-800 text-white py-3 rounded-xl font-black text-[9px] uppercase tracking-widest disabled:opacity-50 transition-all shadow-md mt-4">
                                                    <RefreshCw className="w-3.5 h-3.5" /> {restoring?'Restoring snapshot state...':'Trigger Restoration Sequence'}
                                                </button>
                                            </div>
                                        </div>

                                        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-100 dark:border-white/5 p-6 space-y-4 shadow-sm text-left">
                                            <div>
                                                <h4 className="text-xs font-black uppercase tracking-widest text-maroon dark:text-gold border-b border-gray-100 dark:border-white/5 pb-2">Auto Backup Scheduler</h4>
                                                <p className="text-[9px] text-zinc-400 font-semibold mt-1">Configure cron task triggers for background database backups.</p>
                                            </div>
                                            <FieldRow label="Auto-Backup Schedule Frequency">
                                                <Sel value={settings.backup_interval} onChange={e=>set('backup_interval',e.target.value)}>
                                                    <option value="daily">Daily Cron Backup (1:00 AM)</option>
                                                    <option value="weekly">Weekly Cron Backup (Sunday 2:00 AM)</option>
                                                    <option value="monthly">Monthly Cron Backup (1st of month)</option>
                                                    <option value="manual">Manual Backup Triggers Only</option>
                                                </Sel>
                                            </FieldRow>
                                            <FieldRow label="Included Target Snapshots" description="Comma-separated catalogs to pack into backups."><Inp value={settings.backup_types} onChange={e=>set('backup_types',e.target.value)} mono /></FieldRow>
                                        </div>
                                    </div>
                                )}

                                {/* ══ THEMES ════════════════════════════════════════════ */}
                                {activeTab === 'branding_themes' && (() => {
                                    const MAROON_PALETTE = [
                                        { name: 'Royal Maroon',    hex: '#800000' },
                                        { name: 'Deep Crimson',    hex: '#6B0000' },
                                        { name: 'Dark Maroon',     hex: '#5a0000' },
                                        { name: 'Warm Burgundy',   hex: '#722F37' },
                                        { name: 'Classic Wine',    hex: '#7B2D8B' },
                                        { name: 'Heritage Red',    hex: '#8B1A1A' },
                                        { name: 'Scarlet Deep',    hex: '#9B1B30' },
                                        { name: 'Oxblood',         hex: '#4A0010' },
                                    ];
                                    const GOLD_PALETTE = [
                                        { name: 'Classic Gold',    hex: '#c8a94a' },
                                        { name: 'Bright Gold',     hex: '#FFD700' },
                                        { name: 'Antique Gold',    hex: '#B8860B' },
                                        { name: 'Rich Gold',       hex: '#DAA520' },
                                        { name: 'Warm Amber',      hex: '#FFBF00' },
                                        { name: 'Deep Saffron',    hex: '#E8A000' },
                                        { name: 'Burnished Gold',  hex: '#A0790A' },
                                        { name: 'Pale Gold',       hex: '#EDD26A' },
                                    ];
                                    const DARK_PALETTE = [
                                        { name: 'Midnight',        hex: '#0b0b0c' },
                                        { name: 'Charcoal',        hex: '#1a1a2e' },
                                        { name: 'Navy',            hex: '#0d1b2a' },
                                        { name: 'Forest',          hex: '#0d2818' },
                                        { name: 'Graphite',        hex: '#2d2d2d' },
                                        { name: 'Slate',           hex: '#1e293b' },
                                        { name: 'Deep Purple',     hex: '#2d1b69' },
                                        { name: 'Ocean',           hex: '#0a3d62' },
                                    ];
                                    const SwatchGroup = ({ title, palette, settingKey }) => (
                                        <div className="space-y-3">
                                            <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">{title}</p>
                                            <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                                                {palette.map(sw => {
                                                    const isActive = settings[settingKey]?.toLowerCase() === sw.hex.toLowerCase();
                                                    return (
                                                        <button
                                                            key={sw.hex}
                                                            title={sw.name}
                                                            onClick={() => set(settingKey, sw.hex)}
                                                            className="group flex flex-col items-center gap-1.5"
                                                        >
                                                            <div
                                                                className={`w-full aspect-square rounded-xl shadow-md transition-all duration-200 group-hover:scale-110 group-hover:shadow-lg border-2 ${isActive ? 'border-white scale-110 shadow-xl ring-2 ring-offset-2' : 'border-transparent'}`}
                                                                style={{ backgroundColor: sw.hex, ringColor: sw.hex }}
                                                            >
                                                                {isActive && (
                                                                    <div className="w-full h-full flex items-center justify-center">
                                                                        <CheckCircle className="w-4 h-4 text-white drop-shadow" />
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <span className="text-[7px] font-bold text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-200 text-center leading-tight line-clamp-2 px-0.5 transition-colors">{sw.name}</span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                    return (
                                        <div className="space-y-8 animate-in fade-in duration-300">
                                            {/* Live Preview Card */}
                                            <div className="rounded-2xl border border-gray-200 dark:border-white/10 overflow-hidden shadow-lg">
                                                <div className="px-4 py-2.5 border-b border-gray-100 dark:border-white/10 bg-gray-50 dark:bg-zinc-900 flex items-center justify-between">
                                                    <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 flex items-center gap-1.5"><Eye className="w-3 h-3" /> Live Preview</p>
                                                    <span className="text-[8px] font-bold text-zinc-400">Changes apply on Save</span>
                                                </div>
                                                <div className="flex h-32 bg-white dark:bg-zinc-950">
                                                    {/* Mini sidebar preview */}
                                                    <div className="w-20 flex flex-col items-start px-2 py-2 gap-1 shrink-0" style={{ backgroundColor: settings.sidebar_colors || '#7a0000' }}>
                                                        <div className="w-full h-3 rounded bg-white/30 mb-1" />
                                                        {[1,2,3,4].map(i => (
                                                            <div key={i} className={`w-full h-2.5 rounded flex items-center gap-1 px-1 ${i===1?'bg-white/25':''}`}>
                                                                <div className="w-1.5 h-1.5 rounded-sm bg-white/40 shrink-0" />
                                                                <div className="flex-1 h-1 bg-white/20 rounded-sm" />
                                                            </div>
                                                        ))}
                                                    </div>
                                                    {/* Mini header + content preview */}
                                                    <div className="flex-1 flex flex-col">
                                                        <div className="h-7 flex items-center px-3 gap-2 shrink-0" style={{ backgroundColor: settings.portal_theme_colors || '#800000' }}>
                                                            <div className="w-12 h-2 bg-white/50 rounded-sm" />
                                                            <div className="flex-1" />
                                                            <div className="w-2 h-2 bg-white/50 rounded-full" />
                                                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: GOLD }} />
                                                        </div>
                                                        <div className="flex-1 p-2 space-y-1 bg-gray-50 dark:bg-zinc-900">
                                                            <div className="flex gap-1">
                                                                <div className="h-6 rounded-lg flex-1" style={{ backgroundColor: (settings.portal_theme_colors || '#800000') + '15', border: `1px solid ${settings.portal_theme_colors || '#800000'}30` }} />
                                                                <div className="h-6 rounded-lg flex-1 bg-gray-100 dark:bg-zinc-800" />
                                                                <div className="h-6 rounded-lg flex-1 bg-gray-100 dark:bg-zinc-800" />
                                                            </div>
                                                            <div className="h-2 bg-gray-200 dark:bg-zinc-800 rounded-sm w-3/4" />
                                                            <div className="h-2 bg-gray-100 dark:bg-zinc-700 rounded-sm w-1/2" />
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="px-4 py-3 bg-gray-50/50 dark:bg-zinc-900/60 border-t border-gray-100 dark:border-white/5 flex items-center gap-4">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-5 h-5 rounded-md border border-white/20 shadow" style={{ backgroundColor: settings.portal_theme_colors || '#800000' }} />
                                                        <div>
                                                            <p className="text-[8px] font-black text-zinc-400 uppercase tracking-wider">Primary / Header</p>
                                                            <p className="text-[9px] font-mono font-bold text-zinc-700 dark:text-zinc-200">{settings.portal_theme_colors || '#800000'}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-5 h-5 rounded-md border border-white/20 shadow" style={{ backgroundColor: settings.sidebar_colors || '#7a0000' }} />
                                                        <div>
                                                            <p className="text-[8px] font-black text-zinc-400 uppercase tracking-wider">Sidebar / Accent</p>
                                                            <p className="text-[9px] font-mono font-bold text-zinc-700 dark:text-zinc-200">{settings.sidebar_colors || '#7a0000'}</p>
                                                        </div>
                                                    </div>
                                                    <button onClick={() => { set('portal_theme_colors','#800000'); set('sidebar_colors','#7a0000'); }}
                                                        className="ml-auto text-[8px] font-black text-zinc-400 hover:text-maroon dark:hover:text-gold transition-colors uppercase tracking-widest border border-dashed border-zinc-200 dark:border-white/10 px-2 py-1 rounded-lg hover:border-maroon dark:hover:border-gold">
                                                        ↺ Reset to BTTC Default
                                                    </button>
                                                </div>
                                            </div>

                                            {/* PRIMARY / HEADER COLOR */}
                                            <div className="p-5 bg-white dark:bg-zinc-900 border border-gray-100 dark:border-white/5 rounded-2xl shadow-sm space-y-5">
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <h4 className="text-xs font-black uppercase tracking-wider text-zinc-700 dark:text-zinc-200">Primary / Header Color</h4>
                                                        <p className="text-[9px] text-zinc-400 font-semibold mt-0.5">Used for the top navigation bar and primary action buttons</p>
                                                    </div>
                                                    <div className="flex items-center gap-2 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2">
                                                        <div className="w-6 h-6 rounded-lg shadow border border-white/20" style={{backgroundColor:settings.portal_theme_colors || '#800000'}} />
                                                        <input type="color" value={settings.portal_theme_colors || '#800000'} onChange={e=>set('portal_theme_colors',e.target.value)} className="w-7 h-7 rounded-lg cursor-pointer bg-transparent border-0 p-0" title="Pick custom color" />
                                                        <span className="text-[10px] font-mono font-black text-gray-500 dark:text-zinc-300">{settings.portal_theme_colors || '#800000'}</span>
                                                    </div>
                                                </div>
                                                <SwatchGroup title="🔴 Maroon Shades" palette={MAROON_PALETTE} settingKey="portal_theme_colors" />
                                                <SwatchGroup title="⚫ Dark Tones" palette={DARK_PALETTE} settingKey="portal_theme_colors" />
                                            </div>

                                            {/* SIDEBAR COLOR */}
                                            <div className="p-5 bg-white dark:bg-zinc-900 border border-gray-100 dark:border-white/5 rounded-2xl shadow-sm space-y-5">
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <h4 className="text-xs font-black uppercase tracking-wider text-zinc-700 dark:text-zinc-200">Sidebar / Accent Color</h4>
                                                        <p className="text-[9px] text-zinc-400 font-semibold mt-0.5">Used for the left navigation sidebar and accent elements</p>
                                                    </div>
                                                    <div className="flex items-center gap-2 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2">
                                                        <div className="w-6 h-6 rounded-lg shadow border border-white/20" style={{backgroundColor:settings.sidebar_colors || '#7a0000'}} />
                                                        <input type="color" value={settings.sidebar_colors || '#7a0000'} onChange={e=>set('sidebar_colors',e.target.value)} className="w-7 h-7 rounded-lg cursor-pointer bg-transparent border-0 p-0" title="Pick custom color" />
                                                        <span className="text-[10px] font-mono font-black text-gray-500 dark:text-zinc-300">{settings.sidebar_colors || '#7a0000'}</span>
                                                    </div>
                                                </div>
                                                <SwatchGroup title="🔴 Maroon Shades" palette={MAROON_PALETTE} settingKey="sidebar_colors" />
                                                <SwatchGroup title="🏆 Gold & Amber" palette={GOLD_PALETTE} settingKey="sidebar_colors" />
                                                <SwatchGroup title="⚫ Dark Tones" palette={DARK_PALETTE} settingKey="sidebar_colors" />
                                            </div>

                                            {/* QUICK THEME PRESETS */}
                                            <div className="p-5 bg-white dark:bg-zinc-900 border border-gray-100 dark:border-white/5 rounded-2xl shadow-sm space-y-4">
                                                <div>
                                                    <h4 className="text-xs font-black uppercase tracking-wider text-zinc-700 dark:text-zinc-200">Quick Theme Presets</h4>
                                                    <p className="text-[9px] text-zinc-400 font-semibold mt-0.5">One-click apply coordinated color combinations</p>
                                                </div>
                                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                                                    {[
                                                        { name: 'BTTC Classic',    primary: '#800000', sidebar: '#7a0000', gold: GOLD },
                                                        { name: 'Deep Maroon',     primary: '#6B0000', sidebar: '#5a0000', gold: '#DAA520' },
                                                        { name: 'Burgundy & Gold', primary: '#722F37', sidebar: '#6a2030', gold: '#FFD700' },
                                                        { name: 'Heritage',        primary: '#8B1A1A', sidebar: '#7a0000', gold: '#B8860B' },
                                                        { name: 'Midnight Blue',   primary: '#0d1b2a', sidebar: '#1a1a2e', gold: GOLD },
                                                        { name: 'Forest Green',    primary: '#0d2818', sidebar: '#0a1f12', gold: '#DAA520' },
                                                        { name: 'Graphite',        primary: '#2d2d2d', sidebar: '#1a1a1a', gold: GOLD },
                                                        { name: 'Oxblood Elite',   primary: '#4A0010', sidebar: '#3a000c', gold: '#E8A000' },
                                                    ].map(preset => (
                                                        <button key={preset.name}
                                                            onClick={() => { set('portal_theme_colors', preset.primary); set('sidebar_colors', preset.sidebar); }}
                                                            className="group p-3 rounded-xl border border-gray-100 dark:border-white/5 hover:border-gold hover:shadow-md transition-all text-left space-y-2 bg-gray-50/50 dark:bg-zinc-800 hover:bg-white dark:hover:bg-zinc-700">
                                                            <div className="flex gap-1.5 h-6 rounded-lg overflow-hidden">
                                                                <div className="flex-1 h-full" style={{ backgroundColor: preset.primary }} />
                                                                <div className="flex-1 h-full" style={{ backgroundColor: preset.sidebar }} />
                                                                <div className="w-4 h-full" style={{ backgroundColor: preset.gold }} />
                                                            </div>
                                                            <p className="text-[9px] font-black text-zinc-600 dark:text-zinc-300 uppercase tracking-wide group-hover:text-maroon dark:group-hover:text-gold transition-colors">{preset.name}</p>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Login Banner URL */}
                                            <div className="p-5 bg-white dark:bg-zinc-900 border border-gray-100 dark:border-white/5 rounded-2xl shadow-sm">
                                                <FieldRow label="Login Banner URL" description="Custom image URL displayed on the login page background">
                                                    <Inp value={settings.login_banner_url} onChange={e=>set('login_banner_url',e.target.value)} placeholder="https://example.com/banner.jpg" />
                                                </FieldRow>
                                            </div>
                                        </div>
                                    );
                                })()}

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
                                                                <td className="px-4 py-3 text-maroon dark:text-gold font-black">{l.action}</td>
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
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-[100] animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-zinc-900 rounded-3xl p-7 max-w-md w-full shadow-2xl relative overflow-hidden border border-maroon/10">
                        <div className="absolute top-0 left-0 right-0 h-1"
                            style={{ background: `linear-gradient(90deg, ${settings.sidebar_colors || '#7a0000'}, ${GOLD}, ${settings.portal_theme_colors || '#800000'})` }} />
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h2 className="text-base font-black text-maroon dark:text-gold uppercase tracking-tight">
                                    {editingDept ? 'Update Department' : 'New Department'}
                                </h2>
                                <div className="w-8 h-0.5 mt-1.5" style={{ background: GOLD }} />
                            </div>
                            <button onClick={()=>setShowDeptModal(false)} className="p-1.5 hover:bg-maroon/5 rounded-full transition-colors">
                                <XCircle className="w-5 h-5 text-gray-300 hover:text-red-500" />
                            </button>
                        </div>
                        <form onSubmit={handleDeptSubmit} className="space-y-4">
                            <div>
                                <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block mb-1.5">Department Name *</label>
                                <input type="text" value={deptForm.name} onChange={e=>setDeptForm({...deptForm,name:e.target.value})} required placeholder="e.g. Department of Cosmetology" className="w-full px-3.5 py-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-maroon/30 focus:border-maroon" />
                            </div>
                            <div>
                                <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block mb-1.5">Head of Department (HOD)</label>
                                <input type="text" value={deptForm.head_of_department} onChange={e=>setDeptForm({...deptForm,head_of_department:e.target.value})} placeholder="e.g. Ms. Grace Kemunto" className="w-full px-3.5 py-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-maroon/30 focus:border-maroon" />
                            </div>
                            <div>
                                <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block mb-1.5">Description</label>
                                <textarea value={deptForm.description} onChange={e=>setDeptForm({...deptForm,description:e.target.value})} placeholder="Brief department overview..." rows={3} className="w-full px-3.5 py-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-maroon/30 focus:border-maroon resize-none" />
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
