import React from 'react';
import { User, ShieldCheck, BookOpen, Calendar, Phone, Mail, MapPin } from 'lucide-react';

/**
 * StudentPassport
 * Renders an official A5-like student record / passport document for
 * Beautex Technical Training College. Meant to be rendered in a hidden
 * container and captured via html2canvas for PDF download or window.print().
 *
 * Props:
 *  - data  {Object}  — student record
 *  - role  {string}  — user role (unused but kept for parity with IDCard)
 */
export default function StudentPassport({ data, role }) {
    if (!data) return null;

    const courseList = Array.isArray(data.course) ? data.course : [data.course].filter(Boolean);
    const fmtDate = (d) => {
        if (!d) return 'N/A';
        try { return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }); }
        catch { return 'N/A'; }
    };

    const serial = `BTTC-PSP-${data.id}-${new Date().getFullYear()}`;

    return (
        <div className="passport-wrap">
            <div className="passport-doc" id={`passport-${data.id}`}>

                {/* ── Header ── */}
                <div className="passport-header">
                    {/* Watermark logo */}
                    <div className="passport-watermark">
                        <img src="/app-icon-v2.png" alt="" />
                    </div>

                    <div className="passport-header-inner">
                        {/* College logo */}
                        <img
                            src="/app-icon-v2.png"
                            alt="Beautex Logo"
                            className="passport-logo"
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                        <div className="passport-college-info">
                            <h1 className="passport-college-name">Beautex Technical Training College</h1>
                            <p className="passport-motto">"Empowering Minds. Shaping Innovation."</p>
                            <p className="passport-doc-title">OFFICIAL STUDENT PASSPORT</p>
                        </div>
                        {/* Shield badge */}
                        <div className="passport-badge">
                            <ShieldCheck size={28} color="#D4AF37" />
                        </div>
                    </div>

                    {/* Gold accent line */}
                    <div className="passport-accent-line" />
                </div>

                {/* ── Body ── */}
                <div className="passport-body">

                    {/* Left: Photo + serial */}
                    <div className="passport-left">
                        <div className="passport-photo-frame">
                            {data.photo ? (
                                <img src={data.photo} alt={data.name} className="passport-photo-img" />
                            ) : (
                                <div className="passport-photo-placeholder">
                                    <User size={40} strokeWidth={1} />
                                    <span>PHOTO REQUIRED</span>
                                </div>
                            )}
                        </div>
                        <div className="passport-id-chip">
                            <span className="passport-chip-label">Admission No.</span>
                            <span className="passport-chip-value">
                                {data.id?.toString().startsWith('BT') ? data.id : `BT${data.id}`}
                            </span>
                        </div>
                        <div className="passport-status-chip">
                            <span className={`passport-status-badge ${data.status === 'Active' ? 'status-active' : data.status === 'Graduated' ? 'status-graduated' : 'status-inactive'}`}>
                                {data.status || 'Active'}
                            </span>
                        </div>
                    </div>

                    {/* Right: Details */}
                    <div className="passport-right">
                        <div className="passport-name-row">
                            <span className="passport-field-label">Full Name</span>
                            <h2 className="passport-student-name">{data.name}</h2>
                        </div>

                        <div className="passport-divider" />

                        <div className="passport-details-grid">
                            <div className="passport-field">
                                <span className="passport-field-label">
                                    <BookOpen size={9} style={{ display: 'inline', marginRight: 3 }} />
                                    Course / Programme
                                </span>
                                <span className="passport-field-value passport-course">{courseList.join(' | ')}</span>
                            </div>
                            <div className="passport-field">
                                <span className="passport-field-label">
                                    <Calendar size={9} style={{ display: 'inline', marginRight: 3 }} />
                                    Intake
                                </span>
                                <span className="passport-field-value">{data.intake || data.semester || 'N/A'}</span>
                            </div>
                            <div className="passport-field">
                                <span className="passport-field-label">
                                    <Calendar size={9} style={{ display: 'inline', marginRight: 3 }} />
                                    Date of Registration
                                </span>
                                <span className="passport-field-value">{fmtDate(data.enrolled_date)}</span>
                            </div>
                            <div className="passport-field">
                                <span className="passport-field-label">
                                    <Calendar size={9} style={{ display: 'inline', marginRight: 3 }} />
                                    Date of Completion
                                </span>
                                <span className="passport-field-value">{fmtDate(data.completion_date)}</span>
                            </div>
                            <div className="passport-field">
                                <span className="passport-field-label">
                                    <User size={9} style={{ display: 'inline', marginRight: 3 }} />
                                    Date of Birth
                                </span>
                                <span className="passport-field-value">{fmtDate(data.dob)}</span>
                            </div>
                            <div className="passport-field">
                                <span className="passport-field-label">Blood Group</span>
                                <span className="passport-field-value">{data.blood_group || 'N/A'}</span>
                            </div>
                        </div>

                        <div className="passport-divider" />

                        {/* Contact row */}
                        <div className="passport-contact-row">
                            <div className="passport-contact-item">
                                <Phone size={9} />
                                <span>{data.contact || 'N/A'}</span>
                            </div>
                            <div className="passport-contact-item">
                                <Mail size={9} />
                                <span>{data.email || 'N/A'}</span>
                            </div>
                            {data.address && (
                                <div className="passport-contact-item">
                                    <MapPin size={9} />
                                    <span>{data.address}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* ── Guardian Section ── */}
                {(data.guardian_name || data.guardian_contact) && (
                    <div className="passport-guardian">
                        <p className="passport-section-label">Next of Kin / Emergency Contact</p>
                        <div className="passport-guardian-grid">
                            <div className="passport-field">
                                <span className="passport-field-label">Name</span>
                                <span className="passport-field-value">{data.guardian_name || 'N/A'}</span>
                            </div>
                            <div className="passport-field">
                                <span className="passport-field-label">Phone</span>
                                <span className="passport-field-value">{data.guardian_contact || 'N/A'}</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Signature Row ── */}
                <div className="passport-signatures">
                    <div className="passport-sig-block">
                        <div className="passport-sig-line" />
                        <p className="passport-sig-label">Student Signature</p>
                    </div>
                    <div className="passport-seal">
                        <div className="passport-seal-circle">
                            <ShieldCheck size={22} color="#800000" strokeWidth={1.5} />
                        </div>
                        <p className="passport-seal-text">OFFICIAL SEAL</p>
                    </div>
                    <div className="passport-sig-block">
                        <div className="passport-sig-line" />
                        <p className="passport-sig-label">Registrar / Principal</p>
                    </div>
                </div>

                {/* ── Footer ── */}
                <div className="passport-footer">
                    <div className="passport-footer-left">
                        <p>Utawala – Geokarma Building, Behind Astrol Petrol Station</p>
                        <p>Tel: 0708 247 557</p>
                    </div>
                    <div className="passport-footer-right">
                        <p className="passport-serial">Serial: {serial}</p>
                        <p>Generated: {new Date().toLocaleDateString('en-GB')}</p>
                    </div>
                </div>
            </div>

            {/* ─── Scoped styles ─── */}
            <style>{`
                .passport-wrap {
                    font-family: 'Inter', 'Segoe UI', Arial, sans-serif;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 16px;
                }
                .passport-doc {
                    position: relative;
                    width: 190mm;
                    background: #fff;
                    border: 0.3mm solid #d1c4a0;
                    border-radius: 3mm;
                    overflow: hidden;
                    box-shadow: 0 4px 30px rgba(0,0,0,0.12);
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                }

                /* ── Header ── */
                .passport-header {
                    position: relative;
                    background: #800000;
                    padding: 14px 18px 0;
                    overflow: hidden;
                }
                .passport-watermark {
                    position: absolute;
                    inset: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    pointer-events: none;
                }
                .passport-watermark img {
                    width: 120px;
                    height: 120px;
                    opacity: 0.04;
                    filter: grayscale(1);
                }
                .passport-header-inner {
                    display: flex;
                    align-items: center;
                    gap: 14px;
                    position: relative;
                    z-index: 1;
                }
                .passport-logo {
                    width: 44px;
                    height: 44px;
                    object-fit: contain;
                    border-radius: 8px;
                    background: rgba(255,255,255,0.1);
                    padding: 4px;
                    flex-shrink: 0;
                }
                .passport-college-info {
                    flex: 1;
                }
                .passport-college-name {
                    font-size: 13pt;
                    font-weight: 900;
                    color: #fff;
                    text-transform: uppercase;
                    letter-spacing: 0.04em;
                    line-height: 1.1;
                    margin: 0;
                }
                .passport-motto {
                    font-size: 7pt;
                    color: #D4AF37;
                    font-style: italic;
                    font-weight: 600;
                    margin: 3px 0 0;
                    letter-spacing: 0.02em;
                }
                .passport-doc-title {
                    font-size: 6.5pt;
                    font-weight: 900;
                    color: rgba(255,255,255,0.6);
                    text-transform: uppercase;
                    letter-spacing: 0.15em;
                    margin: 4px 0 0;
                }
                .passport-badge {
                    flex-shrink: 0;
                    width: 46px;
                    height: 46px;
                    border-radius: 50%;
                    border: 1.5px solid rgba(212,175,55,0.4);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: rgba(255,255,255,0.05);
                }
                .passport-accent-line {
                    height: 3px;
                    background: linear-gradient(90deg, #D4AF37 0%, #f5e06e 50%, #D4AF37 100%);
                    margin-top: 12px;
                }

                /* ── Body ── */
                .passport-body {
                    display: flex;
                    gap: 18px;
                    padding: 16px 18px;
                    min-height: 60mm;
                }
                .passport-left {
                    flex-shrink: 0;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 8px;
                }
                .passport-photo-frame {
                    width: 35mm;
                    height: 44mm;
                    border: 2px solid #800000;
                    border-radius: 4px;
                    overflow: hidden;
                    background: #f8f4ee;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: inset 0 0 0 1px rgba(128,0,0,0.08);
                }
                .passport-photo-img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }
                .passport-photo-placeholder {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 6px;
                    color: #c9b88a;
                }
                .passport-photo-placeholder span {
                    font-size: 5.5pt;
                    font-weight: 900;
                    text-transform: uppercase;
                    letter-spacing: 0.08em;
                    color: #c9b88a;
                }
                .passport-id-chip {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    background: #800000;
                    border-radius: 6px;
                    padding: 4px 10px;
                    width: 100%;
                }
                .passport-chip-label {
                    font-size: 5pt;
                    font-weight: 900;
                    color: #D4AF37;
                    text-transform: uppercase;
                    letter-spacing: 0.1em;
                }
                .passport-chip-value {
                    font-size: 8pt;
                    font-weight: 900;
                    color: #fff;
                    font-family: monospace;
                    letter-spacing: 0.05em;
                }
                .passport-status-chip {
                    width: 100%;
                    display: flex;
                    justify-content: center;
                }
                .passport-status-badge {
                    font-size: 6pt;
                    font-weight: 900;
                    text-transform: uppercase;
                    letter-spacing: 0.12em;
                    padding: 2px 10px;
                    border-radius: 20px;
                }
                .status-active { background: #dcfce7; color: #16a34a; }
                .status-graduated { background: #dbeafe; color: #1d4ed8; }
                .status-inactive { background: #f3f4f6; color: #6b7280; }

                /* ── Right panel ── */
                .passport-right { flex: 1; min-width: 0; }
                .passport-name-row { margin-bottom: 6px; }
                .passport-student-name {
                    font-size: 14pt;
                    font-weight: 900;
                    color: #1a1a1a;
                    line-height: 1.2;
                    margin: 2px 0 0;
                    letter-spacing: -0.01em;
                }
                .passport-divider {
                    height: 1px;
                    background: linear-gradient(90deg, #800000 0%, rgba(128,0,0,0.1) 100%);
                    margin: 8px 0;
                    opacity: 0.2;
                }
                .passport-details-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 8px 16px;
                }
                .passport-field {
                    display: flex;
                    flex-direction: column;
                    gap: 1px;
                }
                .passport-field-label {
                    font-size: 6pt;
                    font-weight: 900;
                    color: #800000;
                    text-transform: uppercase;
                    letter-spacing: 0.12em;
                    opacity: 0.7;
                }
                .passport-field-value {
                    font-size: 8.5pt;
                    font-weight: 700;
                    color: #1a1a1a;
                    line-height: 1.3;
                }
                .passport-course {
                    font-weight: 900;
                    color: #800000;
                    font-size: 8pt;
                }
                .passport-contact-row {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 6px 14px;
                    margin-top: 2px;
                }
                .passport-contact-item {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    font-size: 7.5pt;
                    font-weight: 600;
                    color: #555;
                }

                /* ── Guardian ── */
                .passport-guardian {
                    margin: 0 18px 12px;
                    background: #fdf8f0;
                    border: 1px solid rgba(128,0,0,0.12);
                    border-radius: 6px;
                    padding: 8px 12px;
                }
                .passport-section-label {
                    font-size: 6pt;
                    font-weight: 900;
                    color: #800000;
                    text-transform: uppercase;
                    letter-spacing: 0.14em;
                    margin-bottom: 6px;
                    opacity: 0.7;
                }
                .passport-guardian-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 6px 16px;
                }

                /* ── Signatures ── */
                .passport-signatures {
                    display: flex;
                    align-items: flex-end;
                    justify-content: space-between;
                    padding: 8px 24px 12px;
                    border-top: 1px solid rgba(128,0,0,0.08);
                    margin: 0 10px;
                }
                .passport-sig-block { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 3px; }
                .passport-sig-line {
                    width: 90%;
                    border-bottom: 1px solid #ccc;
                    height: 18px;
                }
                .passport-sig-label {
                    font-size: 5.5pt;
                    font-weight: 900;
                    color: #999;
                    text-transform: uppercase;
                    letter-spacing: 0.1em;
                }
                .passport-seal {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 3px;
                }
                .passport-seal-circle {
                    width: 40px;
                    height: 40px;
                    border-radius: 50%;
                    border: 1.5px solid rgba(128,0,0,0.2);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: rgba(128,0,0,0.03);
                }
                .passport-seal-text {
                    font-size: 5pt;
                    font-weight: 900;
                    color: #800000;
                    text-transform: uppercase;
                    letter-spacing: 0.14em;
                    opacity: 0.5;
                }

                /* ── Footer ── */
                .passport-footer {
                    background: #800000;
                    padding: 7px 18px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .passport-footer-left p,
                .passport-footer-right p {
                    font-size: 6pt;
                    color: rgba(255,255,255,0.65);
                    margin: 0;
                    line-height: 1.5;
                }
                .passport-footer-right { text-align: right; }
                .passport-serial { font-family: monospace; color: #D4AF37 !important; }

                /* ── Print ── */
                @media print {
                    body * { visibility: hidden; }
                    .passport-wrap, .passport-wrap * { visibility: visible; }
                    .passport-wrap {
                        position: fixed;
                        top: 0; left: 0;
                        width: 100%; height: 100%;
                        display: flex;
                        align-items: flex-start;
                        justify-content: center;
                        padding-top: 10mm;
                        background: white !important;
                    }
                    .passport-doc {
                        box-shadow: none !important;
                    }
                }
            `}</style>
        </div>
    );
}
