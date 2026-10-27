import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { FieldRow, Inp } from './atoms';

export default function TabCalendar(ctx) {
    const { settings, set } = ctx;
    return (
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
    );
}
