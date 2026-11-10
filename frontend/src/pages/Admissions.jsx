import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Search, Plus, X, Download, Trash2, Upload, RefreshCw, ChevronLeft, ChevronRight,
    CheckCircle2, Circle, Mail, Phone, MapPin, CalendarDays, GraduationCap, User,
    FileText, Pencil, Loader2, UserPlus, AlertTriangle, Clock,
} from 'lucide-react';
import { applicantAPI, coursesAPI, settingsAPI } from '../services/api';

const STATUSES = ['Submitted', 'Under Review', 'Shortlisted', 'Offered', 'Accepted', 'Enrolled', 'Rejected', 'Withdrawn'];
const PIPELINE = ['Submitted', 'Under Review', 'Shortlisted', 'Offered', 'Accepted', 'Enrolled'];
const DEFAULT_INTAKES = ['January Intake', 'May Intake', 'September Intake', 'Short Course'];
const SOURCES = ['Walk-in', 'Phone', 'Referral', 'Online', 'Other'];
const REGISTRATION_TYPES = ['Diploma', 'Short Course'];
const GENDERS = ['Female', 'Male', 'Other', 'Prefer not to say'];

// Mirrors ALLOWED_TRANSITIONS in applicantController.js. Enrolled is reachable
// only through the future conversion flow.
const NEXT_STATUS = {
    'Submitted': ['Under Review', 'Shortlisted', 'Rejected', 'Withdrawn'],
    'Under Review': ['Shortlisted', 'Rejected', 'Withdrawn'],
    'Shortlisted': ['Offered', 'Rejected', 'Withdrawn'],
    'Offered': ['Accepted', 'Rejected', 'Withdrawn'],
    'Accepted': ['Withdrawn'],
    'Enrolled': [],
    'Rejected': ['Under Review'],
    'Withdrawn': ['Under Review'],
};

const STATUS_STYLES = {
    'Submitted': 'bg-blue-50 text-blue-600 border-blue-100',
    'Under Review': 'bg-amber-50 text-amber-700 border-amber-100',
    'Shortlisted': 'bg-violet-50 text-violet-600 border-violet-100',
    'Offered': 'bg-yellow-50 text-yellow-700 border-yellow-200',
    'Accepted': 'bg-emerald-50 text-emerald-600 border-emerald-100',
    'Enrolled': 'bg-green-50 text-green-700 border-green-200',
    'Rejected': 'bg-red-50 text-red-600 border-red-100',
    'Withdrawn': 'bg-zinc-100 text-zinc-500 border-zinc-200',
};

const STATUS_DOTS = {
    'Submitted': 'bg-blue-400',
    'Under Review': 'bg-amber-400',
    'Shortlisted': 'bg-violet-400',
    'Offered': 'bg-yellow-400',
    'Accepted': 'bg-emerald-400',
    'Enrolled': 'bg-green-500',
    'Rejected': 'bg-red-400',
    'Withdrawn': 'bg-zinc-400',
};

const FIELD = 'w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-xs font-semibold text-gray-700 outline-none focus:ring-4 focus:ring-maroon/10 focus:border-maroon/30 transition-all';
const LABEL = 'text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-1 block';

const EMPTY_FORM = {
    full_name: '', email: '', phone: '', gender: '', dob: '',
    programme_id: '', programme_name: '', intake: '', registration_type: 'Diploma',
    prior_school: '', prior_qualification: '', guardian_name: '', guardian_phone: '',
    address: '', source: 'Walk-in', notes: '',
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function fmtDate(v) {
    if (!v) return '—';
    const d = new Date(v);
    if (isNaN(d.getTime())) return String(v).slice(0, 10);
    return `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
function fmtSize(bytes) {
    const n = Number(bytes) || 0;
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
function initials(name) {
    return String(name || '?').trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase();
}

function StatusPill({ status }) {
    return (
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[8px] font-black uppercase tracking-widest whitespace-nowrap ${STATUS_STYLES[status] || STATUS_STYLES.Withdrawn}`}>
            <span className={`w-1 h-1 rounded-full ${STATUS_DOTS[status] || 'bg-current'}`} />
            {status}
        </span>
    );
}

function Modal({ children, onClose, width = 'max-w-3xl' }) {
    return (
        <div
            className="fixed inset-0 bg-maroon/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-[200]"
            onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div role="dialog" aria-modal="true"
                className={`bg-white rounded-2xl sm:rounded-3xl w-full ${width} border border-maroon/10 shadow-2xl max-h-[94vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200`}>
                {children}
            </div>
        </div>
    );
}

function DetailField({ icon: Icon, label, value }) {
    return (
        <div className="flex items-start gap-2.5">
            <Icon className="w-3.5 h-3.5 text-zinc-300 mt-0.5 shrink-0" />
            <div className="min-w-0">
                <p className="text-[8px] font-black text-zinc-400 uppercase tracking-widest">{label}</p>
                <p className="text-[11px] font-semibold text-zinc-700 break-words">{value || '—'}</p>
            </div>
        </div>
    );
}

export default function Admissions() {
    const [rows, setRows] = useState([]);
    const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20, totalPages: 0 });
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [listError, setListError] = useState('');
    const [refreshKey, setRefreshKey] = useState(0);

    const [search, setSearch] = useState('');
    const [query, setQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [intakeFilter, setIntakeFilter] = useState('');
    const [page, setPage] = useState(1);

    const [courses, setCourses] = useState([]);
    const [requiredDocs, setRequiredDocs] = useState([]);
    const [maxDocMb, setMaxDocMb] = useState(2);

    const [formOpen, setFormOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState(EMPTY_FORM);
    const [formError, setFormError] = useState('');
    const [saving, setSaving] = useState(false);

    const [detailId, setDetailId] = useState(null);
    const [detail, setDetail] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [detailError, setDetailError] = useState('');
    const [actionBusy, setActionBusy] = useState(false);
    const [statusNote, setStatusNote] = useState('');

    const [docType, setDocType] = useState('');
    const [docFile, setDocFile] = useState(null);
    const [docBusy, setDocBusy] = useState(false);
    const [docError, setDocError] = useState('');
    const fileInputRef = useRef(null);

    const refresh = useCallback(() => setRefreshKey(k => k + 1), []);

    useEffect(() => {
        const timer = setTimeout(() => {
            setQuery(search.trim());
            setPage(1);
        }, 300);
        return () => clearTimeout(timer);
    }, [search]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            setListError('');
            try {
                const params = { page, limit: 20 };
                if (query) params.q = query;
                if (statusFilter) params.status = statusFilter;
                if (intakeFilter) params.intake = intakeFilter;
                const { data } = await applicantAPI.list(params);
                if (cancelled) return;
                setRows(data.applicants || []);
                setPagination(data.pagination || { total: 0, page: 1, limit: 20, totalPages: 0 });
            } catch (err) {
                if (cancelled) return;
                setListError(err.response?.data?.error || 'Failed to load applications.');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [page, query, statusFilter, intakeFilter, refreshKey]);

    useEffect(() => {
        applicantAPI.stats().then(({ data }) => setStats(data)).catch(() => {});
    }, [refreshKey]);

    useEffect(() => {
        coursesAPI.getAll()
            .then(({ data }) => setCourses(Array.isArray(data) ? data : []))
            .catch(() => {});
        settingsAPI.get()
            .then(({ data }) => {
                if (!data) return;
                const docs = String(data.admissions_required_documents || '')
                    .split(',').map(s => s.trim()).filter(Boolean);
                setRequiredDocs(docs);
                setDocType(docs[0] || 'Supporting Document');
                const mb = parseInt(data.admissions_document_max_mb, 10);
                setMaxDocMb(Number.isFinite(mb) && mb > 0 ? mb : 2);
            })
            .catch(() => {});
    }, []);

    const intakeOptions = useMemo(() => {
        const extra = (stats?.byIntake || []).map(i => i.intake).filter(i => i && i !== 'Unassigned');
        return [...new Set([...DEFAULT_INTAKES, ...extra])];
    }, [stats]);

    const programmeOptions = useMemo(
        () => [...courses].sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''))),
        [courses]
    );

    const loadDetail = useCallback(async (id) => {
        setDetailLoading(true);
        setDetailError('');
        try {
            const { data } = await applicantAPI.get(id);
            setDetail(data);
            setStatusNote('');
        } catch (err) {
            setDetailError(err.response?.data?.error || 'Failed to load the application.');
        } finally {
            setDetailLoading(false);
        }
    }, []);

    const openDetail = (id) => {
        setDetailId(id);
        setDetail(null);
        setDetailError('');
        setDocError('');
        setDocFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        loadDetail(id);
    };

    const closeDetail = () => {
        setDetailId(null);
        setDetail(null);
        setDetailError('');
    };

    const openCreate = () => {
        setEditing(null);
        setForm({ ...EMPTY_FORM, intake: DEFAULT_INTAKES[0] });
        setFormError('');
        setFormOpen(true);
    };

    const openEdit = (applicant) => {
        if (!applicant) return;
        setEditing(applicant);
        setForm({
            full_name: applicant.full_name || '',
            email: applicant.email || '',
            phone: applicant.phone || '',
            gender: applicant.gender || '',
            dob: applicant.dob ? String(applicant.dob).slice(0, 10) : '',
            programme_id: applicant.programme_id || '',
            programme_name: applicant.programme_name || '',
            intake: applicant.intake || '',
            registration_type: applicant.registration_type || 'Diploma',
            prior_school: applicant.prior_school || '',
            prior_qualification: applicant.prior_qualification || '',
            guardian_name: applicant.guardian_name || '',
            guardian_phone: applicant.guardian_phone || '',
            address: applicant.address || '',
            source: applicant.source || 'Walk-in',
            notes: applicant.notes || '',
        });
        setFormError('');
        setFormOpen(true);
    };

    const setField = (key, value) => setForm(f => ({ ...f, [key]: value }));

    const handleSave = async (e) => {
        e.preventDefault();
        setFormError('');
        if (!form.full_name.trim()) return setFormError('Full name is required.');
        if (!form.email.trim()) return setFormError('Email address is required.');
        if (!form.programme_id && !form.programme_name.trim()) return setFormError('Select a programme.');

        setSaving(true);
        try {
            if (editing) {
                await applicantAPI.update(editing.id, form);
                if (detailId === editing.id) await loadDetail(editing.id);
            } else {
                await applicantAPI.create(form);
                setStatusFilter('');
                setIntakeFilter('');
                setSearch('');
                setPage(1);
            }
            setFormOpen(false);
            refresh();
        } catch (err) {
            setFormError(err.response?.data?.error || 'Could not save the application.');
        } finally {
            setSaving(false);
        }
    };

    const changeStatus = async (status) => {
        if (!detail) return;
        if (['Rejected', 'Withdrawn'].includes(status)) {
            const ok = window.confirm(`Mark application ${detail.applicant_number} as ${status}?`);
            if (!ok) return;
        }
        setActionBusy(true);
        try {
            const { data } = await applicantAPI.updateStatus(detail.id, status, statusNote.trim() || undefined);
            setDetail(d => ({ ...d, ...data.applicant, documents: d?.documents || [] }));
            setStatusNote('');
            refresh();
        } catch (err) {
            alert(err.response?.data?.error || 'Status change failed.');
        } finally {
            setActionBusy(false);
        }
    };

    const removeApplicant = async () => {
        if (!detail) return;
        if (!window.confirm(`Delete application ${detail.applicant_number}? This cannot be undone.`)) return;
        setActionBusy(true);
        try {
            await applicantAPI.remove(detail.id);
            closeDetail();
            refresh();
        } catch (err) {
            alert(err.response?.data?.error || 'Delete failed.');
        } finally {
            setActionBusy(false);
        }
    };

    const loadDocuments = async () => {
        if (!detail) return;
        try {
            const { data } = await applicantAPI.listDocuments(detail.id);
            setDetail(d => ({ ...d, documents: data.documents || [] }));
        } catch (err) {
            setDocError(err.response?.data?.error || 'Could not refresh documents.');
        }
    };

    const handleUpload = async () => {
        if (!detail) return;
        setDocError('');
        if (!docFile) return setDocError('Choose a file to upload.');
        if (docFile.size > maxDocMb * 1024 * 1024) {
            return setDocError(`This file is larger than the ${maxDocMb} MB limit.`);
        }
        setDocBusy(true);
        try {
            const fd = new FormData();
            fd.append('doc_type', docType || 'Supporting Document');
            fd.append('file', docFile);
            await applicantAPI.uploadDocument(detail.id, fd);
            setDocFile(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
            await loadDocuments();
            refresh();
        } catch (err) {
            setDocError(err.response?.data?.error || 'Upload failed.');
        } finally {
            setDocBusy(false);
        }
    };

    const handleDownload = async (doc) => {
        try {
            const { data } = await applicantAPI.downloadDocument(detail.id, doc.id);
            const url = URL.createObjectURL(data);
            const a = document.createElement('a');
            a.href = url;
            a.download = doc.filename || 'document';
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch {
            alert('Download failed.');
        }
    };

    const toggleVerified = async (doc) => {
        try {
            await applicantAPI.verifyDocument(detail.id, doc.id, !doc.verified);
            await loadDocuments();
        } catch (err) {
            setDocError(err.response?.data?.error || 'Could not update verification.');
        }
    };

    const removeDocument = async (doc) => {
        if (!window.confirm(`Delete "${doc.filename || doc.doc_type}"?`)) return;
        try {
            await applicantAPI.deleteDocument(detail.id, doc.id);
            await loadDocuments();
        } catch (err) {
            setDocError(err.response?.data?.error || 'Could not delete the document.');
        }
    };

    const start = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
    const end = Math.min(pagination.total, (pagination.page - 1) * pagination.limit + rows.length);
    const uploadedTypes = new Set((detail?.documents || []).map(d => d.doc_type));
    const nextStatuses = detail ? (NEXT_STATUS[detail.status] || []) : [];

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
                <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.25em] text-maroon/50">Admissions Office</p>
                    <h1 className="text-2xl font-black text-gray-800 uppercase tracking-tighter">Admissions</h1>
                    <p className="text-sm text-gray-400 font-medium">
                        Review applications and move candidates from submission to offer.
                        {stats && <span className="text-gray-300"> · {stats.total} total · {stats.thisMonth} this month</span>}
                    </p>
                </div>
                <button
                    onClick={openCreate}
                    className="w-full sm:w-auto justify-center bg-maroon text-white px-4 py-3 rounded-xl flex items-center gap-2 hover:bg-maroon-dark transition-all font-bold text-[10px] uppercase tracking-widest shadow-sm"
                >
                    <Plus className="w-4 h-4" /> New Application
                </button>
            </div>

            {/* Pipeline cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
                {PIPELINE.map(status => (
                    <button
                        key={status}
                        onClick={() => { setStatusFilter(f => f === status ? '' : status); setPage(1); }}
                        className={`text-left bg-white p-4 rounded-2xl border shadow-sm transition-all ${statusFilter === status ? 'border-maroon/30 ring-2 ring-maroon/10' : 'border-gray-100 hover:-translate-y-0.5'}`}
                    >
                        <div className="flex items-center justify-between">
                            <p className="text-[8px] font-black uppercase tracking-widest text-gray-400">{status}</p>
                            <span className={`w-2 h-2 rounded-full ${STATUS_DOTS[status]}`} />
                        </div>
                        <p className="text-2xl font-black text-gray-800 mt-2">
                            {stats?.byStatus ? (stats.byStatus[status] ?? 0) : '—'}
                        </p>
                    </button>
                ))}
            </div>

            {/* Filters */}
            <div className="bg-white p-3 sm:p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search by name, email, phone or application number…"
                        className="w-full pl-11 pr-10 py-3 bg-gray-50/50 border border-gray-100 rounded-xl text-sm font-medium text-gray-700 placeholder-gray-300 outline-none focus:border-maroon/20 focus:ring-4 focus:ring-maroon/5 transition-all"
                    />
                    {search && (
                        <button
                            onClick={() => setSearch('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-gray-700 rounded-full hover:bg-gray-200 transition-all"
                            aria-label="Clear search"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
                <select
                    value={statusFilter}
                    onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                    className="bg-gray-50/50 border border-gray-100 rounded-xl px-4 py-3 text-sm font-bold text-gray-700 outline-none"
                >
                    <option value="">All statuses</option>
                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <select
                    value={intakeFilter}
                    onChange={(e) => { setIntakeFilter(e.target.value); setPage(1); }}
                    className="bg-gray-50/50 border border-gray-100 rounded-xl px-4 py-3 text-sm font-bold text-gray-700 outline-none"
                >
                    <option value="">All intakes</option>
                    {intakeOptions.map(i => <option key={i} value={i}>{i}</option>)}
                </select>
                <button
                    onClick={refresh}
                    title="Refresh"
                    className="p-3 rounded-xl border border-gray-100 bg-gray-50/50 text-gray-400 hover:text-maroon transition-all"
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {listError && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-100 text-red-600 rounded-xl px-4 py-3 text-xs font-bold">
                    <AlertTriangle className="w-4 h-4 shrink-0" /> {listError}
                </div>
            )}

            {/* Table */}
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left min-w-[680px]">
                        <thead>
                            <tr className="bg-gray-50/60 border-b border-gray-100">
                                <th className="px-4 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest">Applicant</th>
                                <th className="px-4 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest hidden md:table-cell">Programme</th>
                                <th className="px-4 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest hidden lg:table-cell">Intake</th>
                                <th className="px-4 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest hidden xl:table-cell">Source</th>
                                <th className="px-4 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest hidden sm:table-cell">Submitted</th>
                                <th className="px-4 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest">Status</th>
                                <th className="px-4 py-4" />
                            </tr>
                        </thead>
                        <tbody>
                            {loading && rows.length === 0 ? (
                                [...Array(5)].map((_, i) => (
                                    <tr key={i} className="border-b border-gray-50">
                                        <td className="px-4 py-4" colSpan={7}>
                                            <div className="h-9 bg-gray-50 rounded-xl animate-pulse" />
                                        </td>
                                    </tr>
                                ))
                            ) : rows.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-16 text-center">
                                        <UserPlus className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                                        <p className="text-sm font-black text-gray-500 uppercase tracking-wide">No applications found</p>
                                        <p className="text-[10px] text-gray-400 font-medium mt-1">
                                            {query || statusFilter || intakeFilter ? 'Adjust the filters or search term.' : 'Create the first application to start the pipeline.'}
                                        </p>
                                    </td>
                                </tr>
                            ) : rows.map(a => (
                                <tr
                                    key={a.id}
                                    onClick={() => openDetail(a.id)}
                                    className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60 transition-colors cursor-pointer"
                                >
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-xl bg-maroon/5 border border-maroon/10 flex items-center justify-center text-[10px] font-black text-maroon/60 shrink-0">
                                                {initials(a.full_name)}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-[12px] font-black text-gray-800 truncate">{a.full_name}</p>
                                                <p className="text-[9px] font-mono text-gray-400 truncate">{a.applicant_number} · {a.email}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 hidden md:table-cell">
                                        <p className="text-[11px] font-semibold text-gray-600 truncate max-w-[220px]">{a.programme_name || '—'}</p>
                                        <p className="text-[8px] font-black uppercase tracking-widest text-gray-300">{a.registration_type || ''}</p>
                                    </td>
                                    <td className="px-4 py-3 hidden lg:table-cell text-[11px] font-semibold text-gray-500">{a.intake || '—'}</td>
                                    <td className="px-4 py-3 hidden xl:table-cell text-[10px] font-bold text-gray-400 uppercase tracking-wide">{a.source || '—'}</td>
                                    <td className="px-4 py-3 hidden sm:table-cell text-[10px] font-semibold text-gray-500">{fmtDate(a.submitted_at)}</td>
                                    <td className="px-4 py-3"><StatusPill status={a.status} /></td>
                                    <td className="px-4 py-3 text-right">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); openDetail(a.id); }}
                                            className="text-[9px] font-black uppercase tracking-widest text-maroon/70 hover:text-maroon px-2 py-1"
                                        >
                                            View
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-50">
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                        Showing {start}–{end} of {pagination.total}
                    </p>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={pagination.page <= 1}
                            className="p-2 rounded-lg border border-gray-100 text-gray-500 disabled:opacity-30 hover:bg-gray-50 transition-all"
                            aria-label="Previous page"
                        >
                            <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-[10px] font-black text-gray-500">
                            {pagination.page} / {Math.max(1, pagination.totalPages)}
                        </span>
                        <button
                            onClick={() => setPage(p => p + 1)}
                            disabled={pagination.page >= pagination.totalPages}
                            className="p-2 rounded-lg border border-gray-100 text-gray-500 disabled:opacity-30 hover:bg-gray-50 transition-all"
                            aria-label="Next page"
                        >
                            <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Create / edit modal */}
            {formOpen && (
                <Modal onClose={() => setFormOpen(false)}>
                    <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-gray-100">
                        <div>
                            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-maroon/50">{editing ? 'Update record' : 'Walk-in / phone application'}</p>
                            <h2 className="text-sm font-black text-gray-800 uppercase tracking-wide">{editing ? `Edit ${editing.applicant_number}` : 'New Application'}</h2>
                        </div>
                        <button onClick={() => setFormOpen(false)} className="p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                    <form onSubmit={handleSave} className="overflow-y-auto">
                        <div className="p-5 sm:p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="sm:col-span-2">
                                <label className={LABEL} htmlFor="ad-full-name">Full name *</label>
                                <input id="ad-full-name" className={FIELD} value={form.full_name} onChange={e => setField('full_name', e.target.value)} placeholder="Applicant full name" />
                            </div>
                            <div>
                                <label className={LABEL} htmlFor="ad-email">Email *</label>
                                <input id="ad-email" type="email" className={FIELD} value={form.email} onChange={e => setField('email', e.target.value)} placeholder="name@example.com" />
                            </div>
                            <div>
                                <label className={LABEL} htmlFor="ad-phone">Phone</label>
                                <input id="ad-phone" className={FIELD} value={form.phone} onChange={e => setField('phone', e.target.value)} placeholder="+254 …" />
                            </div>
                            <div>
                                <label className={LABEL} htmlFor="ad-gender">Gender</label>
                                <select id="ad-gender" className={FIELD} value={form.gender} onChange={e => setField('gender', e.target.value)}>
                                    <option value="">Not specified</option>
                                    {GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className={LABEL} htmlFor="ad-dob">Date of birth</label>
                                <input id="ad-dob" type="date" className={FIELD} value={form.dob} onChange={e => setField('dob', e.target.value)} />
                            </div>
                            <div>
                                <label className={LABEL} htmlFor="ad-programme">Programme *</label>
                                <select id="ad-programme" className={FIELD} value={form.programme_id} onChange={e => setField('programme_id', e.target.value)}>
                                    <option value="">Select a programme</option>
                                    {programmeOptions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className={LABEL} htmlFor="ad-registration">Registration type</label>
                                <select id="ad-registration" className={FIELD} value={form.registration_type} onChange={e => setField('registration_type', e.target.value)}>
                                    {REGISTRATION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className={LABEL} htmlFor="ad-intake">Intake</label>
                                <select id="ad-intake" className={FIELD} value={form.intake} onChange={e => setField('intake', e.target.value)}>
                                    <option value="">Not assigned</option>
                                    {intakeOptions.map(i => <option key={i} value={i}>{i}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className={LABEL} htmlFor="ad-source">Source</label>
                                <select id="ad-source" className={FIELD} value={form.source} onChange={e => setField('source', e.target.value)}>
                                    {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className={LABEL} htmlFor="ad-prior-school">Previous school</label>
                                <input id="ad-prior-school" className={FIELD} value={form.prior_school} onChange={e => setField('prior_school', e.target.value)} placeholder="School attended" />
                            </div>
                            <div>
                                <label className={LABEL} htmlFor="ad-prior-qualification">Previous qualification</label>
                                <input id="ad-prior-qualification" className={FIELD} value={form.prior_qualification} onChange={e => setField('prior_qualification', e.target.value)} placeholder="e.g. KCSE C+" />
                            </div>
                            <div>
                                <label className={LABEL} htmlFor="ad-guardian-name">Guardian name</label>
                                <input id="ad-guardian-name" className={FIELD} value={form.guardian_name} onChange={e => setField('guardian_name', e.target.value)} placeholder="Parent or guardian" />
                            </div>
                            <div>
                                <label className={LABEL} htmlFor="ad-guardian-phone">Guardian phone</label>
                                <input id="ad-guardian-phone" className={FIELD} value={form.guardian_phone} onChange={e => setField('guardian_phone', e.target.value)} placeholder="+254 …" />
                            </div>
                            <div className="sm:col-span-2">
                                <label className={LABEL} htmlFor="ad-address">Address</label>
                                <input id="ad-address" className={FIELD} value={form.address} onChange={e => setField('address', e.target.value)} placeholder="Residential address" />
                            </div>
                            <div className="sm:col-span-2">
                                <label className={LABEL} htmlFor="ad-notes">Notes</label>
                                <textarea id="ad-notes" rows={2} className={`${FIELD} resize-none`} value={form.notes} onChange={e => setField('notes', e.target.value)} placeholder="Internal review notes…" />
                            </div>
                            {formError && (
                                <p className="sm:col-span-2 flex items-center gap-2 text-[10px] font-bold text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {formError}
                                </p>
                            )}
                        </div>
                        <div className="sticky bottom-0 bg-white border-t border-gray-100 px-5 sm:px-6 py-4 flex justify-end gap-2">
                            <button type="button" onClick={() => setFormOpen(false)} className="px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-gray-500 hover:bg-gray-100 transition-all">
                                Cancel
                            </button>
                            <button type="submit" disabled={saving} className="px-5 py-2.5 rounded-xl bg-maroon text-white text-[10px] font-black uppercase tracking-widest hover:bg-maroon-dark disabled:opacity-50 transition-all flex items-center gap-2">
                                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                                {editing ? 'Save changes' : 'Create application'}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}

            {/* Detail modal */}
            {detailId && (
                <Modal onClose={closeDetail} width="max-w-4xl">
                    <div className="flex items-start justify-between gap-3 px-5 sm:px-6 py-4 border-b border-gray-100">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-11 h-11 rounded-2xl bg-maroon/5 border border-maroon/10 flex items-center justify-center text-sm font-black text-maroon/60 shrink-0">
                                {detail ? initials(detail.full_name) : '—'}
                            </div>
                            <div className="min-w-0">
                                <p className="text-[9px] font-mono text-gray-400">{detail?.applicant_number || 'Loading…'}</p>
                                <h2 className="text-sm sm:text-base font-black text-gray-800 truncate">{detail?.full_name || 'Application'}</h2>
                            </div>
                            {detail && <StatusPill status={detail.status} />}
                        </div>
                        <button onClick={closeDetail} className="p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all shrink-0">
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="overflow-y-auto flex-1 p-5 sm:p-6 space-y-5">
                        {detailLoading && !detail && (
                            <div className="flex items-center justify-center py-16 text-gray-400">
                                <Loader2 className="w-6 h-6 animate-spin" />
                            </div>
                        )}
                        {detailError && (
                            <div className="flex items-center gap-2 bg-red-50 border border-red-100 text-red-600 rounded-xl px-4 py-3 text-xs font-bold">
                                <AlertTriangle className="w-4 h-4 shrink-0" /> {detailError}
                            </div>
                        )}

                        {detail && (
                            <>
                                {detail.status === 'Offered' && (
                                    <div className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${detail.offer_expired ? 'bg-red-50 border-red-100 text-red-600' : 'bg-yellow-50 border-yellow-200 text-yellow-800'}`}>
                                        <Clock className="w-4 h-4 shrink-0" />
                                        <p className="text-[10px] font-bold">
                                            {detail.offer_expired
                                                ? `The offer expired on ${fmtDate(detail.offer_expires_at)}.`
                                                : `Offer sent ${fmtDate(detail.offered_at)} · expires ${fmtDate(detail.offer_expires_at)}.`}
                                        </p>
                                    </div>
                                )}

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                                    <DetailField icon={Mail} label="Email" value={detail.email} />
                                    <DetailField icon={Phone} label="Phone" value={detail.phone} />
                                    <DetailField icon={GraduationCap} label="Programme" value={detail.programme_name} />
                                    <DetailField icon={CalendarDays} label="Intake" value={detail.intake} />
                                    <DetailField icon={User} label="Registration type" value={detail.registration_type} />
                                    <DetailField icon={Clock} label="Submitted" value={fmtDate(detail.submitted_at)} />
                                    <DetailField icon={CalendarDays} label="Date of birth" value={fmtDate(detail.dob)} />
                                    <DetailField icon={User} label="Gender" value={detail.gender} />
                                    <DetailField icon={User} label="Guardian" value={detail.guardian_name} />
                                    <DetailField icon={Phone} label="Guardian phone" value={detail.guardian_phone} />
                                    <DetailField icon={GraduationCap} label="Previous school" value={detail.prior_school} />
                                    <DetailField icon={GraduationCap} label="Previous qualification" value={detail.prior_qualification} />
                                    <DetailField icon={MapPin} label="Address" value={detail.address} />
                                    <DetailField icon={User} label="Source" value={detail.source} />
                                    {detail.reviewer_name && <DetailField icon={User} label="Reviewer" value={detail.reviewer_name} />}
                                </div>

                                {detail.notes && (
                                    <div className="bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3">
                                        <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Notes</p>
                                        <p className="text-[11px] font-medium text-gray-600 whitespace-pre-wrap">{detail.notes}</p>
                                    </div>
                                )}

                                {/* Documents */}
                                <div className="border border-gray-100 rounded-2xl overflow-hidden">
                                    <div className="px-4 py-3 bg-gray-50/60 flex items-center justify-between">
                                        <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Supporting documents</p>
                                        <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">
                                            {detail.documents?.length || 0} uploaded · max {maxDocMb} MB each
                                        </p>
                                    </div>

                                    {requiredDocs.length > 0 && (
                                        <div className="px-4 py-3 flex flex-wrap gap-2 border-b border-gray-50">
                                            {requiredDocs.map(req => {
                                                const done = uploadedTypes.has(req);
                                                return (
                                                    <span key={req} className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-wider border ${done ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-gray-50 text-gray-400 border-gray-100'}`}>
                                                        {done ? <CheckCircle2 className="w-2.5 h-2.5" /> : <Circle className="w-2.5 h-2.5" />}
                                                        {req}
                                                    </span>
                                                );
                                            })}
                                        </div>
                                    )}

                                    <div className="px-4 py-3 border-b border-gray-50 flex flex-col sm:flex-row gap-2">
                                        <select value={docType} onChange={e => setDocType(e.target.value)} className={`${FIELD} sm:w-56`} aria-label="Document type">
                                            {[...new Set([...requiredDocs, 'Supporting Document', 'Other'])].map(t => (
                                                <option key={t} value={t}>{t}</option>
                                            ))}
                                        </select>
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            onChange={e => setDocFile(e.target.files?.[0] || null)}
                                            className="flex-1 text-[10px] font-semibold text-gray-500 file:mr-3 file:px-3 file:py-2 file:rounded-lg file:border-0 file:bg-maroon/5 file:text-maroon file:text-[9px] file:font-black file:uppercase file:tracking-widest hover:file:bg-maroon/10"
                                            aria-label="Document file"
                                        />
                                        <button
                                            onClick={handleUpload}
                                            disabled={docBusy || !docFile}
                                            className="px-4 py-2.5 rounded-xl bg-maroon text-white text-[9px] font-black uppercase tracking-widest disabled:opacity-40 hover:bg-maroon-dark transition-all flex items-center justify-center gap-1.5"
                                        >
                                            {docBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                                            Upload
                                        </button>
                                    </div>

                                    {docError && (
                                        <p className="px-4 py-2 text-[9px] font-bold text-red-600 bg-red-50 border-b border-red-100">{docError}</p>
                                    )}

                                    <div className="divide-y divide-gray-50">
                                        {(detail.documents || []).length === 0 ? (
                                            <p className="px-4 py-6 text-center text-[10px] font-semibold text-gray-300">No documents uploaded yet.</p>
                                        ) : detail.documents.map(doc => (
                                            <div key={doc.id} className="px-4 py-3 flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-maroon/5 border border-maroon/10 flex items-center justify-center shrink-0">
                                                    <FileText className="w-3.5 h-3.5 text-maroon/50" />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-[11px] font-black text-gray-700 truncate">{doc.doc_type}</p>
                                                    <p className="text-[9px] text-gray-400 font-medium truncate">
                                                        {doc.filename || 'file'} · {fmtSize(doc.file_size)} · {fmtDate(doc.uploaded_at)}
                                                    </p>
                                                </div>
                                                <span className={`hidden sm:inline-flex px-2 py-0.5 rounded-full border text-[8px] font-black uppercase tracking-widest ${doc.verified ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                                                    {doc.verified ? 'Verified' : 'Pending'}
                                                </span>
                                                <button onClick={() => toggleVerified(doc)} title={doc.verified ? 'Mark as pending' : 'Mark as verified'} className="p-1.5 rounded-lg text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all">
                                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                                </button>
                                                <button onClick={() => handleDownload(doc)} title="Download" className="p-1.5 rounded-lg text-gray-400 hover:text-maroon hover:bg-maroon/5 transition-all">
                                                    <Download className="w-3.5 h-3.5" />
                                                </button>
                                                <button onClick={() => removeDocument(doc)} title="Delete" className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-all">
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Pipeline actions */}
                                <div className="border border-gray-100 rounded-2xl p-4 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Move application</p>
                                        <p className="text-[8px] font-bold text-gray-300 uppercase tracking-widest">Current: {detail.status}</p>
                                    </div>
                                    {detail.status === 'Enrolled' || detail.status === 'Accepted' ? (
                                        <p className="text-[10px] font-semibold text-gray-400">
                                            {detail.status === 'Accepted'
                                                ? 'Accepted offers become Enrolled through the student conversion flow (coming next).'
                                                : 'This applicant has been enrolled.'}
                                        </p>
                                    ) : null}
                                    <input
                                        value={statusNote}
                                        onChange={e => setStatusNote(e.target.value)}
                                        placeholder="Review note (optional, saved with the status change)"
                                        className={FIELD}
                                    />
                                    <div className="flex flex-wrap gap-2">
                                        {nextStatuses.map(status => {
                                            const destructive = ['Rejected', 'Withdrawn'].includes(status);
                                            const primary = ['Under Review', 'Shortlisted', 'Offered', 'Accepted'].includes(status);
                                            return (
                                                <button
                                                    key={status}
                                                    onClick={() => changeStatus(status)}
                                                    disabled={actionBusy}
                                                    className={`px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all disabled:opacity-50 ${primary
                                                        ? 'bg-maroon text-white hover:bg-maroon-dark'
                                                        : destructive
                                                            ? 'border border-red-100 text-red-600 bg-red-50/50 hover:bg-red-50'
                                                            : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                                                >
                                                    {status === 'Under Review' ? 'Start review' : `Mark ${status}`}
                                                </button>
                                            );
                                        })}
                                        {nextStatuses.length === 0 && detail.status !== 'Accepted' && (
                                            <p className="text-[10px] font-semibold text-gray-400">No further manual transitions available.</p>
                                        )}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    <div className="border-t border-gray-100 px-5 sm:px-6 py-4 flex items-center justify-between gap-2">
                        <div>
                            {detail && !['Offered', 'Accepted', 'Enrolled'].includes(detail.status) && !detail.converted_student_id && (
                                <button
                                    onClick={removeApplicant}
                                    disabled={actionBusy}
                                    className="px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest text-red-500 hover:bg-red-50 transition-all inline-flex items-center gap-1.5"
                                >
                                    <Trash2 className="w-3.5 h-3.5" /> Delete
                                </button>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <button onClick={closeDetail} className="px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-gray-500 hover:bg-gray-100 transition-all">
                                Close
                            </button>
                            {detail && (
                                <button
                                    onClick={() => { closeDetail(); openEdit(detail); }}
                                    className="px-4 py-2.5 rounded-xl border border-maroon/20 text-maroon text-[10px] font-black uppercase tracking-widest hover:bg-maroon/5 transition-all inline-flex items-center gap-1.5"
                                >
                                    <Pencil className="w-3.5 h-3.5" /> Edit details
                                </button>
                            )}
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
}
