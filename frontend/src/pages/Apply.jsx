import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { publicAPI } from '../services/api';
import {
    ArrowLeft, ArrowRight, Check, CheckCircle2, Clock, Copy, Loader2, AlertTriangle,
    Mail, Phone, MapPin, User, BookOpen, GraduationCap, ShieldCheck, Send, Users,
} from 'lucide-react';

const EMPTY_FORM = {
    full_name: '', email: '', phone: '', gender: '', dob: '',
    registration_type: 'Diploma', programme_id: '', intake: '',
    prior_school: '', prior_qualification: '', guardian_name: '', guardian_phone: '',
    address: '', company_website: '',
};

const GENDERS = ['Female', 'Male', 'Other', 'Prefer not to say'];
const STEPS = [
    { label: 'Personal details' },
    { label: 'Programme' },
    { label: 'Review & submit' },
];

const FIELD = 'w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold text-gray-700 placeholder-gray-300 outline-none focus:ring-4 focus:ring-maroon/10 focus:border-maroon/40 transition-all';
const LABEL = 'text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1.5 block';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+()\d\s-]{7,20}$/;

function fmtDate(v) {
    if (!v) return '—';
    const d = new Date(v);
    if (isNaN(d.getTime())) return String(v);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function Apply() {
    const [info, setInfo] = useState(null);
    const [loadingInfo, setLoadingInfo] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [reloadKey, setReloadKey] = useState(0);

    const [step, setStep] = useState(0);
    const [form, setForm] = useState(EMPTY_FORM);
    const [declared, setDeclared] = useState(false);
    const [stepError, setStepError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState('');
    const [result, setResult] = useState(null);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoadingInfo(true);
            setLoadError('');
            try {
                const { data } = await publicAPI.admissionsInfo();
                if (!cancelled) setInfo(data);
            } catch (err) {
                if (!cancelled) setLoadError(err.response?.data?.error || 'Could not load the application form.');
            } finally {
                if (!cancelled) setLoadingInfo(false);
            }
        })();
        return () => { cancelled = true; };
    }, [reloadKey]);

    const programmeGroups = useMemo(() => {
        const groups = {};
        for (const p of info?.programmes || []) {
            const key = p.programme_type || 'Programmes';
            (groups[key] ||= []).push(p);
        }
        return groups;
    }, [info]);

    const selectedProgramme = useMemo(
        () => (info?.programmes || []).find(p => p.id === form.programme_id) || null,
        [info, form.programme_id]
    );

    const setField = (key, value) => setForm(f => ({ ...f, [key]: value }));

    const validateStep = (index) => {
        if (index === 0) {
            if (!form.full_name.trim()) return 'Enter your full name.';
            if (!EMAIL_RE.test(form.email.trim())) return 'Enter a valid email address.';
            if (!PHONE_RE.test(form.phone.trim())) return 'Enter a valid phone number.';
        }
        if (index === 1) {
            if (!form.programme_id) return 'Choose the programme you want to apply for.';
            if (!form.intake) return 'Choose an intake.';
        }
        if (index === 2 && !declared) return 'Please confirm the declaration before submitting.';
        return '';
    };

    const goToStep = (next) => {
        const error = validateStep(step);
        if (error) { setStepError(error); return; }
        setStepError('');
        setStep(next);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (step < 2) { goToStep(step + 1); return; }

        const error = validateStep(2);
        if (error) { setStepError(error); return; }

        setStepError('');
        setSubmitError('');
        setSubmitting(true);
        try {
            const { data } = await publicAPI.submitApplication({
                ...form,
                full_name: form.full_name.trim(),
                email: form.email.trim(),
                phone: form.phone.trim(),
            });
            setResult(data.applicant);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (err) {
            if (err.response?.status === 403) {
                setInfo(i => ({ ...i, open: false }));
            }
            setSubmitError(err.response?.data?.error || 'Could not submit your application. Please try again.');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } finally {
            setSubmitting(false);
        }
    };

    const copyNumber = async () => {
        try {
            await navigator.clipboard.writeText(result.applicant_number);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch { /* clipboard unavailable */ }
    };

    const startAnother = () => {
        setResult(null);
        setForm(EMPTY_FORM);
        setDeclared(false);
        setStep(0);
        setStepError('');
        setSubmitError('');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const today = new Date().toISOString().slice(0, 10);

    return (
        <div className="min-h-screen bg-[#f7f4ee]">
            {/* Header */}
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
                    <div className="flex items-center justify-between gap-4">
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
                            <Link
                                to="/track"
                                className="text-[9px] font-black uppercase tracking-widest text-white/60 hover:text-white border border-white/15 hover:border-white/40 rounded-xl px-3 py-2 transition-all"
                            >
                                Track application
                            </Link>
                            <Link
                                to="/login"
                                className="text-[9px] font-black uppercase tracking-widest text-white/60 hover:text-white border border-white/15 hover:border-white/40 rounded-xl px-3 py-2 transition-all"
                            >
                                Staff sign in
                            </Link>
                        </div>
                    </div>

                    <div className="mt-8 sm:mt-10 max-w-xl">
                        <p className="text-[9px] font-black uppercase tracking-[0.3em]" style={{ color: '#FFD700' }}>Admissions Office</p>
                        <h1 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tight mt-2">
                            Apply to Beautex
                        </h1>
                        <p className="text-sm text-white/60 font-medium mt-2 leading-relaxed">
                            Join our next intake. Complete the form below and our admissions team will review your application.
                        </p>
                    </div>
                </div>
            </header>

            <main className="max-w-3xl mx-auto px-4 -mt-10 pb-16">
                <div className="bg-white rounded-3xl border border-maroon/10 shadow-2xl overflow-hidden">
                    {loadingInfo ? (
                        <div className="flex flex-col items-center justify-center py-24 text-gray-400 gap-3">
                            <Loader2 className="w-7 h-7 animate-spin text-maroon/40" />
                            <p className="text-[10px] font-black uppercase tracking-widest">Loading application form…</p>
                        </div>
                    ) : loadError ? (
                        <div className="p-10 text-center">
                            <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto mb-3" />
                            <p className="text-sm font-black text-gray-700">We couldn't load the application form</p>
                            <p className="text-[11px] font-semibold text-gray-400 mt-1">{loadError}</p>
                            <button
                                onClick={() => setReloadKey(k => k + 1)}
                                className="mt-5 px-5 py-2.5 rounded-xl bg-maroon text-white text-[10px] font-black uppercase tracking-widest hover:bg-maroon-dark transition-all"
                            >
                                Try again
                            </button>
                        </div>
                    ) : result ? (
                        <div className="p-6 sm:p-10">
                            <div className="text-center">
                                <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center mx-auto">
                                    <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                                </div>
                                <h2 className="text-xl font-black text-gray-800 uppercase tracking-tight mt-4">Application submitted</h2>
                                <p className="text-[12px] font-semibold text-gray-400 mt-1">
                                    Thank you, {result.full_name.split(' ')[0]}. We have received your application.
                                </p>
                            </div>

                            <div className="mt-7 rounded-2xl border border-gold/40 bg-[#fffaf0] p-5 text-center">
                                <p className="text-[9px] font-black uppercase tracking-[0.25em] text-maroon/60">Your application number</p>
                                <div className="flex items-center justify-center gap-2 mt-2">
                                    <p className="text-2xl font-black font-mono text-maroon tracking-wide">{result.applicant_number}</p>
                                    <button
                                        onClick={copyNumber}
                                        title="Copy application number"
                                        className="p-2 rounded-lg text-maroon/50 hover:text-maroon hover:bg-maroon/5 transition-all"
                                    >
                                        {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                                    </button>
                                </div>
                                <p className="text-[10px] font-semibold text-gray-400 mt-2">Keep this number safe — quote it in any correspondence.</p>
                            </div>

                            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                                <SummaryRow icon={BookOpen} label="Programme" value={result.programme_name} />
                                <SummaryRow icon={Clock} label="Intake" value={result.intake} />
                                <SummaryRow icon={Mail} label="Email" value={result.email} />
                                <SummaryRow icon={Clock} label="Submitted" value={fmtDate(result.submitted_at)} />
                            </div>

                            <div className="mt-7 rounded-2xl bg-gray-50 border border-gray-100 p-5">
                                <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-2">What happens next</p>
                                <ul className="space-y-2 text-[11px] font-semibold text-gray-500">
                                    <li className="flex gap-2"><span className="text-maroon font-black">1.</span> The admissions office reviews your application.</li>
                                    <li className="flex gap-2"><span className="text-maroon font-black">2.</span> We may contact you for supporting documents or clarification.</li>
                                    <li className="flex gap-2"><span className="text-maroon font-black">3.</span> You will receive the decision by email.</li>
                                </ul>
                                {info?.auto_reply && (
                                    <p className="text-[10px] font-semibold text-emerald-600 mt-3 flex items-center gap-1.5">
                                        <Mail className="w-3.5 h-3.5" /> A confirmation email has been sent to {result.email}.
                                    </p>
                                )}
                            </div>

                            <div className="mt-7 flex flex-col sm:flex-row gap-2 justify-center">
                                <Link
                                    to={`/track?number=${encodeURIComponent(result.applicant_number)}`}
                                    className="px-5 py-3 rounded-xl bg-maroon text-white text-[10px] font-black uppercase tracking-widest text-center hover:bg-maroon-dark transition-all"
                                >
                                    Track this application
                                </Link>
                                <button
                                    onClick={startAnother}
                                    className="px-5 py-3 rounded-xl border border-gray-200 text-gray-600 text-[10px] font-black uppercase tracking-widest hover:bg-gray-50 transition-all"
                                >
                                    Submit another application
                                </button>
                                <Link
                                    to="/login"
                                    className="px-5 py-3 rounded-xl border border-gray-200 text-gray-600 text-[10px] font-black uppercase tracking-widest text-center hover:bg-gray-50 transition-all"
                                >
                                    Back to portal
                                </Link>
                            </div>
                        </div>
                    ) : info && !info.open ? (
                        <div className="p-10 text-center">
                            <div className="w-16 h-16 rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center mx-auto">
                                <Clock className="w-7 h-7 text-amber-500" />
                            </div>
                            <h2 className="text-lg font-black text-gray-800 uppercase tracking-tight mt-4">Applications are closed</h2>
                            <p className="text-[12px] font-semibold text-gray-400 mt-2 max-w-sm mx-auto">
                                We are not accepting new applications at the moment. Please check back later or contact the admissions office.
                            </p>
                            <Link
                                to="/login"
                                className="inline-block mt-6 px-5 py-2.5 rounded-xl border border-gray-200 text-[10px] font-black uppercase tracking-widest text-gray-600 hover:bg-gray-50 transition-all"
                            >
                                Back to portal
                            </Link>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit}>
                            {/* Step indicator */}
                            <div className="px-5 sm:px-8 pt-6 pb-5 border-b border-gray-100">
                                <div className="flex items-center">
                                    {STEPS.map((s, i) => (
                                        <div key={s.label} className={`flex items-center ${i < STEPS.length - 1 ? 'flex-1' : ''}`}>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black transition-all ${
                                                    i < step ? 'bg-maroon text-white'
                                                        : i === step ? 'bg-gold text-maroon ring-4 ring-gold/20'
                                                            : 'bg-gray-100 text-gray-400'
                                                }`}>
                                                    {i < step ? <Check className="w-3.5 h-3.5" /> : i + 1}
                                                </div>
                                                <span className={`text-[9px] font-black uppercase tracking-wider hidden sm:inline ${
                                                    i === step ? 'text-maroon' : 'text-gray-400'
                                                }`}>{s.label}</span>
                                            </div>
                                            {i < STEPS.length - 1 && (
                                                <div className={`h-px flex-1 mx-3 ${i < step ? 'bg-maroon/30' : 'bg-gray-100'}`} />
                                            )}
                                        </div>
                                    ))}
                                </div>
                                <p className="text-[9px] font-black uppercase tracking-widest text-maroon mt-3 sm:hidden">
                                    Step {step + 1} of 3 · {STEPS[step].label}
                                </p>
                            </div>

                            {/* Honeypot */}
                            <div className="absolute -left-[9999px] top-auto" aria-hidden="true">
                                <label htmlFor="company_website">Company website</label>
                                <input
                                    id="company_website"
                                    tabIndex={-1}
                                    autoComplete="off"
                                    value={form.company_website}
                                    onChange={e => setField('company_website', e.target.value)}
                                />
                            </div>

                            <div className="p-5 sm:p-8">
                                {(stepError || submitError) && (
                                    <div className="mb-5 flex items-start gap-2.5 bg-red-50 border border-red-100 text-red-600 rounded-xl px-4 py-3 text-[11px] font-bold">
                                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                                        <span>{submitError || stepError}</span>
                                    </div>
                                )}

                                {step === 0 && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in fade-in slide-in-from-right-2 duration-300">
                                        <div className="sm:col-span-2">
                                            <label className={LABEL} htmlFor="full_name">Full name *</label>
                                            <input
                                                id="full_name" className={FIELD} maxLength={120}
                                                value={form.full_name} onChange={e => setField('full_name', e.target.value)}
                                                placeholder="As it appears on your ID" autoComplete="name"
                                            />
                                        </div>
                                        <div>
                                            <label className={LABEL} htmlFor="email">Email address *</label>
                                            <input
                                                id="email" type="email" className={FIELD} maxLength={254}
                                                value={form.email} onChange={e => setField('email', e.target.value)}
                                                placeholder="name@example.com" autoComplete="email"
                                            />
                                        </div>
                                        <div>
                                            <label className={LABEL} htmlFor="phone">Phone number *</label>
                                            <input
                                                id="phone" type="tel" className={FIELD} maxLength={20}
                                                value={form.phone} onChange={e => setField('phone', e.target.value)}
                                                placeholder="+254 7XX XXX XXX" autoComplete="tel"
                                            />
                                        </div>
                                        <div>
                                            <label className={LABEL} htmlFor="gender">Gender</label>
                                            <select
                                                id="gender" className={FIELD}
                                                value={form.gender} onChange={e => setField('gender', e.target.value)}
                                            >
                                                <option value="">Not specified</option>
                                                {GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className={LABEL} htmlFor="dob">Date of birth</label>
                                            <input
                                                id="dob" type="date" className={FIELD} max={today}
                                                value={form.dob} onChange={e => setField('dob', e.target.value)}
                                            />
                                        </div>
                                    </div>
                                )}

                                {step === 1 && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in fade-in slide-in-from-right-2 duration-300">
                                        <div>
                                            <label className={LABEL} htmlFor="registration_type">Registration type *</label>
                                            <select
                                                id="registration_type" className={FIELD}
                                                value={form.registration_type} onChange={e => setField('registration_type', e.target.value)}
                                            >
                                                {(info.registration_types || ['Diploma', 'Short Course']).map(t => (
                                                    <option key={t} value={t}>{t}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className={LABEL} htmlFor="intake">Intake *</label>
                                            <select
                                                id="intake" className={FIELD}
                                                value={form.intake} onChange={e => setField('intake', e.target.value)}
                                            >
                                                <option value="">Select an intake</option>
                                                {(info.intakes || []).map(i => <option key={i} value={i}>{i}</option>)}
                                            </select>
                                        </div>
                                        <div className="sm:col-span-2">
                                            <label className={LABEL} htmlFor="programme_id">Programme *</label>
                                            <select
                                                id="programme_id" className={FIELD}
                                                value={form.programme_id} onChange={e => setField('programme_id', e.target.value)}
                                            >
                                                <option value="">Select a programme</option>
                                                {Object.entries(programmeGroups).map(([group, list]) => (
                                                    <optgroup key={group} label={group}>
                                                        {list.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                                    </optgroup>
                                                ))}
                                            </select>
                                            {selectedProgramme && (
                                                <p className="text-[10px] font-semibold text-gray-400 mt-1.5">
                                                    {selectedProgramme.department}
                                                    {selectedProgramme.duration ? ` · ${selectedProgramme.duration}` : ''}
                                                </p>
                                            )}
                                        </div>
                                        <div>
                                            <label className={LABEL} htmlFor="prior_school">Previous school</label>
                                            <input
                                                id="prior_school" className={FIELD} maxLength={160}
                                                value={form.prior_school} onChange={e => setField('prior_school', e.target.value)}
                                                placeholder="School or institution attended"
                                            />
                                        </div>
                                        <div>
                                            <label className={LABEL} htmlFor="prior_qualification">Previous qualification</label>
                                            <input
                                                id="prior_qualification" className={FIELD} maxLength={120}
                                                value={form.prior_qualification} onChange={e => setField('prior_qualification', e.target.value)}
                                                placeholder="e.g. KCSE C+"
                                            />
                                        </div>
                                    </div>
                                )}

                                {step === 2 && (
                                    <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-300">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div>
                                                <label className={LABEL} htmlFor="guardian_name">Guardian / next of kin</label>
                                                <input
                                                    id="guardian_name" className={FIELD} maxLength={120}
                                                    value={form.guardian_name} onChange={e => setField('guardian_name', e.target.value)}
                                                    placeholder="Parent or guardian name"
                                                />
                                            </div>
                                            <div>
                                                <label className={LABEL} htmlFor="guardian_phone">Guardian phone</label>
                                                <input
                                                    id="guardian_phone" type="tel" className={FIELD} maxLength={30}
                                                    value={form.guardian_phone} onChange={e => setField('guardian_phone', e.target.value)}
                                                    placeholder="+254 7XX XXX XXX"
                                                />
                                            </div>
                                            <div className="sm:col-span-2">
                                                <label className={LABEL} htmlFor="address">Residential address</label>
                                                <input
                                                    id="address" className={FIELD} maxLength={240}
                                                    value={form.address} onChange={e => setField('address', e.target.value)}
                                                    placeholder="Town, estate or postal address"
                                                />
                                            </div>
                                        </div>

                                        <div className="rounded-2xl border border-gray-100 bg-gray-50/60 p-5">
                                            <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-3">Review your application</p>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                                                <SummaryRow icon={User} label="Applicant" value={form.full_name} />
                                                <SummaryRow icon={Mail} label="Email" value={form.email} />
                                                <SummaryRow icon={Phone} label="Phone" value={form.phone} />
                                                <SummaryRow icon={GraduationCap} label="Registration type" value={form.registration_type} />
                                                <SummaryRow icon={BookOpen} label="Programme" value={selectedProgramme?.name} />
                                                <SummaryRow icon={Clock} label="Intake" value={form.intake} />
                                                <SummaryRow icon={Users} label="Guardian" value={form.guardian_name} />
                                                <SummaryRow icon={MapPin} label="Address" value={form.address} />
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setStep(0)}
                                                className="mt-4 text-[9px] font-black uppercase tracking-widest text-maroon/70 hover:text-maroon"
                                            >
                                                Edit personal details
                                            </button>
                                        </div>

                                        {(info.required_documents || []).length > 0 && (
                                            <div className="rounded-2xl border border-gold/30 bg-[#fffaf0] p-5">
                                                <p className="text-[9px] font-black uppercase tracking-widest text-maroon/60 mb-2">Documents to prepare</p>
                                                <div className="flex flex-wrap gap-2">
                                                    {info.required_documents.map(doc => (
                                                        <span key={doc} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-gold/30 text-[9px] font-bold text-gray-600">
                                                            <ShieldCheck className="w-3 h-3 text-gold" /> {doc}
                                                        </span>
                                                    ))}
                                                </div>
                                                <p className="text-[10px] font-semibold text-gray-400 mt-2">
                                                    The admissions office may request these during review. Keep them ready.
                                                </p>
                                            </div>
                                        )}

                                        <label className="flex items-start gap-3 cursor-pointer rounded-2xl border border-gray-100 p-4 hover:bg-gray-50/60 transition-colors">
                                            <input
                                                type="checkbox"
                                                checked={declared}
                                                onChange={e => setDeclared(e.target.checked)}
                                                className="mt-0.5 w-4 h-4 rounded border-gray-300 text-maroon focus:ring-maroon"
                                            />
                                            <span className="text-[11px] font-semibold text-gray-500 leading-relaxed">
                                                I confirm that the information provided is true and complete. I understand that any false information may lead to my application being rejected.
                                            </span>
                                        </label>
                                    </div>
                                )}
                            </div>

                            {/* Navigation */}
                            <div className="px-5 sm:px-8 py-5 border-t border-gray-100 bg-gray-50/40 flex items-center justify-between gap-3">
                                {step > 0 ? (
                                    <button
                                        type="button"
                                        onClick={() => { setStepError(''); setStep(step - 1); }}
                                        className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-gray-500 hover:bg-gray-100 transition-all"
                                    >
                                        <ArrowLeft className="w-3.5 h-3.5" /> Back
                                    </button>
                                ) : <span />}

                                {step < 2 ? (
                                    <button
                                        type="submit"
                                        className="inline-flex items-center gap-1.5 px-6 py-3 rounded-xl bg-maroon text-white text-[10px] font-black uppercase tracking-widest hover:bg-maroon-dark transition-all shadow-sm"
                                    >
                                        Continue <ArrowRight className="w-3.5 h-3.5" />
                                    </button>
                                ) : (
                                    <button
                                        type="submit"
                                        disabled={submitting}
                                        className="inline-flex items-center gap-1.5 px-6 py-3 rounded-xl bg-maroon text-white text-[10px] font-black uppercase tracking-widest hover:bg-maroon-dark disabled:opacity-50 transition-all shadow-sm"
                                    >
                                        {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                                        {submitting ? 'Submitting…' : 'Submit application'}
                                    </button>
                                )}
                            </div>
                        </form>
                    )}
                </div>

                <div className="mt-8 text-center space-y-2">
                    <Link to="/track" className="inline-block text-[10px] font-black text-maroon uppercase tracking-widest hover:underline">
                        Already applied? Track your application
                    </Link>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                        © 2026 Beautex Technical Training College
                    </p>
                </div>
            </main>
        </div>
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
