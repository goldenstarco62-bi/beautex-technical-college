import React from 'react';
import { FieldRow, Inp, TagInputList, Toggle } from './atoms';

export default function TabStudent(ctx) {
    const { settings, set } = ctx;
    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-100 dark:border-white/5 p-6 space-y-4 shadow-sm">
                    <div>
                        <h4 className="text-xs font-black uppercase tracking-widest text-maroon dark:text-gold border-b border-gray-100 dark:border-white/5 pb-2">Admission Configuration</h4>
                        <p className="text-[9px] text-zinc-400 font-semibold mt-1">Configure student admission formats and system filters.</p>
                    </div>
                    <FieldRow label="Admission Number Template" description="The format for generating student admission codes.">
                        <Inp value={settings.admission_number_format} onChange={e=>set('admission_number_format',e.target.value)} mono />
                        <div className="mt-2.5 p-3.5 bg-gray-50 dark:bg-white/[0.02] border border-dashed border-gray-200 dark:border-white/10 rounded-2xl text-left">
                            <span className="text-[7.5px] font-black text-zinc-400 uppercase tracking-widest block mb-1">Generated Example Preview</span>
                            <span className="text-xs font-mono font-black text-maroon dark:text-gold">{settings.admission_number_format || 'BTC/2026/001'}</span>
                        </div>
                    </FieldRow>
                    <FieldRow label="Enrollment Categories" description="Configure classifications of students admitted to the college.">
                        <TagInputList value={settings.student_categories} onChange={val=>set('student_categories',val)} placeholder="e.g. Part-Time" />
                    </FieldRow>
                </div>

                <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-100 dark:border-white/5 p-6 space-y-4 shadow-sm">
                    <div>
                        <h4 className="text-xs font-black uppercase tracking-widest text-maroon dark:text-gold border-b border-gray-100 dark:border-white/5 pb-2">Student Life Cycle Registry</h4>
                        <p className="text-[9px] text-zinc-400 font-semibold mt-1">Life cycle stages available on student records.</p>
                    </div>
                    <FieldRow label="Life Cycle Status Codes" description="Stages through which students progress during their studies.">
                        <TagInputList value={settings.student_statuses} onChange={val=>set('student_statuses',val)} placeholder="e.g. Graduated" />
                    </FieldRow>
                </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-100 dark:border-white/5 p-6 space-y-4 shadow-sm">
                <div>
                    <h4 className="text-xs font-black uppercase tracking-widest text-maroon dark:text-gold border-b border-gray-100 dark:border-white/5 pb-2">Student Portal Access Controls</h4>
                    <p className="text-[9px] text-zinc-400 font-semibold mt-1">Configure student access permissions inside the personal dashboard.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    {[
                        { key:'student_portal_results', label:'Academic Grades & Results Publishing', desc: 'Allows students to view their grade transcripts.' },
                        { key:'student_portal_fees', label:'Financial Statement & Invoices Check', desc: 'Allows access to fee statements and payment modules.' },
                        { key:'student_portal_timetables', label:'Interactive Lecture Timetables', desc: 'Allows students to view their timetables.' },
                        { key:'student_portal_materials', label:'E-Learning Material Downloads', desc: 'Allows access to lecture notes and resources.' },
                        { key:'student_portal_certificates', label:'Official Graduation Awards & Certificates', desc: 'Allows downloading printable awards.' },
                        { key:'student_portal_attendance', label:'Attendance Compliance Auditing', desc: 'Allows students to check their attendance compliance rate.' },
                    ].map(i => (
                        <div key={i.key} className="flex items-center justify-between p-4 bg-gray-50/50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/5 rounded-3xl hover:border-gold/20 transition-colors">
                            <div className="pr-4 text-left">
                                <p className="text-xs font-black uppercase tracking-wide text-zinc-700 dark:text-zinc-200">{i.label}</p>
                                <p className="text-[8.5px] text-zinc-400 font-medium leading-relaxed mt-0.5">{i.desc}</p>
                            </div>
                            <Toggle value={settings[i.key]} onChange={v=>set(i.key,v)} />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
