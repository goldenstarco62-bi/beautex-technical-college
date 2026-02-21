import React, { useState, useEffect } from 'react';
import {
    Settings as SettingsIcon, Save, Globe, Shield,
    Bell, Database, Download, Lock, Palette,
    Mail, Terminal, Activity, ChevronRight,
    Smartphone, Server, HardDrive, RefreshCw,
    UserPlus
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function Settings() {
    const { user } = useAuth();
    const [settings, setSettings] = useState({
        college_name: 'Beautex Technical College',
        college_abbr: 'BTC',
        academic_year: '2025/2026',
        semester: 'Semester 1',
        contact_email: 'admin@beautex.edu',
        maintenance_mode: false,
        student_portal_enabled: true,
        teacher_portal_enabled: true,
        parent_portal_enabled: true,
        allow_registration: true,
        grading_system: 'standard',
        primary_color: '#800000',
        secondary_color: '#FFD700',
        session_timeout: '30',
        smtp_host: 'smtp.beautex.edu',
        sms_api_key: '********',
        system_version: '4.2.0-ELITE'
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState('general');

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            setLoading(true);
            const response = await api.get('/settings');
            setSettings(prev => ({ ...prev, ...response.data }));
        } catch (error) {
            console.error('Failed to fetch settings:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await api.put('/settings', settings);
            alert('System Intelligence: Configuration synchronized successfully.');
        } catch (error) {
            console.error('Failed to update settings:', error);
            alert('Sync Error: Failed to commit system configuration.');
        } finally {
            setSaving(false);
        }
    };

    const handleBackup = async () => {
        try {
            const response = await api.get('/settings/backup', { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `institutional_vault_${new Date().toISOString().split('T')[0]}.sqlite`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            console.error('Vault extraction failed:', error);
            alert('Protocol Failure: Database backup extraction failed.');
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[500px] gap-4">
                <div className="w-12 h-12 border-4 border-maroon border-t-transparent rounded-full animate-spin"></div>
                <p className="text-[10px] font-black uppercase tracking-[0.5em] text-maroon/40 animate-pulse">Initializing System Framework...</p>
            </div>
        );
    }

    const sections = [
        { id: 'general', label: 'Institutional Profile', icon: Globe, desc: 'Branding and identity' },
        { id: 'academic', label: 'Academic Framework', icon: SettingsIcon, desc: 'Session and grading' },
        { id: 'portals', label: 'Access Control', icon: Shield, desc: 'Portal & security' },
        { id: 'communications', label: 'External Nodes', icon: Server, desc: 'SMTP & SMS gateway' },
        { id: 'data', label: 'Governance & Vault', icon: Database, desc: 'Backups & logs' },
        { id: 'system', label: 'System Health', icon: Activity, desc: 'Uptime & diagnostics' },
    ];

    const SettingField = ({ label, description, children }) => (
        <div className="flex flex-col md:flex-row md:items-center justify-between py-6 border-b border-gray-100 dark:border-white/5 last:border-0 gap-4">
            <div className="max-w-md">
                <p className="text-[11px] font-black text-maroon dark:text-gold uppercase tracking-widest">{label}</p>
                <p className="text-[10px] text-gray-400 font-bold uppercase mt-1 leading-relaxed">{description}</p>
            </div>
            <div className="w-full md:w-80">
                {children}
            </div>
        </div>
    );

    return (
        <div className="space-y-8 pb-20 max-w-[1400px] mx-auto">
            {/* Header */}
            <div className="bg-maroon p-12 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden border border-white/5">
                <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4"></div>
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-end gap-6">
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <Terminal className="w-6 h-6 text-gold" />
                            <span className="text-[10px] font-black uppercase tracking-[0.5em] text-white/40 italic">Kernel Management v4.2</span>
                        </div>
                        <h1 className="text-5xl font-black uppercase tracking-tight">System Core</h1>
                        <p className="text-white/60 font-medium tracking-widest uppercase text-[10px]">Institutional Governance & Infrastructure Control</p>
                    </div>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-3 bg-white/10 hover:bg-gold hover:text-maroon px-10 py-5 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all shadow-xl backdrop-blur-xl border border-white/10 disabled:opacity-50 group"
                    >
                        {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 group-hover:scale-110 transition-transform" />}
                        {saving ? 'Synchronizing...' : 'Commit Changes'}
                    </button>
                </div>
            </div>

            <div className="flex flex-col xl:flex-row gap-10">
                {/* Left Navigation */}
                <div className="w-full xl:w-80 shrink-0 space-y-2">
                    {sections.map(section => {
                        const Icon = section.icon;
                        const isActive = activeTab === section.id;
                        return (
                            <button
                                key={section.id}
                                onClick={() => setActiveTab(section.id)}
                                className={`w-full flex items-center gap-4 p-5 rounded-3xl transition-all group ${isActive
                                    ? 'bg-white dark:bg-zinc-900 shadow-xl border border-gray-100 dark:border-white/10 translate-x-1'
                                    : 'hover:bg-white/50 dark:hover:bg-white/5 text-gray-400'
                                    }`}
                            >
                                <div className={`p-3 rounded-2xl transition-all ${isActive ? 'bg-maroon text-white shadow-lg' : 'bg-gray-100 dark:bg-white/5'}`}>
                                    <Icon className="w-5 h-5" />
                                </div>
                                <div className="text-left">
                                    <p className={`text-[10px] font-black uppercase tracking-widest ${isActive ? 'text-maroon dark:text-gold' : 'text-gray-400'}`}>{section.label}</p>
                                    <p className="text-[9px] font-bold uppercase text-gray-400/60 mt-0.5">{section.desc}</p>
                                </div>
                                {isActive && <ChevronRight className="w-4 h-4 ml-auto text-maroon animate-pulse" />}
                            </button>
                        );
                    })}
                </div>

                {/* Content Area */}
                <div className="flex-1">
                    <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] shadow-2xl border border-gray-100 dark:border-white/5 overflow-hidden transition-all">
                        <div className="p-10 md:p-14">

                            {/* General Setting Tab */}
                            {activeTab === 'general' && (
                                <div className="space-y-2 animate-in fade-in duration-500">
                                    <h3 className="text-lg font-black uppercase text-maroon dark:text-gold tracking-tight mb-8">Identity & Branding</h3>

                                    <SettingField label="Institution Name" description="The official name appearing on reports, invoices and dashboard.">
                                        <input
                                            type="text"
                                            value={settings.college_name}
                                            onChange={(e) => setSettings({ ...settings, college_name: e.target.value })}
                                            className="w-full bg-gray-50 dark:bg-white/5 border-none rounded-2xl px-6 py-4 text-xs font-bold outline-none focus:ring-2 focus:ring-maroon"
                                        />
                                    </SettingField>

                                    <SettingField label="Abbreviation" description="Short form used in sidebar and navigation nodes.">
                                        <input
                                            type="text"
                                            value={settings.college_abbr}
                                            onChange={(e) => setSettings({ ...settings, college_abbr: e.target.value })}
                                            className="w-full bg-gray-50 dark:bg-white/5 border-none rounded-2xl px-6 py-4 text-xs font-bold outline-none focus:ring-2 focus:ring-maroon"
                                        />
                                    </SettingField>

                                    <SettingField label="Registry Email" description="Global administrative email for system-wide notifications.">
                                        <input
                                            type="email"
                                            value={settings.contact_email}
                                            onChange={(e) => setSettings({ ...settings, contact_email: e.target.value })}
                                            className="w-full bg-gray-50 dark:bg-white/5 border-none rounded-2xl px-6 py-4 text-xs font-bold outline-none focus:ring-2 focus:ring-maroon"
                                        />
                                    </SettingField>

                                    <SettingField label="Visual Identity" description="Set the primary and accent colors for the system UI.">
                                        <div className="flex gap-4">
                                            <div className="flex-1 flex items-center gap-3 bg-gray-50 dark:bg-white/5 rounded-2xl p-3">
                                                <input type="color" value={settings.primary_color} onChange={(e) => setSettings({ ...settings, primary_color: e.target.value })} className="w-8 h-8 rounded-lg cursor-pointer bg-transparent" />
                                                <span className="text-[10px] font-black uppercase tracking-widest">{settings.primary_color}</span>
                                            </div>
                                            <div className="flex-1 flex items-center gap-3 bg-gray-50 dark:bg-white/5 rounded-2xl p-3">
                                                <input type="color" value={settings.secondary_color} onChange={(e) => setSettings({ ...settings, secondary_color: e.target.value })} className="w-8 h-8 rounded-lg cursor-pointer bg-transparent" />
                                                <span className="text-[10px] font-black uppercase tracking-widest">{settings.secondary_color}</span>
                                            </div>
                                        </div>
                                    </SettingField>
                                </div>
                            )}

                            {/* Academic Framework Tab */}
                            {activeTab === 'academic' && (
                                <div className="space-y-2 animate-in fade-in duration-500">
                                    <h3 className="text-lg font-black uppercase text-maroon dark:text-gold tracking-tight mb-8">Academic Parameter Management</h3>

                                    <SettingField label="Active Academic Year" description="Global year for all faculty and student records.">
                                        <input
                                            type="text"
                                            value={settings.academic_year}
                                            onChange={(e) => setSettings({ ...settings, academic_year: e.target.value })}
                                            className="w-full bg-gray-50 dark:bg-white/5 border-none rounded-2xl px-6 py-4 text-xs font-bold outline-none focus:ring-2 focus:ring-maroon"
                                        />
                                    </SettingField>

                                    <SettingField label="Operational Semester" description="Current active session for enrollment and grading.">
                                        <select
                                            value={settings.semester}
                                            onChange={(e) => setSettings({ ...settings, semester: e.target.value })}
                                            className="w-full bg-gray-50 dark:bg-white/5 border-none rounded-2xl px-6 py-4 text-xs font-bold outline-none focus:ring-2 focus:ring-maroon appearance-none"
                                        >
                                            <option>Semester 1</option>
                                            <option>Semester 2</option>
                                            <option>Semester 3</option>
                                            <option>Summer Session</option>
                                        </select>
                                    </SettingField>

                                    <SettingField label="Grading Protcol" description="Computational method for calculating GPA and final marks.">
                                        <div className="flex gap-2">
                                            {['Standard', 'CWA', 'Weighted'].map(m => (
                                                <button
                                                    key={m}
                                                    onClick={() => setSettings({ ...settings, grading_system: m.toLowerCase() })}
                                                    className={`flex-1 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${settings.grading_system === m.toLowerCase() ? 'bg-maroon text-white' : 'bg-gray-50 dark:bg-white/5 text-gray-400'}`}
                                                >
                                                    {m}
                                                </button>
                                            ))}
                                        </div>
                                    </SettingField>
                                </div>
                            )}

                            {/* Portals & Security */}
                            {activeTab === 'portals' && (
                                <div className="space-y-2 animate-in fade-in duration-500">
                                    <h3 className="text-lg font-black uppercase text-maroon dark:text-gold tracking-tight mb-8">Access Control & Security</h3>

                                    <SettingField label="Maintenance Lockdown" description="Force strict maintenance mode. Only Superadmins can bypass.">
                                        <button
                                            onClick={() => setSettings({ ...settings, maintenance_mode: !settings.maintenance_mode })}
                                            className={`w-full py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all ${settings.maintenance_mode ? 'bg-red-500 border-red-600 text-white' : 'bg-gray-50 dark:bg-white/5 border-transparent text-gray-400'}`}
                                        >
                                            {settings.maintenance_mode ? 'DECOMMISSION LOCK ACTIVE' : 'SYSTEM OPERATIONAL'}
                                        </button>
                                    </SettingField>

                                    <SettingField label="Session Persistence" description="Duration of idle time before automatic session termination (minutes).">
                                        <input
                                            type="number"
                                            value={settings.session_timeout}
                                            onChange={(e) => setSettings({ ...settings, session_timeout: e.target.value })}
                                            className="w-full bg-gray-50 dark:bg-white/5 border-none rounded-2xl px-6 py-4 text-xs font-bold outline-none focus:ring-2 focus:ring-maroon"
                                        />
                                    </SettingField>

                                    <div className="mt-10 space-y-4">
                                        {[
                                            { key: 'student_portal_enabled', label: 'Student Node', icon: Lock },
                                            { key: 'teacher_portal_enabled', label: 'Faculty Node', icon: Lock },
                                            { key: 'parent_portal_enabled', label: 'External Node (Parent)', icon: Lock },
                                            { key: 'allow_registration', label: 'Open Enrollment Node', icon: UserPlus },
                                        ].map(portal => (
                                            <div key={portal.key} className="flex items-center justify-between p-6 bg-gray-50 dark:bg-white/5 rounded-3xl border border-transparent hover:border-maroon/10 transition-all">
                                                <div className="flex items-center gap-4">
                                                    <div className={`p-3 rounded-xl ${settings[portal.key] ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'}`}>
                                                        <portal.icon className="w-4 h-4" />
                                                    </div>
                                                    <p className="text-[10px] font-black uppercase tracking-widest">{portal.label}</p>
                                                </div>
                                                <button
                                                    onClick={() => setSettings({ ...settings, [portal.key]: !settings[portal.key] })}
                                                    className={`w-14 h-8 rounded-full transition-all relative ${settings[portal.key] ? 'bg-green-500' : 'bg-gray-300'}`}
                                                >
                                                    <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${settings[portal.key] ? 'right-1' : 'left-1'}`}></div>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Node Communications */}
                            {activeTab === 'communications' && (
                                <div className="space-y-4 animate-in fade-in duration-500 text-center py-20">
                                    <div className="w-20 h-20 bg-maroon/5 rounded-full flex items-center justify-center mx-auto mb-6">
                                        <Smartphone className="w-10 h-10 text-maroon" />
                                    </div>
                                    <h3 className="text-lg font-black uppercase text-maroon">Communication Gateways</h3>
                                    <p className="text-xs text-gray-400 max-w-sm mx-auto font-medium uppercase tracking-widest leading-relaxed mb-10">Configure external notification engines for SMTP and global SMS providers.</p>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
                                        <div className="p-8 bg-gray-50 dark:bg-white/5 rounded-[2rem] border border-transparent hover:border-maroon/10 transition-all space-y-4">
                                            <div className="flex items-center gap-3">
                                                <Mail className="w-5 h-5 text-maroon" />
                                                <span className="text-xs font-black uppercase tracking-widest">SMTP Host</span>
                                            </div>
                                            <input type="text" value={settings.smtp_host} className="w-full bg-white dark:bg-black/20 border-none rounded-xl px-4 py-3 text-xs font-bold" readOnly />
                                            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Status: ENCRYPTED</p>
                                        </div>
                                        <div className="p-8 bg-gray-50 dark:bg-white/5 rounded-[2rem] border border-transparent hover:border-maroon/10 transition-all space-y-4">
                                            <div className="flex items-center gap-3">
                                                <Smartphone className="w-5 h-5 text-maroon" />
                                                <span className="text-xs font-black uppercase tracking-widest">SMS API Node</span>
                                            </div>
                                            <input type="text" value={settings.sms_api_key} className="w-full bg-white dark:bg-black/20 border-none rounded-xl px-4 py-3 text-xs font-bold" readOnly />
                                            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Provider: AFRICA'S TALKING</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Data Governance Tab */}
                            {activeTab === 'data' && (
                                <div className="space-y-6 animate-in fade-in duration-500">
                                    <h3 className="text-lg font-black uppercase text-maroon dark:text-gold tracking-tight mb-8">Data Governance & Registry Vault</h3>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div className="p-10 bg-maroon/[0.02] border border-maroon/5 rounded-[2.5rem] space-y-6">
                                            <HardDrive className="w-10 h-10 text-maroon" />
                                            <div>
                                                <h4 className="text-sm font-black uppercase tracking-widest mb-1 text-maroon">Snapshot Archive</h4>
                                                <p className="text-[10px] text-gray-400 font-bold uppercase leading-relaxed">Extract a complete binary dump of the institutional database records.</p>
                                            </div>
                                            <button
                                                onClick={handleBackup}
                                                className="w-full flex items-center justify-center gap-3 bg-maroon text-white py-5 rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] shadow-xl hover:scale-[1.02] transition-all"
                                            >
                                                <Download className="w-4 h-4" /> Extract Registry Vault
                                            </button>
                                        </div>

                                        <div className="p-10 bg-gray-50 dark:bg-white/5 rounded-[2.5rem] space-y-6 opacity-50">
                                            <RefreshCw className="w-10 h-10 text-gray-400" />
                                            <div>
                                                <h4 className="text-sm font-black uppercase tracking-widest mb-1">Integrity Sync</h4>
                                                <p className="text-[10px] text-gray-400 font-bold uppercase leading-relaxed">Run system-wide database integrity checks and index re-optimization.</p>
                                            </div>
                                            <button className="w-full bg-gray-200 dark:bg-white/10 text-gray-400 py-5 rounded-2xl font-black text-[11px] uppercase tracking-widest cursor-not-allowed">
                                                Locked Protocol
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* System Health Tab */}
                            {activeTab === 'system' && (
                                <div className="space-y-10 animate-in fade-in duration-500">
                                    <div className="flex justify-between items-end">
                                        <h3 className="text-lg font-black uppercase text-maroon dark:text-gold tracking-tight">System Core Health</h3>
                                        <p className="text-[9px] font-black text-green-500 p-2 bg-green-500/10 rounded-lg animate-pulse">ALL SYSTEMS NOMINAL</p>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        {[
                                            { label: 'Uptime', value: '99.98%', desc: 'Current Session' },
                                            { label: 'Response', value: '142ms', desc: 'Average API Node' },
                                            { label: 'Memory', value: '24%', desc: 'Heap Usage' }
                                        ].map((stat, i) => (
                                            <div key={i} className="p-8 bg-gray-50 dark:bg-white/5 rounded-3xl border border-gray-100 dark:border-white/5">
                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">{stat.label}</p>
                                                <p className="text-3xl font-black text-maroon dark:text-gold">{stat.value}</p>
                                                <p className="text-[9px] font-bold text-gray-400 uppercase mt-1 tracking-tighter">{stat.desc}</p>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="p-10 bg-zinc-900 rounded-[2.5rem] border border-white/5 space-y-6">
                                        <div className="flex items-center gap-3">
                                            <Terminal className="w-5 h-5 text-gold" />
                                            <span className="text-[10px] font-black uppercase text-gold/60 tracking-[0.2em]">Diagnostic Console</span>
                                        </div>
                                        <div className="space-y-3 font-mono text-[10px] text-zinc-500">
                                            <p>[09:24:12] Kernel Init: Loading educational modules...</p>
                                            <p>[09:24:13] Database Node: PostgreSQL/Supabase active on remote cluster.</p>
                                            <p>[09:24:13] Auth Protocol: RSA-256 tokens initialized.</p>
                                            <p className="text-green-500">[09:25:01] System Ready: Global controls unlocked.</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                        </div>
                    </div>
                </div>
            </div>

            <footer className="text-center py-10">
                <p className="text-[9px] font-black text-gray-300 uppercase tracking-[0.8em]">System Architecture &copy; 2026 BTC Elitist Infrastructure</p>
            </footer>
        </div>
    );
}
