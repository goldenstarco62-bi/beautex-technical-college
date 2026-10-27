import React from 'react';
import { Toggle } from './atoms';

export default function TabLms(ctx) {
    const { settings, set } = ctx;
    return (
        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-100 dark:border-white/5 p-6 space-y-4 shadow-sm text-left animate-in fade-in duration-300">
            <div>
                <h4 className="text-xs font-black uppercase tracking-widest text-maroon dark:text-gold border-b border-gray-100 dark:border-white/5 pb-2">Learning Management System (LMS) Nodes</h4>
                <p className="text-[9px] text-zinc-400 font-semibold mt-1">Configure feature visibility inside the student e-learning dashboard portal.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                {[
                    { key:'lms_assignments_enabled', label:'Virtual Assignment Submissions', desc: 'Allows students to upload assignments directly for grading.' },
                    { key:'lms_materials_enabled', label:'Lecture Notes & Handout Library', desc: 'Publishes courseware documents uploaded by trainers.' },
                    { key:'lms_online_exams_enabled', label:'Computer Based Testing (CBT)', desc: 'Enables timed online testing modules inside the portal.' },
                    { key:'lms_online_classes_enabled', label:'Virtual Video Lectures Integration', desc: 'Allows virtual class meeting scheduling and launches.' },
                    { key:'lms_discussions_enabled', label:'Classroom Discussion Forums', desc: 'Allows group threads between students and instructors.' },
                ].map(l=>(
                    <div key={l.key} className="flex items-center justify-between p-4.5 bg-gray-50/50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/5 rounded-3xl hover:border-gold/20 transition-all gap-4">
                        <div className="min-w-0 flex-1">
                            <p className="text-xs font-black uppercase tracking-wide text-zinc-700 dark:text-zinc-200">{l.label}</p>
                            <p className="text-[8.5px] text-zinc-400 font-medium leading-relaxed mt-0.5">{l.desc}</p>
                        </div>
                        <Toggle value={settings[l.key]} onChange={v=>set(l.key,v)} />
                    </div>
                ))}
            </div>
        </div>
    );
}
