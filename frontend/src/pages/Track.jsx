import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { publicAPI } from '../services/api';
import {
    AlertTriangle, BookOpen, CalendarDays, CheckCircle2, Clock, FileText, GraduationCap,
    Loader2, Mail, Phone, Search, ShieldCheck, Trash2, Upload, User, XCircle,
} from 'lucide-react';

const FIELD = 'w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold text-gray-700 placeholder-gray-300 outline-none focus:ring-4 focus:ring-maroon/10 focus:border-maroon/40 transition-all';
const LABEL = 'text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1.5 block';

const PIPELINE = ['Submitted', 'Under Review', 'Shortlisted', 'Offered', 'Accepted', 'Enrolled'];
const TERMINAL = ['Rejected', 'Withdrawn'];

const STATUS_NOTE = {
    'Submitted': 'Your application has been received and is queued for review.',
    'Under Review': 'The admissions office is reviewing your application.',
    'Shortlisted': 'You have been shortlisted. Keep your documents ready.',
    'Offered': 'An offer has been made. Check your email for the details.',
    'Accepted': 'Your acceptance is recorded. Enrolment details will follow.',
    'Enrolled': 'You are enrolled at Beautex Technical Training College.',
    'Rejected': 'This application was not successful.',
    'Withdrawn': 'This application was withdrawn.',
};

function fmtDate(v) {
    if (!v) return '—';
    const d = new Date(v);
    if (isNaN(d.getTime())) return String(v);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtSize(bytes) {
    const n = Number(bytes) || 0;
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export default function Track() {
    const [searchParams] = useSearchParams();
    const [form, setForm] = useState({
        applicant_number: searchParams.get('number') || '',
        email: '',
    });
    const [looking, setLooking] = useState(false);
    const [lookupError, setLookupError] = useState('');
    const [portal, setPortal] = useState(null);

    const [docType, setDocType] = useState('');
    const [file, setFile] = useState(null);
    const [docBusy, setDocBusy] = useState(false);
    const [docError, setDocError] = useState('');
    const [docNotice, setDocNotice] = useState('');
    const [deletingId, setDeletingId] = useState(null);

    useEffect(() => {
        if (portal) setDocType(portal.required_documents?.[0] || 'Supporting Document');
    }, [portal?.access_token]);

    const applicant = portal?.applicant;
    const documents = portal?.documents || [];
    const uploadedTypes = useMemo(() => new Set(documents.map(d => d.doc_type)), [documents]);
    const canUpload = !!applicant?.can_upload;

    const setField = (key, value) => setForm(f => ({ ...f, [key]: value }));

    const handleLookup = async (e) => {
        e?.preventDefault();
        setLookupError('');
        setDocError('');
        setDocNotice('');
        if (!form.applicant_number.trim()) return setLookupError('Enter your application number.');
        if (!form.email.trim()) return setLookupError('Enter the email you used to apply.');

        setLooking(true);
        try {
            const { data } = await publicAPI.trackApplication({
                applicant_number: form.applicant_number.trim(),
                email: form.email.trim(),
            });
            setPortal(data);
            setFile(null);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (err) {
            setLookupError(err.response?.data?.error || 'Could not look up the application. Please try again.');
        } finally {
            setLooking(false);
        }
    };

    const handleUpload = async () => {
        if (!portal || !file) return;
        setDocError('');
        setDocNotice('');
        if (file.size > portal.max_document_mb * 1024 * 1024) {
            return setDocError(`This file is larger than the ${portal.max_document_mb} MB limit.`);
        }
        setDocBusy(true);
        try {
            const fd = new FormData();
            fd.append('doc_type', docType || 'Supporting Document');
            fd.append('file', file);
            const { data } = await publicAPI.uploadDocument(portal.access_token, fd);
            setPortal(p => ({ ...p, documents: [data.document, ...p.documents] }));
            setFile(null);
            setDocNotice('Document uploaded. The admissions office will verify it during review.');
        } catch (err) {
            if (err.response?.status === 401) {
                setDocError('Your secure session expired. Look up your application again to continue.');
            } else {
                setDocError(err.response?.data?.error || 'Upload failed. Please try again.');
            }
        } finally {
            setDocBusy(false);
        }
    };

    const handleDelete = async (doc) => {
        if (!portal) return;
        if (!window.confirm(`Remove "${doc.filename || doc.doc_type}"?`)) return;
        setDocError('');
        setDocNotice('');
        setDeletingId(doc.id);
        try {
            await publicAPI.deleteDocument(portal.access_token, doc.id);
            setPortal(p => ({ ...p, documents: p.documents.filter(d => d.id !== doc.id) }));
            setDocNotice('Document removed.');
        } catch (err) {
            setDocError(err.response?.data?.error || 'Could not remove the document.');
        } finally {
            setDeletingId(null);
        }
    };

    const statusIndex = applicant ? PIPELINE.indexOf(applicant.status) : -1;
    const isTerminal = applicant ? TERMINAL.includes(applicant.status) : false;

    return (
        <div className="min-h-screen bg-[#f7f4ee]">
            <header
                className="relative overflow-hidden pb-16 pt-8 sm:pt-10"
                style={{ background: 'linear-gradient(165deg, #5c0000 0%, #800000 45%, #6b0000 100%)' }}
            >
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute -top-24 -right-16 w-72 h-72 rounded-full opacity-10"
                        style={{ background: 'radial-gradient(circle, #FFD700 0%, transparent 70%)' }} />
                    <div className="absolute -bottom-28 -left-20 w-72 h-72 rounded-full opacity-[0.07]"
                        style={{ background: 'radial-gradient(circle, #FFD700 0%, transparent 70%)' }} />
                </div>
                <div className="relative max-w-3xl mx-auto px-4">
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-white rounded-2xl overflow-hidden ring-2 ring-white/20 shadow-xl shrink-0">
                                <img src="/app-icon-v2.png" alt="Beautex" className="w-full h-full object-cover" />
                            </div>
                            <div>
                                <p className="text-sm font-black text-white uppercase tracking-[0.18em] leading-tight">Beautex</p>
                                <p className="text-[8px] sm:text-[9px] font-bold uppercase tracking-[0.14em]" style={{ color: '#FFD700' }}>
                                    Technical Training College
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Link to="/apply" className="text-[9px] font-black uppercase tracking-widest text-white/70 hover:text-white border border-white/15 hover:border-white/40 rounded-xl px-3 py-2 transition-all">
                                Apply
                            </Link>
                            <Link to="/login" className="text-[9px] font-black uppercase tracking-widest text-white/50 hover:text-white border border-white/10 hover:border-white/30 rounded-xl px-3 py-2 transition-all">
                                Staff
                            </Link>
                        </div>
                    </div>

                    <div className="mt-8 sm:mt-10 max-w-xl">
                        <p className="text-[9px] font-black uppercase tracking-[0.3em]" style={{ color: '#FFD700' }}>Applicant Portal</p>
                        <h1 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tight mt-2">
                            Track your application
                        </h1>
                        <p className="text-sm text-white/60 font-medium mt-2 leading-relaxed">
                            Enter your application number and the email address you applied with to see your progress and upload documents.
                        </p>
                    </div>
                </div>
            </header>

            <main className="max-w-3xl mx-auto px-4 -mt-10 pb-16 space-y-5">
                {!portal ? (
                    <div className="bg-white rounded-3xl border border-maroon/10 shadow-2xl overflow-hidden">
                        <form onSubmit={handleLookup} className="p-6 sm:p-8">
                            <div className="flex items-center gap-2 mb-5">
                                <div className="w-9 h-9 rounded-xl bg-maroon/5 border border-maroon/10 flex items-center justify-center">
                                    <Search className="w-4 h-4 text-maroon/60" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-gray-700 uppercase tracking-widest">Find your application</p>
                                    <p className="text-[10px] font-semibold text-gray-400">Use the details from your confirmation email.</p>
                                </div>
                            </div>

                            {lookupError && (
                                <div className="mb-4 flex items-start gap-2.5 bg-red-50 border border-red-100 text-red-600 rounded-xl px-4 py-3 text-[11px] font-bold">
                                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {lookupError}
                                </div>
                            )}

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className={LABEL} htmlFor="applicant_number">Application number</label>
                                    <input
                                        id="applicant_number" className={`${FIELD} font-mono`} maxLength={40}
                                        value={form.applicant_number}
                                        onChange={e => setField('applicant_number', e.target.value)}
                                        placeholder="APP/2026/001"
                                    />
                                </div>
                                <div>
                                    <label className={LABEL} htmlFor="track_email">Email address</label>
                                    <input
                                        id="track_email" type="email" className={FIELD} maxLength={254}
                                        value={form.email}
                                        onChange={e => setField('email', e.target.value)}
                                        placeholder="name@example.com"
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={looking}
                                className="mt-5 w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-maroon text-white text-[10px] font-black uppercase tracking-widest hover:bg-maroon-dark disabled:opacity-50 transition-all shadow-sm"
                            >
                                {looking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                                {looking ? 'Checking…' : 'Track application'}
                            </button>

                            <p className="text-[10px] font-semibold text-gray-400 mt-5">
                                Haven't applied yet? <Link to="/apply" className="text-maroon font-black hover:underline">Start an application</Link>.
                            </p>
                        </form>
                    </div>
                ) : (
                    <>
                        {/* Status card */}
                        <div className="bg-white rounded-3xl border border-maroon/10 shadow-2xl overflow-hidden">
                            <div className="px-5 sm:px-8 pt-6 pb-5 border-b border-gray-100 flex flex-wrap items-start justify-between gap-3">
                                <div>
                                    <p className="text-[9px] font-mono text-gray-400">{applicant.applicant_number}</p>
                                    <h2 className="text-lg font-black text-gray-800 mt-0.5">{applicant.full_name}</h2>
                                    <p className="text-[10px] font-semibold text-gray-400">
                                        {applicant.programme_name} · {applicant.intake}
                                    </p>
                                </div>
                                <StatusPill status={applicant.status} />
                            </div>

                            <div className="px-5 sm:px-8 py-5">
                                {applicant.status === 'Offered' && applicant.offer_expires_at && (
                                    <div className={`mb-5 flex items-center gap-3 rounded-2xl border px-4 py-3 ${applicant.offer_expired ? 'bg-red-50 border-red-100 text-red-600' : 'bg-yellow-50 border-yellow-200 text-yellow-800'}`}>
                                        <Clock className="w-4 h-4 shrink-0" />
                                        <p className="text-[10px] font-bold">
                                            {applicant.offer_expired
                                                ? `Your offer expired on ${fmtDate(applicant.offer_expires_at)}. Contact the admissions office.`
                                                : `Your offer is valid until ${fmtDate(applicant.offer_expires_at)}. Watch your email for acceptance instructions.`}
                                        </p>
                                    </div>
                                )}

                                {isTerminal ? (
                                    <div className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${applicant.status === 'Rejected' ? 'bg-red-50 border-red-100 text-red-600' : 'bg-gray-50 border-gray-100 text-gray-500'}`}>
                                        <XCircle className="w-4 h-4 shrink-0" />
                                        <p className="text-[11px] font-bold">{STATUS_NOTE[applicant.status]}</p>
                                    </div>
                                ) : (
                                    <div>
                                        <div className="flex items-center">
                                            {PIPELINE.map((s, i) => {
                                                const reached = i <= statusIndex;
                                                return (
                                                    <div key={s} className={`flex items-center ${i < PIPELINE.length - 1 ? 'flex-1' : ''}`}>
                                                        <div className="flex flex-col items-center gap-1.5 shrink-0">
                                                            <div className={`w-6 h-6 rounded-full flex items-center justify-center ${reached ? 'bg-maroon text-white' : 'bg-gray-100 text-gray-300'}`}>
                                                                {i < statusIndex ? <CheckCircle2 className="w-3.5 h-3.5" /> : <span className="text-[8px] font-black">{i + 1}</span>}
                                                            </div>
                                                            <span className={`text-[7px] sm:text-[8px] font-black uppercase tracking-wider text-center leading-tight ${reached ? 'text-maroon' : 'text-gray-300'}`}>
                                                                {s}
                                                            </span>
                                                        </div>
                                                        {i < PIPELINE.length - 1 && (
                                                            <div className={`h-px flex-1 mx-1.5 mb-4 ${i < statusIndex ? 'bg-maroon/40' : 'bg-gray-100'}`} />
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        <p className="text-[11px] font-semibold text-gray-500 mt-4 flex items-start gap-2">
                                            <Clock className="w-3.5 h-3.5 text-gray-300 mt-0.5 shrink-0" />
                                            {STATUS_NOTE[applicant.status]}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Details */}
                        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 sm:p-6">
                            <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-4">Application details</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                                <SummaryRow icon={BookOpen} label="Programme" value={applicant.programme_name} />
                                <SummaryRow icon={CalendarDays} label="Intake" value={applicant.intake} />
                                <SummaryRow icon={GraduationCap} label="Registration type" value={applicant.registration_type} />
                                <SummaryRow icon={Clock} label="Submitted" value={fmtDate(applicant.submitted_at)} />
                                <SummaryRow icon={Mail} label="Email" value={applicant.email} />
                                <SummaryRow icon={Phone} label="Phone" value={applicant.phone} />
                            </div>
                        </div>

                        {/* Documents */}
                        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                            <div className="px-5 sm:px-6 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2">
                                <div>
                                    <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Supporting documents</p>
                                    <p className="text-[9px] font-semibold text-gray-400 mt-0.5">
                                        {documents.length} uploaded · up to {portal.max_document_mb} MB each
                                    </p>
                                </div>
                                <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-lg border ${canUpload ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-gray-50 text-gray-400 border-gray-100'}`}>
                                    {canUpload ? 'Uploads open' : 'Read only'}
                                </span>
                            </div>

                            {(portal.required_documents || []).length > 0 && (
                                <div className="px-5 sm:px-6 py-3 flex flex-wrap gap-2 border-b border-gray-50">
                                    {portal.required_documents.map(req => {
                                        const done = uploadedTypes.has(req);
                                        return (
                                            <span key={req} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-wider border ${done ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-gray-50 text-gray-400 border-gray-100'}`}>
                                                {done ? <CheckCircle2 className="w-2.5 h-2.5" /> : <ShieldCheck className="w-2.5 h-2.5" />} {req}
                                            </span>
                                        );
                                    })}
                                </div>
                            )}

                            {canUpload && (
                                <div className="px-5 sm:px-6 py-4 border-b border-gray-50 space-y-2">
                                    <div className="flex flex-col sm:flex-row gap-2">
                                        <select
                                            value={docType}
                                            onChange={e => setDocType(e.target.value)}
                                            className={`${FIELD} sm:w-56`}
                                            aria-label="Document type"
                                        >
                                            {[...new Set([...(portal.required_documents || []), 'Supporting Document', 'Other'])].map(t => (
                                                <option key={t} value={t}>{t}</option>
                                            ))}
                                        </select>
                                        <input
                                            type="file"
                                            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.txt"
                                            onChange={e => setFile(e.target.files?.[0] || null)}
                                            className="flex-1 text-[10px] font-semibold text-gray-500 file:mr-3 file:px-3 file:py-2 file:rounded-lg file:border-0 file:bg-maroon/5 file:text-maroon file:text-[9px] file:font-black file:uppercase file:tracking-widest hover:file:bg-maroon/10"
                                            aria-label="Document file"
                                        />
                                        <button
                                            type="button"
                                            onClick={handleUpload}
                                            disabled={docBusy || !file}
                                            className="px-4 py-2.5 rounded-xl bg-maroon text-white text-[9px] font-black uppercase tracking-widest disabled:opacity-40 hover:bg-maroon-dark transition-all flex items-center justify-center gap-1.5"
                                        >
                                            {docBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />} Upload
                                        </button>
                                    </div>
                                    <p className="text-[9px] font-semibold text-gray-400">PDF, Word, JPEG, PNG, WEBP or TXT.</p>
                                </div>
                            )}

                            {docError && (
                                <p className="px-5 sm:px-6 py-2.5 text-[10px] font-bold text-red-600 bg-red-50 border-b border-red-100">{docError}</p>
                            )}
                            {docNotice && (
                                <p className="px-5 sm:px-6 py-2.5 text-[10px] font-bold text-emerald-600 bg-emerald-50 border-b border-emerald-100">{docNotice}</p>
                            )}

                            <div className="divide-y divide-gray-50">
                                {documents.length === 0 ? (
                                    <p className="px-5 py-8 text-center text-[10px] font-semibold text-gray-300">No documents uploaded yet.</p>
                                ) : documents.map(doc => (
                                    <div key={doc.id} className="px-5 sm:px-6 py-3 flex items-center gap-3">
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
                                        {canUpload && (
                                            <button
                                                type="button"
                                                onClick={() => handleDelete(doc)}
                                                disabled={deletingId === doc.id}
                                                title="Remove document"
                                                className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-all disabled:opacity-40"
                                            >
                                                {deletingId === doc.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-1">
                            <button
                                onClick={() => { setPortal(null); setLookupError(''); setDocError(''); setDocNotice(''); setFile(null); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                                className="text-[9px] font-black uppercase tracking-widest text-gray-400 hover:text-maroon transition-colors"
                            >
                                Look up a different application
                            </button>
                            <Link to="/apply" className="text-[9px] font-black uppercase tracking-widest text-maroon/70 hover:text-maroon">
                                Start a new application
                            </Link>
                        </div>
                    </>
                )}

                <p className="text-center text-[10px] font-bold text-gray-400 uppercase tracking-widest pt-2">
                    © 2026 Beautex Technical Training College
                </p>
            </main>
        </div>
    );
}

function StatusPill({ status }) {
    const styles = {
        'Submitted': 'bg-blue-50 text-blue-600 border-blue-100',
        'Under Review': 'bg-amber-50 text-amber-700 border-amber-100',
        'Shortlisted': 'bg-violet-50 text-violet-600 border-violet-100',
        'Offered': 'bg-yellow-50 text-yellow-700 border-yellow-200',
        'Accepted': 'bg-emerald-50 text-emerald-600 border-emerald-100',
        'Enrolled': 'bg-green-50 text-green-700 border-green-200',
        'Rejected': 'bg-red-50 text-red-600 border-red-100',
        'Withdrawn': 'bg-zinc-100 text-zinc-500 border-zinc-200',
    };
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[8px] font-black uppercase tracking-widest ${styles[status] || styles.Withdrawn}`}>
            {status}
        </span>
    );
}

function SummaryRow({ icon: Icon, label, value }) {
    return (
        <div className="flex items-start gap-2.5 min-w-0">
            <Icon className="w-3.5 h-3.5 text-gray-300 mt-0.5 shrink-0" />
            <div className="min-w-0">
                <p className="text-[8px] font-black uppercase tracking-widest text-gray-400">{label}</p>
                <p className="text-[11px] font-semibold text-gray-700 break-words">{value || '—'}</p>
            </div>
        </div>
    );
}
