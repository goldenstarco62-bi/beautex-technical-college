import React from 'react';
import { FieldRow, Inp, StatusBadge, Toggle } from './atoms';

export default function TabCertificates(ctx) {
    const { settings, set } = ctx;
    return (
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
    );
}
