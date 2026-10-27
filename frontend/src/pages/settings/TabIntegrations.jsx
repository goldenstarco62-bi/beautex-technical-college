import React from 'react';
import { RefreshCw, Zap } from 'lucide-react';
import { FieldRow, Inp, PwdField, Toggle } from './atoms';

export default function TabIntegrations(ctx) {
    const { settings, set, testingIntegration, integrationStatus, triggerTestIntegration, systemStatus } = ctx;
    const statusTone = (s) =>
        s === 'connected' || s === 'online' ? 'text-emerald-700 bg-emerald-50 border-emerald-200/50 dark:bg-emerald-950/20 dark:text-emerald-400'
            : s === 'configured' ? 'text-blue-700 bg-blue-50 border-blue-200/50 dark:bg-blue-950/20 dark:text-blue-400'
                : s === 'not_configured' ? 'text-amber-700 bg-amber-50 border-amber-200/50 dark:bg-amber-950/20 dark:text-amber-400'
                    : 'text-red-700 bg-red-50 border-red-200/50 dark:bg-red-950/20 dark:text-red-400';
    const statusLabel = (s) =>
        s === 'connected' ? 'Connected' : s === 'configured' ? 'Saved · Unverified'
            : s === 'not_configured' ? 'Not Configured' : s === 'offline' ? 'Offline'
                : s === 'error' ? 'Failed' : 'Unknown';
    const resultFor = (key) => integrationStatus[key] || (systemStatus ? systemStatus[key] : null);
    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* M-Pesa Integration Card */}
            <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-100 dark:border-white/5 p-6 space-y-4 shadow-sm text-left">
                <div className="flex justify-between items-center border-b border-gray-100 dark:border-white/5 pb-2">
                    <div>
                        <h4 className="text-xs font-black uppercase tracking-widest text-maroon dark:text-gold">M-Pesa Merchant Gateway</h4>
                        <p className="text-[9px] text-zinc-400 font-semibold mt-0.5">Safaricom Daraja API configurations for real-time mobile receipts.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button type="button" onClick={() => triggerTestIntegration('mpesa')} disabled={testingIntegration['mpesa']}
                            className="text-[8px] font-black uppercase tracking-widest border border-dashed border-gray-300 dark:border-white/10 hover:border-gold hover:text-maroon dark:hover:text-gold px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm bg-white dark:bg-zinc-800">
                            {testingIntegration['mpesa'] ? <RefreshCw className="w-2.5 h-2.5 animate-spin" /> : <Zap className="w-2.5 h-2.5 text-yellow-500" />}
                            {testingIntegration['mpesa'] ? 'Testing Connection...' : 'Test Connection'}
                        </button>
                        <Toggle value={settings.mpesa_status} onChange={v=>set('mpesa_status',v)} />
                    </div>
                </div>

                {resultFor('mpesa') && (
                    <div className={`p-3 border rounded-xl text-[8.5px] font-mono leading-relaxed ${statusTone(resultFor('mpesa').status)}`}>
                        [{statusLabel(resultFor('mpesa').status)}] {resultFor('mpesa').message}
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FieldRow label="Paybill Shortcode" description="Your business LIPA NA M-PESA paybill shortcode."><Inp value={settings.mpesa_shortcode} onChange={e=>set('mpesa_shortcode',e.target.value)} mono /></FieldRow>
                    <FieldRow label="Consumer API Key"><Inp value={settings.mpesa_consumer_key} onChange={e=>set('mpesa_consumer_key',e.target.value)} mono /></FieldRow>
                    <FieldRow label="Consumer Client Secret"><PwdField value={settings.mpesa_consumer_secret} onChange={e=>set('mpesa_consumer_secret',e.target.value)} /></FieldRow>
                    <FieldRow label="API Passkey"><PwdField value={settings.mpesa_passkey} onChange={e=>set('mpesa_passkey',e.target.value)} /></FieldRow>
                    <FieldRow label="Instant Callback URL" description="Target endpoint routing payment confirmations from Safaricom."><Inp value={settings.mpesa_callback_url} onChange={e=>set('mpesa_callback_url',e.target.value)} /></FieldRow>
                </div>
            </div>

            {/* API Integration Keys */}
            <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-100 dark:border-white/5 p-6 space-y-4 shadow-sm text-left">
                <div>
                    <h4 className="text-xs font-black uppercase tracking-widest text-maroon dark:text-gold border-b border-gray-100 dark:border-white/5 pb-2">External Calendar & Meeting SDK Credentials</h4>
                    <p className="text-[9px] text-zinc-400 font-semibold mt-1">Manage API keys routing virtual classrooms and Google Calendars.</p>
                </div>

                <div className="space-y-4">
                    {[
                        { key: 'google_calendar', label: 'Google Calendar Sync SDK', field: 'google_calendar_api_key', desc: 'Synchronizes academic term dates and class timetables to Google Calendar.' },
                        { key: 'zoom', label: 'Zoom Video Webinars SDK', field: 'zoom_api_key', desc: 'Authenticates virtual classroom streams and triggers Zoom meetings.' },
                        { key: 'google_meet', label: 'Google Meet API Client ID', field: 'google_meet_api_key', desc: 'Allows virtual class routing inside Google Workspace.' }
                    ].map(api => (
                        <div key={api.key} className="p-4 bg-gray-50/50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="min-w-0 flex-1">
                                <p className="text-[10px] font-black uppercase tracking-wider text-zinc-700 dark:text-zinc-200 leading-none">{api.label}</p>
                                <p className="text-[8.5px] text-zinc-400 font-semibold leading-relaxed mt-1 max-w-sm">{api.desc}</p>
                            </div>
                            <div className="flex items-center gap-3 self-end md:self-auto">
                                {resultFor(api.key) && (
                                    <div className="flex flex-col items-end gap-1 max-w-44">
                                        <span className={`text-[7.5px] font-mono px-2 py-1 rounded border whitespace-nowrap ${statusTone(resultFor(api.key).status)}`}>{statusLabel(resultFor(api.key).status)}</span>
                                        {integrationStatus[api.key] && (
                                            <span className="text-[7px] font-mono text-zinc-400 leading-snug text-right">{integrationStatus[api.key].message}</span>
                                        )}
                                    </div>
                                )}
                                <button type="button" onClick={() => triggerTestIntegration(api.key)} disabled={testingIntegration[api.key]}
                                    className="text-[8px] font-black uppercase tracking-widest border border-gray-300 dark:border-white/10 hover:border-gold hover:text-maroon dark:hover:text-gold px-2.5 py-1.5 rounded-lg transition-all shadow-sm bg-white dark:bg-zinc-800 shrink-0">
                                    {testingIntegration[api.key] ? 'Verifying...' : 'Test Sync'}
                                </button>
                                <div className="w-56"><PwdField value={settings[api.field]} onChange={e=>set(api.field,e.target.value)} /></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
