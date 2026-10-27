import React from 'react';
import { FieldRow, Inp, PwdField, StatusBadge, Toggle } from './atoms';

export default function TabCommunications(ctx) {
    const { settings, set, isSuperAdmin } = ctx;
    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-100 dark:border-white/5 p-6 space-y-4 shadow-sm">
                <div>
                    <h4 className="text-xs font-black uppercase tracking-widest text-maroon dark:text-gold border-b border-gray-100 dark:border-white/5 pb-2">SMS Notification Dispatch Triggers</h4>
                    <p className="text-[9px] text-zinc-400 font-semibold mt-1">Configure events that trigger automated system SMS notifications.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2">
                    {[
                        {key:'sms_admission_confirm', label:'Admission Confirmation SMS', desc: 'Dispatched instantly when student registry admits record.'},
                        {key:'sms_fee_reminder', label:'Fee Overdue Reminders SMS', desc: 'Dispatched for outstanding invoice balances.'},
                        {key:'sms_cat_notify', label:'CAT Grades SMS', desc: 'Dispatched when continuous assessments are published.'},
                        {key:'sms_exam_notify', label:'End-Term Outcomes SMS', desc: 'Dispatched when end-of-term grades are confirmed.'},
                        {key:'sms_grad_notify', label:'Graduation Alerts SMS', desc: 'Dispatched to notify of graduation ceremonies.'},
                    ].map(s=>(
                        <div key={s.key} className="flex flex-col justify-between p-5 bg-gray-50/50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/5 rounded-3xl hover:border-gold/20 transition-all text-left gap-3">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-wider text-zinc-700 dark:text-zinc-200 leading-snug">{s.label}</p>
                                <p className="text-[8px] text-zinc-400 font-medium leading-relaxed mt-1">{s.desc}</p>
                            </div>
                            <div className="flex items-center justify-between mt-1 border-t border-gray-100 dark:border-white/5 pt-2">
                                <span className="text-[8px] font-black text-zinc-400 uppercase tracking-widest">Active Dispatch</span>
                                <Toggle value={settings[s.key]} onChange={v=>set(s.key,v)} />
                            </div>
                        </div>
                    ))}
                </div>
                
                <FieldRow label="WhatsApp Broadcast Integration" description="Enable automated notifications routing via WhatsApp Business API nodes.">
                    <div className="flex items-center gap-3"><Toggle value={settings.whatsapp_integration} onChange={v=>set('whatsapp_integration',v)} /><StatusBadge active={settings.whatsapp_integration} labelOn="Enabled" labelOff="Disabled" /></div>
                </FieldRow>
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-100 dark:border-white/5 p-6 space-y-4 shadow-sm">
                <div>
                    <h4 className="text-xs font-black uppercase tracking-widest text-maroon dark:text-gold border-b border-gray-100 dark:border-white/5 pb-2">SMS Gateway Configuration</h4>
                    <p className="text-[9px] text-zinc-400 font-semibold mt-1">Africa's Talking credentials used for outbound SMS. Saved values take precedence over server environment variables.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FieldRow label="API Key"><PwdField value={isSuperAdmin ? settings.sms_api_key : '••••••••'} onChange={e=>set('sms_api_key',e.target.value)} readOnly={!isSuperAdmin} /></FieldRow>
                    <FieldRow label="Username"><Inp value={settings.sms_username} onChange={e=>set('sms_username',e.target.value)} placeholder="e.g. sandbox" readOnly={!isSuperAdmin} /></FieldRow>
                    <FieldRow label="Sender ID"><Inp value={settings.sms_sender_id} onChange={e=>set('sms_sender_id',e.target.value)} placeholder="e.g. BEAUTEX" readOnly={!isSuperAdmin} /></FieldRow>
                </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-100 dark:border-white/5 p-6 space-y-4 shadow-sm">
                <div>
                    <h4 className="text-xs font-black uppercase tracking-widest text-maroon dark:text-gold border-b border-gray-100 dark:border-white/5 pb-2">SMTP Mail Server Configuration</h4>
                    <p className="text-[9px] text-zinc-400 font-semibold mt-1">Credentials mapping the default SMTP server for system dispatch.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FieldRow label="SMTP Hostname"><Inp value={settings.smtp_host} onChange={e=>set('smtp_host',e.target.value)} placeholder="e.g. smtp.gmail.com" readOnly={!isSuperAdmin} /></FieldRow>
                    <FieldRow label="SMTP Port"><Inp value={settings.smtp_port} onChange={e=>set('smtp_port',e.target.value)} placeholder="e.g. 587" readOnly={!isSuperAdmin} /></FieldRow>
                    <FieldRow label="SMTP Username"><Inp value={settings.smtp_user} onChange={e=>set('smtp_user',e.target.value)} placeholder="e.g. admin@beautex.edu" readOnly={!isSuperAdmin} /></FieldRow>
                    <FieldRow label="SMTP Password"><PwdField value={isSuperAdmin?settings.smtp_pass:'••••••••'} onChange={e=>set('smtp_pass',e.target.value)} readOnly={!isSuperAdmin} /></FieldRow>
                </div>
                <FieldRow label="Secure Connection (TLS)" description="Enforce SSL/TLS secure channel validation.">
                    <div className="flex items-center gap-3"><Toggle value={settings.smtp_secure} onChange={v=>set('smtp_secure',v)} locked={!isSuperAdmin} /><StatusBadge active={settings.smtp_secure} labelOn="TLS Enforced" labelOff="Standard Mode" /></div>
                </FieldRow>
            </div>
        </div>
    );
}
