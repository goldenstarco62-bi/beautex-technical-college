import React from 'react';
import { FieldRow, TagInputList } from './atoms';

export default function TabStaff(ctx) {
    const { settings, set } = ctx;
    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-100 dark:border-white/5 p-6 space-y-4 shadow-sm">
                <div>
                    <h4 className="text-xs font-black uppercase tracking-widest text-maroon dark:text-gold border-b border-gray-100 dark:border-white/5 pb-2">Staff & Personnel Categories</h4>
                    <p className="text-[9px] text-zinc-400 font-semibold mt-1">Define professional classifications for college staff members.</p>
                </div>
                <FieldRow label="Staff Classifications" description="Organizational categories to segment trainers, admins and support personnel.">
                    <TagInputList value={settings.staff_categories} onChange={val=>set('staff_categories',val)} placeholder="e.g. Lecturers" />
                </FieldRow>
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-100 dark:border-white/5 p-6 space-y-4 shadow-sm">
                <div>
                    <h4 className="text-xs font-black uppercase tracking-widest text-maroon dark:text-gold border-b border-gray-100 dark:border-white/5 pb-2">Security Access Roles</h4>
                    <p className="text-[9px] text-zinc-400 font-semibold mt-1">Roles mapping security clearances across the college CMS portal.</p>
                </div>
                <FieldRow label="Staff System Roles" description="Clearance roles that allocate user access levels.">
                    <TagInputList value={settings.staff_roles} onChange={val=>set('staff_roles',val)} placeholder="e.g. Accountant" />
                </FieldRow>
            </div>
        </div>
    );
}
