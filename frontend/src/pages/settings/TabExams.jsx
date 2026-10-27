import React from 'react';
import { FieldRow, TagInputList } from './atoms';

export default function TabExams(ctx) {
    const { settings, set } = ctx;
    const bandVal = (key, fallback) => {
        const n = parseFloat(settings[key]);
        return Number.isFinite(n) ? n : fallback;
    };
    const dist = bandVal('grading_distinction_min', 70);
    const credit = bandVal('grading_credit_min', 60);
    const pass = bandVal('grading_pass_min', 50);
    const fail = bandVal('grading_fail_min', 0);
    const bandErrors = [];
    if (dist > 100 || credit > 100 || pass > 100 || fail < 0) bandErrors.push('Grade boundaries must sit between 0 and 100%.');
    if (!(dist > credit)) bandErrors.push('Distinction minimum must be higher than the Credit minimum.');
    if (!(credit > pass)) bandErrors.push('Credit minimum must be higher than the Pass minimum.');
    if (!(pass > fail)) bandErrors.push('Pass minimum must be higher than the Fail minimum.');
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in duration-300">
            <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-100 dark:border-white/5 p-6 space-y-5 shadow-sm">
                <div>
                    <h4 className="text-xs font-black uppercase tracking-widest text-maroon dark:text-gold border-b border-gray-100 dark:border-white/5 pb-2">Academic Assessment Configurations</h4>
                    <p className="text-[9px] text-zinc-400 font-semibold mt-1">Configure grading bands and assessment categories.</p>
                </div>
                <FieldRow label="Assessment Formats" description="The catalog of academic assessments used for grading calculations.">
                    <TagInputList value={settings.assessment_types} onChange={val=>set('assessment_types',val)} placeholder="e.g. CAT" />
                </FieldRow>
                
                <p className="text-[9.5px] font-black text-zinc-400 uppercase tracking-widest border-b border-gray-100 dark:border-white/5 pb-2 pt-2">Grade Bands Boundaries (%)</p>
                <div className="grid grid-cols-2 gap-4">
                    {[
                        {key:'grading_distinction_min',label:'Distinction Min %',c:'border-green-200 dark:border-green-950/20 bg-green-50/50 dark:bg-green-950/10 text-green-700 dark:text-green-400'},
                        {key:'grading_credit_min',label:'Credit Min %',c:'border-blue-200 dark:border-blue-950/20 bg-blue-50/50 dark:bg-blue-950/10 text-blue-700 dark:text-blue-400'},
                        {key:'grading_pass_min',label:'Pass Min %',c:'border-amber-200 dark:border-amber-950/20 bg-amber-50/50 dark:bg-amber-950/10 text-amber-700 dark:text-gold'},
                        {key:'grading_fail_min',label:'Fail Min %',c:'border-red-200 dark:border-red-950/20 bg-red-50/50 dark:bg-red-950/10 text-red-600 dark:text-red-400'},
                    ].map(b=>(
                        <div key={b.key} className={`p-4 border rounded-2xl text-left ${b.c} flex justify-between items-center`}>
                            <span className="text-[9px] font-black uppercase tracking-widest block leading-none">{b.label.split(' ')[0]} Threshold</span>
                            <input type="number" value={settings[b.key]||''} onChange={e=>set(b.key,e.target.value)} className="w-16 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-white/10 rounded-lg px-2 py-1 text-center text-xs font-black outline-none focus:ring-1 focus:ring-maroon" />
                        </div>
                    ))}
                </div>

                {bandErrors.length > 0 && (
                    <div role="alert" className="p-3.5 rounded-xl border border-red-200 dark:border-red-950/40 bg-red-50/70 dark:bg-red-950/10 space-y-1 text-left">
                        <p className="text-[9px] font-black uppercase tracking-widest text-red-600 dark:text-red-400">Inconsistent Grade Bands</p>
                        {bandErrors.map((err, i) => (
                            <p key={i} className="text-[9.5px] text-red-700 dark:text-red-300 font-semibold leading-relaxed">{err}</p>
                        ))}
                    </div>
                )}
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-100 dark:border-white/5 p-6 shadow-sm flex flex-col justify-between">
                <div>
                    <h4 className="text-xs font-black uppercase tracking-widest text-maroon dark:text-gold border-b border-gray-100 dark:border-white/5 pb-2">Grading System Visual Graph</h4>
                    <p className="text-[9px] text-zinc-400 font-semibold mt-1">Graphical breakdown of academic performance brackets.</p>
                </div>

                <div className="flex-1 flex flex-col justify-center gap-4 mt-6">
                    {[
                        { label: 'Distinction Bracket', val: settings.grading_distinction_min || 70, max: 100, color: 'bg-green-500', desc: 'Represents exceptional academic performance.' },
                        { label: 'Credit Bracket', val: settings.grading_credit_min || 60, max: settings.grading_distinction_min || 70, color: 'bg-blue-500', desc: 'Represents highly competent mastery.' },
                        { label: 'Pass Bracket', val: settings.grading_pass_min || 50, max: settings.grading_credit_min || 60, color: 'bg-amber-500', desc: 'Represents minimum standard compliance.' },
                        { label: 'Fail Bracket', val: settings.grading_fail_min || 0, max: settings.grading_pass_min || 50, color: 'bg-red-500', desc: 'Requires re-examination or academic recovery.' }
                    ].map((band, idx) => (
                        <div key={idx} className="space-y-1.5 text-left">
                            <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-wider text-zinc-500">
                                <span>{band.label}</span>
                                <span className="font-mono text-zinc-700 dark:text-zinc-300">{band.val}% to {band.max}%</span>
                            </div>
                            <div className="h-3 w-full bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden flex">
                                <div className="h-full bg-gray-300 dark:bg-zinc-800" style={{ width: `${band.val}%` }} />
                                <div className={`h-full ${band.color}`} style={{ width: `${band.max - band.val}%` }} />
                            </div>
                            <p className="text-[8px] text-zinc-400 font-medium italic">{band.desc}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
