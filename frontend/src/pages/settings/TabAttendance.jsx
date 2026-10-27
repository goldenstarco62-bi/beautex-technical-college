import React from 'react';
import { FieldRow, Inp, TagInputList } from './atoms';

export default function TabAttendance(ctx) {
    const { settings, set } = ctx;
    return (
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
                <FieldRow label="Minimum Attendance Requirement (%)" description="Percentage a student must attend to remain eligible for end-term assessments and certification.">
                    <div className="flex items-center gap-3">
                        <Inp type="number" value={settings.attendance_threshold_percent ?? '90'} onChange={e=>set('attendance_threshold_percent',e.target.value)} />
                        <span className={`shrink-0 text-[8px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border ${(() => { const n = parseFloat(settings.attendance_threshold_percent ?? '90'); return Number.isFinite(n) && n >= 0 && n <= 100 ? 'bg-gray-50 dark:bg-white/5 text-zinc-500 border-gray-200 dark:border-white/10' : 'bg-red-50 dark:bg-red-950/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-950/40'; })()}`}>
                            {(() => { const n = parseFloat(settings.attendance_threshold_percent ?? '90'); return Number.isFinite(n) && n >= 0 && n <= 100 ? `${n}% Threshold` : 'Invalid (0–100)'; })()}
                        </span>
                    </div>
                </FieldRow>
            </div>
        </div>
    );
}
