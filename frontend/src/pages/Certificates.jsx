import { useEffect, useLayoutEffect, useState, useMemo, useRef } from 'react';
import { certificatesAPI, settingsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Award, Download, Printer, X, Search, CheckCircle2, Loader2, FileCheck2 } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const MAROON = '#800000';
const GOLD = '#C9A227';
const IVORY = '#FBF6E9';
// sampled from the baked ribbon interior so the banner cover panel blends into it
const RIBBON = '#630A11';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
function formatDate(v) {
    if (!v) return '';
    const d = new Date(v);
    if (isNaN(d.getTime())) return String(v).slice(0, 10);
    return `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

const HEADINGS = { Diploma: 'Diploma Certificate', Certificate: 'Certificate of Completion', 'Short Course': 'Certificate of Completion' };
const ENDINGS = {
    Diploma: 'and has fulfilled the requirements for the award of this diploma.',
    Certificate: 'and has fulfilled the requirements for the award of this certificate.',
    'Short Course': 'and has fulfilled the requirements for the award of this certificate.'
};

async function urlToBase64(url) {
    if (!url) return '';
    if (url.startsWith('data:')) return url;
    try {
        const res = await fetch(url);
        if (!res.ok) return '';
        const blob = await res.blob();
        return await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = () => resolve('');
            reader.readAsDataURL(blob);
        });
    } catch { return ''; }
}

// ── The certificate is drawn on the sample's native 1536 x 1024 grid. ──────────
// The uploaded Beautex sample is used as a 1:1 background (frame, gold flourishes,
// crest, college name, tagline, banner ribbon, gold seal and signature lines are all
// baked into it). Only the variable fields are overlaid, each on a maroon/ivory cover
// panel that erases the sample's placeholder text so it adapts per student/category.
const CERT_W = 1536;
const CERT_H = 1024;

function titleCase(s) {
    return String(s || '').replace(/\b\w/g, c => c.toUpperCase());
}

// Shrinks its own font size until the text fits the available width, so long
// names/headings/details never spill out of their fixed panels.
function FitLine({ children, style, minScale = 0.55, as: Tag = 'span' }) {
    const ref = useRef(null);
    useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return;
        el.style.fontSize = '';
        const base = parseFloat(getComputedStyle(el).fontSize) || 0;
        const parentAvail = el.parentElement ? el.parentElement.clientWidth - 8 : Infinity;
        const avail = Math.min(el.clientWidth || Infinity, parentAvail);
        let size = base;
        while (el.scrollWidth > avail && size > base * minScale) {
            size -= 1;
            el.style.fontSize = `${size}px`;
        }
    });
    return <Tag ref={ref} style={{ display: 'inline-block', whiteSpace: 'nowrap', ...style }}>{children}</Tag>;
}

// Chrome's page zoom (Ctrl +/-) inflates text metrics ~9% at 110% and html2canvas
// captures the degraded layout, which pushed words out of the certificate panels.
// Probe the effective zoom and neutralise it on the element during capture.
function currentPageZoom() {
    const probe = document.createElement('div');
    probe.style.cssText = 'position:absolute;top:0;left:0;width:100px;height:100px;visibility:hidden;pointer-events:none';
    document.body.appendChild(probe);
    const z = probe.getBoundingClientRect().width / 100;
    probe.remove();
    return z > 0.5 ? z : 1;
}

async function captureCertificate(el) {
    const images = Array.from(el.querySelectorAll('img'));
    await Promise.all(images.map(img => (img.complete && img.naturalWidth ? null : new Promise(r => { img.onload = r; img.onerror = r; }))));
    if (document.fonts?.ready) await document.fonts.ready;
    const z = currentPageZoom();
    const inverse = Math.abs(z - 1) > 0.01 ? String(1 / z) : null;
    if (inverse) el.style.zoom = inverse;
    try {
        return await html2canvas(el, { scale: 3, useCORS: true, backgroundColor: IVORY, logging: false });
    } finally {
        if (inverse) el.style.zoom = '';
    }
}

// Spec requires the certificate fonts by name; report instead of silently substituting.
// Chrome's document.fonts.check() returns true even for fonts that are NOT installed,
// so detect availability by measuring: if "X, monospace" and "X, serif" render at the
// same width, X is actually being used; different widths mean both fell back.
function fontAvailable(name) {
    const c = document.createElement('canvas').getContext('2d');
    const probe = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ 0123456789';
    c.font = `42px "${name}", monospace`;
    const wm = c.measureText(probe).width;
    c.font = `42px "${name}", serif`;
    const ws = c.measureText(probe).width;
    return Math.abs(wm - ws) < 0.5;
}

function missingCertFonts() {
    return ['Amoresa Aged', 'Times New Roman'].filter(n => !fontAvailable(n));
}

function CertificateTemplate({ data, innerRef }) {
    const { bg, seal, signature, studentName, admissionNumber, courseName, category, awardDate, certificateNumber, photo } = data;
    const heading = HEADINGS[category] || 'Certificate of Completion';
    const ending = ENDINGS[category] || ENDINGS['Short Course'];
    const courseDisplay = titleCase(courseName);

    const abs = (style) => ({ position: 'absolute', boxSizing: 'border-box', ...style });
    const center = { display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' };

    return (
        <div ref={innerRef} style={{ width: CERT_W, height: CERT_H, position: 'relative', background: IVORY, overflow: 'hidden', fontFamily: 'Georgia, "Times New Roman", serif', color: MAROON, boxSizing: 'border-box' }}>
            {/* Background sample (1:1) */}
            {bg && <img src={bg} alt="" crossOrigin="anonymous" style={abs({ inset: 0, width: CERT_W, height: CERT_H, objectFit: 'fill' })} />}

            {/* Banner heading — plain div with text-align:center is the most html2canvas-safe centering approach.
                FitLine (inline-block + whiteSpace:nowrap) caused left-alignment in the PDF even when display:block was passed.
                48px fits both "Certificate of Completion" and "Diploma Certificate" inside 776px. */}
            <div style={abs({ left: 380, top: 388, width: 776, height: 70, background: RIBBON, color: GOLD, fontSize: 48, fontWeight: 700, fontVariant: 'small-caps', textAlign: 'center', lineHeight: '70px', overflow: 'hidden' })}>
                {heading}
            </div>

            {/* Qualification title — ivory panel erases sample text, keeps flanking gold rules. Course names use Times New Roman per spec. */}
            <div style={abs({ ...center, left: 450, top: 484, width: 636, height: 44, background: IVORY, color: MAROON, fontFamily: '"Times New Roman", Times, serif', fontSize: 38, fontWeight: 700, fontVariant: 'small-caps', letterSpacing: 1 })}>
                <FitLine style={{ textAlign: 'center' }}>{courseDisplay}</FitLine>
            </div>

            {/* Student name — wide ivory panel covers the baked signature rule (incl. the short end-dashes). Amoresa Aged per spec (Georgia/TNR fallback if absent). */}
            <div style={abs({ position: 'absolute', boxSizing: 'border-box', left: 150, top: 598, width: 1236, height: 58, background: IVORY, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 6, fontFamily: '"Amoresa Aged", Georgia, "Times New Roman", serif', fontSize: 42, fontWeight: 700, color: MAROON, fontVariant: 'small-caps', letterSpacing: 1 })}>
                <FitLine style={{ textAlign: 'center' }}>{studentName}</FitLine>
            </div>

            {/* Completion sentence — ivory panel erases sample text (baked at y671–728) */}
            <div style={abs({ left: 230, top: 660, width: 1076, height: 80, background: IVORY, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontStyle: 'italic', fontSize: 27, lineHeight: 1.5, color: MAROON })}>
                <div>has successfully completed the prescribed course of study in {courseDisplay}</div>
                <div>{ending}</div>
            </div>

            {/* Details row — ivory panel erases sample labels (baked at y771–787), re-rendered with values.
                Plain italic text, no underlines; content stays left of x≈1240 so it never touches the seal. */}
            <FitLine as="div" style={abs({ left: 110, top: 760, width: 1150, height: 40, background: IVORY, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, fontStyle: 'italic', fontSize: 21, color: MAROON, padding: '0 10px' })}>
                {[['Date of Award:', formatDate(awardDate) || ''], ['Certificate No.:', certificateNumber || ''], ['Registration No.:', admissionNumber || '']].map(([label, val]) => (
                    <div key={label} style={{ flex: '0 1 auto', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <span style={{ fontWeight: 700 }}>{label}&nbsp;</span>
                        <span>{val || ' '}</span>
                    </div>
                ))}
            </FitLine>

            {/* Signature zone — one Principal section only.
                The baked HOD line + both baked placeholder labels are erased with ivory covers;
                the baked Principal rule (x310–623 @ y886) is kept as the handwriting line, with
                the printed name/title below it and blank space above it for the signature. */}
            <div style={abs({ left: 280, top: 890, width: 373, height: 48, background: IVORY })} />
            <div style={abs({ left: 830, top: 875, width: 365, height: 63, background: IVORY })} />
            {signature && <img src={signature} alt="" crossOrigin="anonymous" style={abs({ left: 366, top: 795, width: 200, height: 89 })} />}
            <div style={abs({ left: 310, top: 892, width: 313, height: 44, color: MAROON, textAlign: 'center', lineHeight: 1.35 })}>
                <div style={{ fontSize: 20, fontWeight: 700 }}>Linet Kariuki</div>
                <div style={{ fontSize: 18, fontStyle: 'italic' }}>Principal</div>
            </div>

            {/* Official seal — extracted seal disc re-rendered enlarged (r≈112 vs baked r≈91),
                concentric with the baked seal so it fully covers it without touching details or signatures. */}
            {seal && <img src={seal} alt="" crossOrigin="anonymous" style={abs({ left: 1254, top: 720, width: 224, height: 224 })} />}

            {/* Passport photo frame — empty upper-right ivory zone */}
            <div style={abs({ left: 1245, top: 312, width: 178, height: 222, background: '#fff', border: `3px solid ${MAROON}`, outline: `3px solid ${GOLD}`, outlineOffset: '-9px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', boxShadow: '0 2px 6px rgba(0,0,0,.25)' })}>
                {photo
                    ? <img src={photo} alt="student" crossOrigin="anonymous" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <span style={{ fontSize: 14, color: '#9a9a9a', textAlign: 'center', lineHeight: 1.2 }}>No<br />photo</span>}
            </div>
        </div>
    );
}

export default function Certificates() {
    const { user } = useAuth();
    const role = (user?.role || '').toLowerCase().trim();
    const canIssue = role === 'admin' || role === 'superadmin';
    const [tab, setTab] = useState('generate');
    const [eligible, setEligible] = useState([]);
    const [issued, setIssued] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [settings, setSettings] = useState({});
    const [toast, setToast] = useState(null);
    const [issuedFilter, setIssuedFilter] = useState('Issued'); // Issued | Revoked
    const [revokeTarget, setRevokeTarget] = useState(null);     // certificate row pending revoke
    const [revokeReason, setRevokeReason] = useState('');

    const [preview, setPreview] = useState(null); // { data, record }
    const [busy, setBusy] = useState(false);
    const certRef = useRef(null);
    const scaleRef = useRef(null);

    const notify = (msg, kind = 'info') => { setToast({ msg, kind }); setTimeout(() => setToast(null), 4000); };

    useEffect(() => { load(); }, []);
    useEffect(() => { if (tab === 'issued') loadIssued(); }, [tab, issuedFilter]);

    async function load() {
        setLoading(true); setError('');
        try {
            const [el, st] = await Promise.all([certificatesAPI.getEligible(), settingsAPI.get()]);
            setEligible(el.data || []);
            setSettings(st.data || {});
        } catch (e) {
            setError(e.response?.data?.error || 'Failed to load eligible students.');
        } finally { setLoading(false); }
    }
    async function loadIssued() {
        try { const { data } = await certificatesAPI.getAll({ status: issuedFilter }); setIssued(data || []); }
        catch (e) { notify(e.response?.data?.error || 'Failed to load certificates.', 'error'); }
    }

    const filteredEligible = useMemo(() => {
        const q = search.toLowerCase().trim();
        if (!q) return eligible;
        return eligible.filter(s => s.student_name?.toLowerCase().includes(q) || s.admission_number?.toLowerCase().includes(q) || s.course_name?.toLowerCase().includes(q));
    }, [eligible, search]);

    async function buildData(row) {
        const photo = row.photo ? await urlToBase64(String(row.photo).trim()) : '';
        const bg = await urlToBase64('/certificate-bg.png');
        const seal = await urlToBase64('/certificate-seal.png');
        const signature = await urlToBase64('/principal-signature.png');
        return {
            bg, photo, seal, signature,
            studentName: row.student_name || row.name,
            admissionNumber: row.admission_number || row.student_id,
            courseName: row.course_name,
            category: row.category,
            awardDate: row.award_date || row.completion_date,
            certificateNumber: row.certificate_number || null
        };
    }

    async function openPreview(row) {
        setBusy(true);
        try {
            const data = await buildData(row);
            const missing = await missingCertFonts();
            if (missing.length) notify(`Missing font${missing.length > 1 ? 's' : ''} on this computer: ${missing.join(', ')}. Install them for exact rendering.`, 'error');
            setPreview({ data, studentId: row.student_id, programmeId: row.programme_id, issued: !!row.already_issued && !!row.certificate_number, certificateNumber: row.certificate_number || null });
        } catch (e) { notify('Could not prepare preview: ' + (e.message || ''), 'error'); }
        finally { setBusy(false); }
    }

    async function handleIssue() {
        if (!preview) return;
        setBusy(true);
        try {
            const { data } = await certificatesAPI.issue({ student_id: preview.studentId, programme_id: preview.programmeId });
            const newData = { ...preview.data, certificateNumber: data.certificate_number, awardDate: data.award_date };
            setPreview({ ...preview, data: newData, issued: true, certificateNumber: data.certificate_number, record: data });
            notify(`Certificate issued: ${data.certificate_number}`, 'success');
            load(); // refresh eligibility state
        } catch (e) {
            notify(e.response?.data?.error || 'Failed to issue certificate.', 'error');
        } finally { setBusy(false); }
    }

    function openRevoke(c) { setRevokeReason(''); setRevokeTarget(c); }
    const closeRevoke = () => setRevokeTarget(null);

    async function handleRevoke() {
        if (!revokeTarget) return;
        const reason = revokeReason.trim();
        if (!reason) { notify('A reason is required to revoke.', 'error'); return; }
        setBusy(true);
        try {
            await certificatesAPI.revoke(revokeTarget.id, { reason });
            notify(`Certificate ${revokeTarget.certificate_number} revoked.`, 'success');
            closeRevoke();
            loadIssued(); // refresh current register view
            load();       // student becomes re-eligible on the Generate tab
        } catch (e) {
            notify(e.response?.data?.error || 'Failed to revoke certificate.', 'error');
        } finally { setBusy(false); }
    }

    async function captureCanvas() {
        const el = certRef.current;
        if (!el) throw new Error('Template not ready.');
        // Neutralise preview scaling so html2canvas captures at full size.
        const wrapper = scaleRef.current;
        const prevTransform = wrapper ? wrapper.style.transform : null;
        if (wrapper) wrapper.style.transform = 'none';
        try {
            return await captureCertificate(el);
        } finally {
            if (wrapper && prevTransform !== null) wrapper.style.transform = prevTransform;
        }
    }

    async function handleDownload() {
        setBusy(true);
        try {
            const canvas = await captureCanvas();
            // Size the PDF page to the canvas geometry (1536x1024 ≈ 1.5:1) instead of
            // forcing it into A4's 1.414:1. Stretching the wider canvas into A4 squeezed
            // text horizontally, crowding words and the underlined detail labels together.
            // Keeping the native ratio (widest A4 edge = 297mm) means the PDF matches the
            // preview exactly and nothing overlaps.
            const pw = 297;
            const ph = Math.round(pw * (canvas.height / canvas.width));
            const pdf = new jsPDF({ orientation: pw >= ph ? 'landscape' : 'portrait', unit: 'mm', format: [pw, ph] });
            pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, pw, ph, undefined, 'SLOW');
            const name = (preview.data.studentName || 'certificate').replace(/\s+/g, '_');
            pdf.save(`${name}_${preview.certificateNumber || 'DRAFT'}.pdf`);
        } catch (e) { notify('PDF failed: ' + (e.message || ''), 'error'); }
        finally { setBusy(false); }
    }

    async function handlePrint() {
        setBusy(true);
        try {
            const canvas = await captureCanvas();
            const w = window.open('', '_blank');
            w.document.write(`<html><head><title>Certificate</title><style>@page{size:A4 landscape;margin:0}body{margin:0}img{width:100%}</style></head><body><img src="${canvas.toDataURL('image/png')}" onload="setTimeout(()=>{window.print();},300)"/></body></html>`);
            w.document.close();
        } catch (e) { notify('Print failed: ' + (e.message || ''), 'error'); }
        finally { setBusy(false); }
    }

    const closePreview = () => setPreview(null);

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-end justify-between">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-black text-maroon uppercase tracking-tight">Certificates</h1>
                    <p className="text-xs text-maroon/40 font-bold tracking-widest mt-1">Qualification Award & Issuance Register</p>
                </div>
                <div className="flex gap-2">
                    {['generate', 'issued'].map(t => (
                        <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest border transition-all ${tab === t ? 'bg-maroon text-gold border-maroon' : 'bg-white text-maroon border-maroon/10 hover:border-maroon/30'}`}>
                            {t === 'generate' ? 'Generate' : 'Issued'}
                        </button>
                    ))}
                </div>
            </div>

            {tab === 'generate' && (
                <div className="card-light p-5 sm:p-6">
                    <div className="relative mb-4 max-w-md">
                        <Search className="w-4 h-4 text-maroon/30 absolute left-4 top-1/2 -translate-y-1/2" />
                        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search eligible graduates by name, admission or programme…" className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold text-maroon outline-none focus:ring-2 focus:ring-maroon/10" />
                    </div>

                    {loading ? <div className="flex items-center gap-2 text-maroon/50 font-bold text-sm py-8 justify-center"><Loader2 className="w-5 h-5 animate-spin" /> Loading eligible students…</div>
                        : error ? <p className="text-red-600 font-bold text-sm py-6">{error}</p>
                        : filteredEligible.length === 0 ? <p className="text-maroon/40 font-bold text-sm py-8 text-center">No graduated students are eligible yet. Mark a student as “Graduated” (or set a completion date) to issue a certificate.</p>
                            : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="text-[10px] font-black uppercase tracking-widest text-maroon/40 border-b border-maroon/10">
                                                <th className="py-3 px-3">Student</th>
                                                <th className="py-3 px-3">Admission</th>
                                                <th className="py-3 px-3">Qualification</th>
                                                <th className="py-3 px-3">Category</th>
                                                <th className="py-3 px-3">Status</th>
                                                <th className="py-3 px-3 text-right">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredEligible.map(s => (
                                                <tr key={`${s.student_id}-${s.programme_id}`} className="border-b border-maroon/5 hover:bg-maroon/[0.02]">
                                                    <td className="py-3 px-3 font-black text-maroon text-sm">{s.student_name}</td>
                                                    <td className="py-3 px-3 text-[11px] font-bold text-black/50">{s.admission_number}</td>
                                                    <td className="py-3 px-3 text-[11px] font-bold text-black/70">{s.course_name}</td>
                                                    <td className="py-3 px-3"><span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase ${s.category === 'Diploma' ? 'bg-maroon text-gold' : 'bg-gold/20 text-maroon'}`}>{s.category}</span></td>
                                                    <td className="py-3 px-3">{s.already_issued ? <span className="text-[10px] font-black text-emerald-600 uppercase">Issued · {s.certificate_number}</span> : <span className="text-[10px] font-black text-amber-600 uppercase">Ready</span>}</td>
                                                    <td className="py-3 px-3 text-right">
                                                        <button onClick={() => openPreview(s)} className="px-3 py-1.5 rounded-lg bg-maroon text-gold text-[10px] font-black uppercase tracking-wider hover:bg-elite-maroon inline-flex items-center gap-1"><FileCheck2 className="w-3.5 h-3.5" /> Preview</button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                </div>
            )}

            {tab === 'issued' && (
                <div className="card-light p-5 sm:p-6 overflow-x-auto">
                    <div className="flex items-center justify-between mb-4">
                        <p className="text-[11px] font-black uppercase tracking-widest text-maroon/40">{issuedFilter === 'Issued' ? 'Active Certificates' : 'Revoked Certificates'}</p>
                        <div className="flex gap-2">
                            {['Issued', 'Revoked'].map(f => (
                                <button key={f} onClick={() => setIssuedFilter(f)} className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all ${issuedFilter === f ? 'bg-maroon text-gold border-maroon' : 'bg-white text-maroon border-maroon/10 hover:border-maroon/30'}`}>{f === 'Issued' ? 'Active' : 'Revoked'}</button>
                            ))}
                        </div>
                    </div>
                    {issued.length === 0 ? <p className="text-maroon/40 font-bold text-sm py-8 text-center">{issuedFilter === 'Issued' ? 'No active certificates issued yet.' : 'No revoked certificates.'}</p> : (
                        <table className="w-full text-left">
                            <thead>
                                <tr className="text-[10px] font-black uppercase tracking-widest text-maroon/40 border-b border-maroon/10">
                                    <th className="py-3 px-3">Certificate No.</th>
                                    <th className="py-3 px-3">Student</th>
                                    <th className="py-3 px-3">Qualification</th>
                                    <th className="py-3 px-3">Category</th>
                                    <th className="py-3 px-3">Award Date</th>
                                    {issuedFilter === 'Issued' ? <th className="py-3 px-3">Issued By</th> : <th className="py-3 px-3">Revoked</th>}
                                    <th className="py-3 px-3 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {issued.map(c => (
                                    <tr key={c.id} className="border-b border-maroon/5">
                                        <td className="py-3 px-3 font-black text-maroon text-[11px]">{c.certificate_number}</td>
                                        <td className="py-3 px-3 text-[11px] font-bold text-black/70">{c.student_name}</td>
                                        <td className="py-3 px-3 text-[11px] font-bold text-black/60">{c.course_name}</td>
                                        <td className="py-3 px-3"><span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase ${c.category === 'Diploma' ? 'bg-maroon text-gold' : 'bg-gold/20 text-maroon'}`}>{c.category}</span></td>
                                        <td className="py-3 px-3 text-[11px] font-bold text-black/60">{formatDate(c.award_date)}</td>
                                        {issuedFilter === 'Issued'
                                            ? <td className="py-3 px-3 text-[11px] font-bold text-black/50">{c.issued_by_name || c.issued_by || '—'}</td>
                                            : <td className="py-3 px-3 text-[11px] font-bold text-red-600/80"><div>{formatDate(c.revoked_at)}</div><div className="text-black/50 font-semibold normal-case">“{c.revoke_reason || '—'}”</div></td>}
                                        <td className="py-3 px-3 text-right whitespace-nowrap">
                                            <button onClick={() => openPreview({ ...c, student_name: c.student_name, student_id: c.student_id, photo: c.student_photo, already_issued: true })} className="px-3 py-1.5 rounded-lg bg-white border border-maroon/20 text-maroon text-[10px] font-black uppercase tracking-wider hover:border-maroon/40">View</button>
                                            {issuedFilter === 'Issued' && canIssue && (
                                                <button onClick={() => openRevoke(c)} className="ml-2 px-3 py-1.5 rounded-lg bg-red-600 text-white text-[10px] font-black uppercase tracking-wider hover:bg-red-700 inline-flex items-center gap-1"><X className="w-3.5 h-3.5" /> Revoke</button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}

            {/* Revoke confirmation modal */}
            {revokeTarget && (
                <div className="fixed inset-0 bg-maroon/50 backdrop-blur-md flex items-center justify-center p-4 z-[70]" onClick={closeRevoke}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
                        <h3 className="text-sm font-black text-maroon uppercase tracking-widest mb-1">Revoke Certificate</h3>
                        <p className="text-[12px] font-bold text-black/60 mb-4">
                            Void <span className="font-black text-maroon">{revokeTarget.certificate_number}</span> for {revokeTarget.student_name}. The student will become eligible for re-issuance. This is recorded in the register.
                        </p>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-maroon/50 mb-1">Reason (required)</label>
                        <textarea value={revokeReason} onChange={e => setRevokeReason(e.target.value)} rows={3} placeholder="e.g. Errors in candidate details / exam result pending review…" className="w-full px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold text-maroon outline-none focus:ring-2 focus:ring-maroon/10 resize-none" />
                        <div className="flex gap-3 justify-end mt-5">
                            <button onClick={closeRevoke} disabled={busy} className="px-4 py-2.5 rounded-xl bg-white border border-maroon/20 text-maroon text-[11px] font-black uppercase tracking-widest hover:border-maroon/40 disabled:opacity-50">Cancel</button>
                            <button onClick={handleRevoke} disabled={busy || !revokeReason.trim()} className="px-4 py-2.5 rounded-xl bg-red-600 text-white text-[11px] font-black uppercase tracking-widest hover:bg-red-700 disabled:opacity-50 inline-flex items-center gap-2">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />} Confirm Revoke</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Preview modal */}
            {preview && (
                <div className="fixed inset-0 bg-maroon/50 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 z-50 overflow-auto" onClick={closePreview}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl p-4 sm:p-6" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-black text-maroon uppercase tracking-widest flex items-center gap-2"><Award className="w-4 h-4" /> Certificate Preview {preview.issued ? '' : '(Draft)'}</h3>
                            <button onClick={closePreview} className="p-2 hover:bg-gray-100 rounded-full"><X className="w-5 h-5 text-maroon/40" /></button>
                        </div>

                        <div className="border border-gray-200 rounded-xl overflow-auto bg-gray-50 flex justify-center">
                            <div style={{ width: '100%', maxWidth: 1536 * 0.62 }}>
                                <div ref={scaleRef} style={{ transform: 'scale(0.62)', transformOrigin: 'top left', width: 1536, height: 1024 }}>
                                    <CertificateTemplate data={preview.data} innerRef={certRef} />
                                </div>
                            </div>
                        </div>
                        {/* reserve height so the scaled element doesn't collapse the modal */}
                        <div style={{ height: 1024 * 0.62 - 1024, marginTop: 0 }} aria-hidden />

                        {!preview.issued && !preview.photo && (
                            <p className="text-[11px] font-bold text-amber-700 mt-2">⚠ This student has no passport photo on file. Add one before final issuance unless authorized.</p>
                        )}

                        <div className="flex flex-wrap gap-3 justify-end mt-4">
                            {canIssue && !preview.issued && (
                                <button onClick={handleIssue} disabled={busy} className="px-5 py-3 rounded-xl bg-emerald-600 text-white text-[11px] font-black uppercase tracking-widest hover:bg-emerald-700 disabled:opacity-50 inline-flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Issue Certificate</button>
                            )}
                            {preview.issued && (
                                <>
                                    <button onClick={handleDownload} disabled={busy} className="px-5 py-3 rounded-xl bg-maroon text-gold text-[11px] font-black uppercase tracking-widest hover:bg-elite-maroon disabled:opacity-50 inline-flex items-center gap-2"><Download className="w-4 h-4" /> Download PDF</button>
                                    <button onClick={handlePrint} disabled={busy} className="px-5 py-3 rounded-xl bg-white border border-maroon/20 text-maroon text-[11px] font-black uppercase tracking-widest hover:border-maroon/40 disabled:opacity-50 inline-flex items-center gap-2"><Printer className="w-4 h-4" /> Print</button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {toast && (
                <div className={`fixed bottom-6 right-6 z-[60] px-5 py-3 rounded-xl shadow-xl text-[12px] font-black uppercase tracking-wide ${toast.kind === 'error' ? 'bg-red-600 text-white' : toast.kind === 'success' ? 'bg-emerald-600 text-white' : 'bg-maroon text-gold'}`}>{toast.msg}</div>
            )}
        </div>
    );
}
