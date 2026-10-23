import { useEffect, useLayoutEffect, useState, useMemo, useRef } from 'react';
import { certificatesAPI, settingsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Award, Download, Printer, X, Search, CheckCircle2, Loader2, FileCheck2, Pencil } from 'lucide-react';
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

// Head of Department signing each programme (matched by substring on the course name).
// `sig` is the HOD's handwritten signature overlay (empty = none supplied yet).
const HODS = [
    { hod: 'Douglas Ndinyo', sig: '/hod-signature-douglas.png', courses: ['ict', 'information communication technology', 'website development', 'web development', 'computer packages', 'cyber security'] },
    { hod: 'Elsy Mutuma', sig: '', courses: ['cosmetology', 'beauty therapy', 'hairdressing'] },
    { hod: 'Vivian Karimi', sig: '', courses: ['baking and pastry', 'baking & pastry'] }
];
function hodForCourse(courseName) {
    const cn = String(courseName || '').toLowerCase();
    for (const { hod, sig, courses } of HODS) if (courses.some(c => cn.includes(c))) return { hod, sig };
    return { hod: '', sig: '' };
}

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

// Preview scale: how much to shrink the certificate to fit inside the modal.
const PREVIEW_SCALE = 0.62;

function titleCase(s) {
    return String(s || '').replace(/\b\w/g, c => c.toUpperCase());
}

// Shrinks its own font size until the text fits the available width, so long
// names/headings/details never spill out of their fixed panels.
// IMPORTANT: Only use FitLine inside containers where overflow:hidden is acceptable
// and where the container is NOT already a flex container. Using FitLine as the
// direct flex child of a display:flex parent breaks centering in html2canvas.
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

async function captureCertificate(el) {
    // 1. Wait for all images inside the certificate to be fully loaded & decoded.
    const images = Array.from(el.querySelectorAll('img'));
    await Promise.all(
        images.map(img => {
            if (img.complete && img.naturalWidth) {
                // Already loaded — still decode to ensure paint is done.
                return img.decode ? img.decode().catch(() => {}) : Promise.resolve();
            }
            return new Promise(r => {
                img.onload = () => (img.decode ? img.decode().catch(r).then(r) : r());
                img.onerror = r;
            });
        })
    );

    // 2. Wait for web fonts to finish loading.
    if (document.fonts?.ready) await document.fonts.ready;

    // 3. Small rAF-based flush to let the browser repaint after any layout changes.
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

    // NB: html2canvas rasterises its own clone in CSS pixels, so browser page
    // zoom does NOT distort the output. An earlier el.style.zoom neutralisation
    // hack here was the opposite — html2canvas applies element zoom but ignores
    // page zoom, so the hack inflated the layout ~11% inside the 1536×1024
    // capture box and shifted every panel off the background (double transform).

    return await html2canvas(el, {
        scale: 3,           // 3× for crisp PDF at 297mm wide
        useCORS: true,
        allowTaint: false,
        backgroundColor: IVORY,
        logging: false,
        imageTimeout: 15000,
        // Use the element's own scroll dimensions to avoid clipping.
        width: CERT_W,
        height: CERT_H,
    });
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

// ─── Certificate Template ─────────────────────────────────────────────────────
// All coordinates pixel-scanned directly from the actual certificate-bg.png
// (1536x1024 — confirmed via System.Drawing). Key zones:
//
//  Ribbon structure at x=760 (RGB scan-verified):
//  y=382-441   Maroon outer top band
//  y=447-463   Maroon upper inner band
//  y=465-490   IVORY inner band (baked heading placeholder text lives here)
//  y=491-497   Maroon thin separator
//  y=500-512   IVORY (baked course-title placeholder text)
//  y=515-519   Maroon thin separator
//  y=521-543   Ivory open area
//  y=544-548   Gold ornament divider (baked)
//  y=588-594   Baked "This is to certify that" italic text
//  y=887       Baked signature underline (exact pixel scan)
//  Seal:       center approx x=1390, y=870  (gold ring y=745-935)
//  Photo zone: x=1245-1445, y=310-540 -- confirmed 100% clear ivory
//
// OVERLAY STRATEGY:
//  Banner heading  --> RIBBON panel at y=462-494 erases baked ivory text zone
//  Course title    --> IVORY cover at y=496-526, text rendered on top
//  Student name    --> IVORY cover at y=604-656, name rendered on top
//  Body text       --> IVORY cover at y=666-756, text rendered on top
//  Details row     --> IVORY cover at y=758-798
//  Signature zone  --> targeted ivory covers for HOD line and labels
function CertificateTemplate({ data, innerRef }) {
    const { bg, seal, signature, studentName, admissionNumber, courseName, category, awardDate, certificateNumber, photo, nita, tveta, hodName, hodSig } = data;
    const heading = HEADINGS[category] || 'Certificate of Completion';
    const ending = ENDINGS[category] || ENDINGS['Short Course'];
    const courseDisplay = titleCase(courseName);

    const abs = (style) => ({ position: 'absolute', boxSizing: 'border-box', ...style });

    return (
        <div
            ref={innerRef}
            style={{
                width: CERT_W,
                height: CERT_H,
                position: 'relative',
                background: IVORY,
                overflow: 'hidden',
                fontFamily: 'Georgia, "Times New Roman", serif',
                color: MAROON,
                boxSizing: 'border-box',
            }}
        >
            {/* ── Background image (1536x1024, no scaling distortion) ── */}
            {bg && (
                <img
                    src={bg}
                    alt=""
                    crossOrigin="anonymous"
                    style={abs({ inset: 0, width: CERT_W, height: CERT_H, objectFit: 'fill' })}
                />
            )}

            {/* ── Accreditation logos (centred between the two signature blocks) ─
                The pair sits in the widened gutter x484–850 between the (moved)
                Principal rule and the HOD rule, vertically centred in the clear
                band y798–885. Transparent PNGs so no white box shows.           */}
            {nita && (
                <img
                    src={nita}
                    alt="NITA"
                    crossOrigin="anonymous"
                    style={abs({ left: 528, top: 818, width: 180, height: 75 })}
                />
            )}
            {tveta && (
                <img
                    src={tveta}
                    alt="TVETA"
                    crossOrigin="anonymous"
                    style={abs({ left: 730, top: 818, width: 75, height: 75 })}
                />
            )}

            {/* ── Banner heading ──────────────────────────────────────────────
                Pixel scan of certificate-bg.png: the baked cream heading occupies
                x410-1126 y380-460 INSIDE the maroon band (band interior y379-463,
                gold borders y375-378 / y464-470, fleurons at x330-370 & x1165-1230).
                Panel covers the full band interior so no baked glyph peeks out,
                while the fleurons and gold borders stay visible.
                textAlign:center without flex = html2canvas-safe centering.
                lineHeight 59 (not 85): html2canvas puts the baseline at
                panel_top + lineHeight - 1 instead of centering the line box,
                so lh=85 rendered the heading ~20px low, clipped at the band's
                bottom gold border. lh=59 centres the cap-height in the band.   */}
            <div
                style={abs({
                    left: 381, top: 379, width: 774, height: 85,
                    background: RIBBON,
                    color: GOLD,
                    fontSize: 44,
                    fontWeight: 700,
                    fontVariant: 'small-caps',
                    textAlign: 'center',
                    lineHeight: '59px',
                    overflow: 'hidden',
                })}
            >
                {heading}
            </div>

            {/* ── Course-title cover + text ────────────────────────────────────
                Baked course title occupies x458-1075 y490-520. Panel 450-1086
                x 480-534 erases it completely. The decorative gold line segments
                (y508-509) live OUTSIDE x450-1086 (left segment ends x432, right
                starts x1103) so they remain visible beside the text.
                fs 34 + lh 40: html2canvas puts the baseline at panel_top+lh-1
                (=519), centring cap-height in the clear ivory zone between the
                ribbon border (y470) and the fleuron divider (y546). With the old
                fs38/lh44 the baseline sat at 527 and long course names were cut
                off along the panel's bottom edge in the PDF.                    */}
            <div
                style={abs({
                    left: 450, top: 480, width: 636, height: 54,
                    background: IVORY,
                    color: MAROON,
                    fontFamily: '"Times New Roman", Times, serif',
                    fontSize: 34,
                    fontWeight: 700,
                    fontVariant: 'small-caps',
                    letterSpacing: 1,
                    textAlign: 'center',
                    lineHeight: '40px',
                    overflow: 'hidden',
                })}
            >
                <FitLine minScale={0.6}>{courseDisplay}</FitLine>
            </div>

            {/* ── Student name ────────────────────────────────────────────────
                Baked sample name spans x253-1282 y600-646 — cover must be at
                least that wide/tall or baked glyph edges peek out. No flex;
                text-align:center + line-height is html2canvas-safe.
                lh 36 (not 52): html2canvas puts the baseline at
                top + lineHeight + 5 (=639), centring the 42px caps in the panel.
                lh 52 pushed the baseline to 655, past the 650 content edge, so
                the bottom of the name was clipped in the PDF (user screenshot). */}
            <div
                style={abs({
                    left: 150, top: 598, width: 1236, height: 58,
                    background: IVORY,
                    fontFamily: '"Amoresa Aged", Georgia, "Times New Roman", serif',
                    fontSize: 42,
                    fontWeight: 700,
                    color: MAROON,
                    fontVariant: 'small-caps',
                    letterSpacing: 1,
                    textAlign: 'center',
                    lineHeight: '36px',
                    paddingBottom: 6,
                    overflow: 'hidden',
                })}
            >
                <FitLine>{studentName}</FitLine>
            </div>

            {/* ── Completion sentence ─────────────────────────────────────────
                IVORY cover erases baked placeholder. Height 90px holds two lines
                at 26px x lineHeight 1.55 comfortably.
                No flex; block divs with text-align:center are html2canvas-safe.  */}
            <div
                style={abs({
                    left: 230, top: 660, width: 1076, height: 80,
                    background: IVORY,
                    fontStyle: 'italic',
                    fontSize: 27,
                    color: MAROON,
                    textAlign: 'center',
                    paddingTop: 10,
                })}
            >
                <div style={{ lineHeight: 1.5 }}>
                    has successfully completed the prescribed course of study in {courseDisplay}
                </div>
                <div style={{ lineHeight: 1.5 }}>{ending}</div>
            </div>

            {/* ── Details row ─────────────────────────────────────────────────
                Plain div with display:flex (NOT wrapped in FitLine — FitLine would
                apply inline-block and collapse flex children to 0px in html2canvas).
                Each label+value pair is a nowrap flex child.                     */}
            <div
                style={abs({
                    left: 100, top: 758, width: 1160, height: 40,
                    background: IVORY,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 16,
                    fontStyle: 'italic',
                    fontSize: 20,
                    color: MAROON,
                    padding: '0 12px',
                })}
            >
                {[
                    ['Date of Award:', formatDate(awardDate) || ''],
                    ['Certificate No.:', certificateNumber || ''],
                    ['Registration No.:', admissionNumber || ''],
                ].map(([label, val]) => (
                    <div key={label} style={{ flex: '0 1 auto', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <span style={{ fontWeight: 700 }}>{label}&nbsp;</span>
                        <span>{val || ' '}</span>
                    </div>
                ))}
            </div>

            {/* ── Signature zone ──────────────────────────────────────────────
                Pixel scan: Principal rule x309-623 @ y886-887 — erased and redrawn
                140px further left (x170-484) to open a wide gutter for the NITA +
                TVETA logos between the two signing lines. HOD rule x850-1169 @ y887
                (baked label erased, rule kept). */}

            {/* Erase the baked Principal rule (2px line at y886-887) */}
            <div style={abs({ left: 300, top: 884, width: 330, height: 7, background: IVORY })} />
            {/* Erase baked "Principal" label + fleuron below the old rule position */}
            <div style={abs({ left: 280, top: 890, width: 373, height: 48, background: IVORY })} />
            {/* Erase only the baked HOD label; the rule x850-1169 @ y887 stays as the
                handwriting line, mirroring how the Principal line is used */}
            <div style={abs({ left: 830, top: 890, width: 365, height: 48, background: IVORY })} />

            {/* Redrawn Principal rule at the new left position */}
            <div style={abs({ left: 170, top: 886, width: 314, height: 2, background: '#83182C' })} />

            {signature && (
                <img
                    src={signature}
                    alt=""
                    crossOrigin="anonymous"
                    style={abs({ left: 226, top: 795, width: 200, height: 89 })}
                />
            )}
            <div
                style={abs({
                    left: 170, top: 892, width: 313, height: 44,
                    color: MAROON,
                    textAlign: 'center',
                    lineHeight: 1.35,
                })}
            >
                <div style={{ fontSize: 20, fontWeight: 700 }}>Linet Kariuki</div>
                <div style={{ fontSize: 18, fontStyle: 'italic' }}>Principal</div>
            </div>

            {/* HOD handwritten signature on the baked right rule (mirrors Principal) */}
            {hodSig && (
                <img
                    src={hodSig}
                    alt=""
                    crossOrigin="anonymous"
                    style={abs({ left: 934, top: 796, width: 150, height: 88 })}
                />
            )}
            {/* HOD name + title under the right rule (mirrors the Principal block) */}
            <div
                style={abs({
                    left: 850, top: 892, width: 319, height: 44,
                    color: MAROON,
                    textAlign: 'center',
                    lineHeight: 1.35,
                })}
            >
                <div style={{ fontSize: 20, fontWeight: 700 }}>{hodName || '\u00A0'}</div>
                <div style={{ fontSize: 18, fontStyle: 'italic' }}>Head of Department</div>
            </div>

            {/* ── Official seal ───────────────────────────────────────────────
                Baked seal disc center x=1366, y=832, r~92 (gold ring scan:
                x1275-1456 @ y840, y738-926 @ x1366). 224x224 overlay centred on
                it fully covers the baked seal.                                   */}
            {seal && (
                <img
                    src={seal}
                    alt=""
                    crossOrigin="anonymous"
                    style={abs({ left: 1254, top: 720, width: 224, height: 224 })}
                />
            )}

            {/* ── Passport photo frame ────────────────────────────────────────
                Photo zone confirmed 100% clear ivory (0 non-ivory pixels found in
                x=1245-1445, y=310-540 zone). Frame is sized/positioned to stay
                inside that clear area.                                           */}
            <div
                style={abs({
                    left: 1258, top: 318, width: 172, height: 214,
                    background: '#fff',
                    border: `3px solid ${MAROON}`,
                    outline: `3px solid ${GOLD}`,
                    outlineOffset: '-8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    boxShadow: '0 2px 8px rgba(0,0,0,.28)',
                })}
            >
                {photo
                    ? <img src={photo} alt="student" crossOrigin="anonymous" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <span style={{ fontSize: 13, color: '#9a9a9a', textAlign: 'center', lineHeight: 1.2 }}>No<br />photo</span>}
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
    const [editTarget, setEditTarget] = useState(null);         // certificate row being edited
    const [editForm, setEditForm] = useState({ certificate_number: '', award_date: '', hod_name: '', student_name: '', course_name: '' });

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
        const nita = await urlToBase64('/nita-logo.png');
        const tveta = await urlToBase64('/tveta-logo.png');
        const hod = hodForCourse(row.course_name);
        // Admin-editable override on the certificate record wins over the course→HOD map.
        const hodName = String(row.hod_name || '').trim() || hod.hod;
        // Handwritten signature only when the printed name is the mapped HOD.
        const hodSig = (hodName === hod.hod && hod.sig) ? await urlToBase64(hod.sig) : '';
        return {
            bg, photo, seal, signature, nita, tveta, hodSig,
            studentName: row.student_name || row.name,
            admissionNumber: row.admission_number || row.student_id,
            courseName: row.course_name,
            hodName,
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

    // Date columns serialize as UTC-midnight-shifted ISO strings; render the date
    // input from LOCAL components so an unchanged save doesn't drift by ±1 day.
    function toInputDate(v) {
        if (!v) return '';
        const d = new Date(v);
        if (isNaN(d.getTime())) return String(v).slice(0, 10);
        const p = n => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    }

    function openEdit(c) {
        setEditForm({
            certificate_number: c.certificate_number || '',
            award_date: toInputDate(c.award_date),
            hod_name: c.hod_name || hodForCourse(c.course_name).hod || '',
            student_name: c.student_name || '',
            course_name: c.course_name || ''
        });
        setEditTarget(c);
    }
    const closeEdit = () => setEditTarget(null);

    async function handleEditSave() {
        if (!editTarget) return;
        const certificate_number = editForm.certificate_number.trim();
        const student_name = editForm.student_name.trim();
        const course_name = editForm.course_name.trim();
        if (!certificate_number) { notify('Certificate number is required.', 'error'); return; }
        if (!editForm.award_date) { notify('Award date is required.', 'error'); return; }
        if (!student_name) { notify('Student name is required.', 'error'); return; }
        if (!course_name) { notify('Course name is required.', 'error'); return; }
        setBusy(true);
        try {
            await certificatesAPI.update(editTarget.id, {
                certificate_number,
                award_date: editForm.award_date,
                hod_name: editForm.hod_name.trim(),
                student_name,
                course_name
            });
            notify(`Certificate ${certificate_number} updated.`, 'success');
            closeEdit();
            loadIssued();
            load();
        } catch (e) {
            notify(e.response?.data?.error || 'Failed to update certificate.', 'error');
        } finally { setBusy(false); }
    }

    async function captureCanvas() {
        const el = certRef.current;
        if (!el) throw new Error('Template not ready.');

        // html2canvas mispositions the absolutely-positioned panels when the
        // template lives inside the preview modal (transform-scaled wrapper +
        // backdrop-filter + scrollable overlay): the PDF then shows panels and
        // text shifted down over the background. Fix: move the template node
        // into a clean body-level fixed container for the capture, then put it
        // back exactly where it was.
        const holder = document.createElement('div');
        holder.style.cssText = `position:fixed;left:0;top:0;width:${CERT_W}px;height:${CERT_H}px;z-index:99999;background:${IVORY};`;
        const parent = el.parentElement;
        const next = el.nextSibling;
        document.body.appendChild(holder);
        holder.appendChild(el);

        try {
            return await captureCertificate(el);
        } finally {
            if (parent) parent.insertBefore(el, next);
            holder.remove();
        }
    }

    async function handleDownload() {
        setBusy(true);
        try {
            const canvas = await captureCanvas();
            // Size the PDF page to the canvas geometry (1536×1024 ≈ 3:2) instead of
            // forcing it into A4's 1.414:1 ratio. Stretching the wider canvas into A4
            // squeezed text horizontally, causing words to collide and decorative lines
            // to overlap text. Keeping the native 3:2 ratio (widest edge = 297mm) means
            // the PDF matches the preview exactly and nothing overlaps.
            const pw = 297; // mm — landscape long edge
            const ph = Math.round(pw * (canvas.height / canvas.width)); // ≈198mm
            const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [pw, ph] });
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

    // The scaled preview height: the template is 1024px tall scaled to PREVIEW_SCALE.
    const scaledH = Math.round(CERT_H * PREVIEW_SCALE); // 635px

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-end justify-between">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-black text-maroon uppercase tracking-tight">Certificates</h1>
                    <p className="text-xs text-maroon/40 font-bold tracking-widest mt-1">Qualification Award &amp; Issuance Register</p>
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
                        : filteredEligible.length === 0 ? <p className="text-maroon/40 font-bold text-sm py-8 text-center">No graduated students are eligible yet. Mark a student as "Graduated" (or set a completion date) to issue a certificate.</p>
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
                                            : <td className="py-3 px-3 text-[11px] font-bold text-red-600/80"><div>{formatDate(c.revoked_at)}</div><div className="text-black/50 font-semibold normal-case">"{c.revoke_reason || '—'}"</div></td>}
                                        <td className="py-3 px-3 text-right whitespace-nowrap">
                                            <button onClick={() => openPreview({ ...c, student_name: c.student_name, student_id: c.student_id, photo: c.student_photo, already_issued: true })} className="px-3 py-1.5 rounded-lg bg-white border border-maroon/20 text-maroon text-[10px] font-black uppercase tracking-wider hover:border-maroon/40">View</button>
                                            {issuedFilter === 'Issued' && canIssue && (
                                                <button onClick={() => openEdit(c)} className="ml-2 px-3 py-1.5 rounded-lg bg-white border border-maroon/20 text-maroon text-[10px] font-black uppercase tracking-wider hover:border-maroon/40 inline-flex items-center gap-1"><Pencil className="w-3.5 h-3.5" /> Edit</button>
                                            )}
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

            {/* Edit certificate modal */}
            {editTarget && (
                <div className="fixed inset-0 bg-maroon/50 backdrop-blur-md flex items-center justify-center p-4 z-[70]" onClick={closeEdit}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
                        <h3 className="text-sm font-black text-maroon uppercase tracking-widest mb-1">Edit Certificate</h3>
                        <p className="text-[12px] font-bold text-black/60 mb-4">
                            Update <span className="font-black text-maroon">{editTarget.certificate_number}</span> for {editTarget.student_name}. The certificate design stays unchanged.
                        </p>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-maroon/50 mb-1">Student Name</label>
                        <input value={editForm.student_name} onChange={e => setEditForm(f => ({ ...f, student_name: e.target.value }))} className="w-full px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold text-maroon outline-none focus:ring-2 focus:ring-maroon/10 mb-3" />
                        <label className="block text-[10px] font-black uppercase tracking-widest text-maroon/50 mb-1">Course / Qualification</label>
                        <input value={editForm.course_name} onChange={e => setEditForm(f => ({ ...f, course_name: e.target.value }))} className="w-full px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold text-maroon outline-none focus:ring-2 focus:ring-maroon/10 mb-3" />
                        <label className="block text-[10px] font-black uppercase tracking-widest text-maroon/50 mb-1">Certificate Number</label>
                        <input value={editForm.certificate_number} onChange={e => setEditForm(f => ({ ...f, certificate_number: e.target.value }))} className="w-full px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm font-black text-maroon outline-none focus:ring-2 focus:ring-maroon/10 mb-3" />
                        <label className="block text-[10px] font-black uppercase tracking-widest text-maroon/50 mb-1">Award Date</label>
                        <input type="date" value={editForm.award_date} onChange={e => setEditForm(f => ({ ...f, award_date: e.target.value }))} className="w-full px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold text-maroon outline-none focus:ring-2 focus:ring-maroon/10 mb-3" />
                        <label className="block text-[10px] font-black uppercase tracking-widest text-maroon/50 mb-1">Head of Department</label>
                        <input value={editForm.hod_name} onChange={e => setEditForm(f => ({ ...f, hod_name: e.target.value }))} placeholder="Leave blank for default course HOD" className="w-full px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold text-maroon outline-none focus:ring-2 focus:ring-maroon/10 mb-1" />
                        <p className="text-[10px] font-bold text-black/40 mb-4">A blank field uses the automatic HOD for this course; the handwritten signature only appears for the automatic HOD.</p>
                        <div className="flex gap-3 justify-end mt-2">
                            <button onClick={closeEdit} disabled={busy} className="px-4 py-2.5 rounded-xl bg-white border border-maroon/20 text-maroon text-[11px] font-black uppercase tracking-widest hover:border-maroon/40 disabled:opacity-50">Cancel</button>
                            <button onClick={handleEditSave} disabled={busy} className="px-4 py-2.5 rounded-xl bg-maroon text-gold text-[11px] font-black uppercase tracking-widest hover:bg-elite-maroon disabled:opacity-50 inline-flex items-center gap-2">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pencil className="w-4 h-4" />} Save Changes</button>
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

                        {/* ── Scaled preview container ──────────────────────────────────
                            The outer div sets the rendered height so the modal doesn't
                            collapse. Its width uses maxWidth to cap at the scaled cert
                            width. The inner scaleRef div holds the CSS scale transform
                            with transformOrigin top-left; width/height must match the
                            unscaled certificate so the scaled element fits correctly.
                            During PDF capture, captureCanvas() temporarily sets
                            transform:none and restores the original value after. */}
                        <div
                            className="border border-gray-200 rounded-xl overflow-hidden bg-gray-50 flex justify-center"
                            style={{ height: scaledH }}
                        >
                            <div style={{ width: Math.round(CERT_W * PREVIEW_SCALE), flexShrink: 0 }}>
                                <div
                                    ref={scaleRef}
                                    style={{
                                        transform: `scale(${PREVIEW_SCALE})`,
                                        transformOrigin: 'top left',
                                        width: CERT_W,
                                        height: CERT_H,
                                    }}
                                >
                                    <CertificateTemplate data={preview.data} innerRef={certRef} />
                                </div>
                            </div>
                        </div>

                        {!preview.issued && !preview.data.photo && (
                            <p className="text-[11px] font-bold text-amber-700 mt-2">⚠ This student has no passport photo on file. Add one before final issuance unless authorized.</p>
                        )}

                        <div className="flex flex-wrap gap-3 justify-end mt-4">
                            {canIssue && !preview.issued && (
                                <button onClick={handleIssue} disabled={busy} className="px-5 py-3 rounded-xl bg-emerald-600 text-white text-[11px] font-black uppercase tracking-widest hover:bg-emerald-700 disabled:opacity-50 inline-flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Issue Certificate</button>
                            )}
                            {preview.issued && (
                                <>
                                    <button onClick={handleDownload} disabled={busy} className="px-5 py-3 rounded-xl bg-maroon text-gold text-[11px] font-black uppercase tracking-widest hover:bg-elite-maroon disabled:opacity-50 inline-flex items-center gap-2"><Download className="w-4 h-4" /> {busy ? 'Generating…' : 'Download PDF'}</button>
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
