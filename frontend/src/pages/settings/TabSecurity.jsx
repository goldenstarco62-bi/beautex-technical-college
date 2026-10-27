import React from 'react';
import { FieldRow, Inp, StatusBadge, Toggle } from './atoms';

export default function TabSecurity(ctx) {
    const { settings, set } = ctx;
    return (
        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-100 dark:border-white/5 p-6 space-y-4 shadow-sm text-left animate-in fade-in duration-300">
            <div>
                <h4 className="text-xs font-black uppercase tracking-widest text-maroon dark:text-gold border-b border-gray-100 dark:border-white/5 pb-2">CMS Portal Security Policies</h4>
                <p className="text-[9px] text-zinc-400 font-semibold mt-1">Configure credentials rules, user sessions, and login lockout triggers.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FieldRow label="Minimum Password Length" description="Enforce minimum characters for user password updates."><Inp type="number" value={settings.password_policy_min_len} onChange={e=>set('password_policy_min_len',e.target.value)} /></FieldRow>
                <FieldRow label="Session Timeout Duration" description="Timeout user sessions after inactive minutes."><Inp type="number" value={settings.session_timeout} onChange={e=>set('session_timeout',e.target.value)} /></FieldRow>
                <FieldRow label="Lockout Login Attempts" description="Brute-force lockout trigger count."><Inp type="number" value={settings.failed_login_attempts} onChange={e=>set('failed_login_attempts',e.target.value)} /></FieldRow>
                <FieldRow label="Special Characters Required" description="Enforce passwords to contain numbers, uppercase, and symbols.">
                    <div className="flex items-center gap-3"><Toggle value={settings.password_policy_require_special} onChange={v=>set('password_policy_require_special',v)} /><StatusBadge active={settings.password_policy_require_special} labelOn="Enforced" labelOff="Standard" /></div>
                </FieldRow>
                <FieldRow label="Two-Factor Authentication" description="Enforce email OTP confirmation checks at logins.">
                    <div className="flex items-center gap-3"><Toggle value={settings.two_factor_auth} onChange={v=>set('two_factor_auth',v)} /><StatusBadge active={settings.two_factor_auth} labelOn="Enforced" labelOff="Disabled" /></div>
                </FieldRow>
                <FieldRow label="Activity logs Auditing" description="Log and audit all operator page interactions.">
                    <div className="flex items-center gap-3"><Toggle value={settings.activity_monitoring_enabled} onChange={v=>set('activity_monitoring_enabled',v)} /><StatusBadge active={settings.activity_monitoring_enabled} labelOn="Auditing" labelOff="Disabled" /></div>
                </FieldRow>
            </div>
        </div>
    );
}
