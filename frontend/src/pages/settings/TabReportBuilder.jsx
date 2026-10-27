import React from 'react';
import { FieldRow, Inp, StatusBadge, TA, Toggle } from './atoms';

export default function TabReportBuilder(ctx) {
    const { settings, set } = ctx;
    return (
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
    );
}
