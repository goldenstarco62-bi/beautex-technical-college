import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Save, Globe, Shield, Bell, Database, Download, Lock } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function Settings() {
    const { user } = useAuth();
    const [settings, setSettings] = useState({
        college_name: 'Beautex Technical College',
        college_abbr: 'BTC',
        academic_year: '2025/2026',
        semester: 'Semester 1',
        contact_email: '',
        maintenance_mode: false,
        student_portal_enabled: true,
        teacher_portal_enabled: true,
        parent_portal_enabled: true,
        allow_registration: true,
        grading_system: 'standard'
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState('general');

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
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
            // Show success animation or toast
            alert('System settings updated successfully.');
        } catch (error) {
            console.error('Failed to update settings:', error);
            alert('Failed to update settings.');
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
            link.setAttribute('download', `college_cms_backup_${new Date().toISOString().split('T')[0]}.sqlite`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            console.error('Backup failed:', error);
            alert('Backup download failed.');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin w-8 h-8 border-4 border-maroon border-t-transparent rounded-full"></div>
            </div>
        );
    }

    const tabs = [
        { id: 'general', label: 'General', icon: Globe },
        { id: 'academic', label: 'Academic', icon: SettingsIcon },
        { id: 'portals', label: 'Portals', icon: Lock },
        { id: 'data', label: 'Data & Backup', icon: Database },
    ];

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div>
                <h1 className="text-3xl font-black text-primary tracking-tight uppercase">System Configuration</h1>
                <p className="text-xs text-primary/40 font-bold tracking-widest mt-1">Global Control Panel</p>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 bg-white p-1.5 rounded-2xl w-fit shadow-sm border border-gray-100">
                {tabs.map(tab => {
                    const Icon = tab.icon;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${activeTab === tab.id
                                ? 'bg-primary text-white shadow-lg'
                                : 'text-gray-400 hover:text-primary hover:bg-gray-50'
                                }`}
                        >
                            <Icon className="w-4 h-4" />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Content Area */}
                <div className="lg:col-span-2 space-y-6">

                    {/* General Settings */}
                    {activeTab === 'general' && (
                        <div className="card-light p-8 space-y-6">
                            <h2 className="text-sm font-black text-primary uppercase tracking-widest flex items-center gap-2">
                                <Globe className="w-4 h-4 text-accent" /> Institution Details
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-primary/40 uppercase tracking-widest ml-1">College Name</label>
                                    <input
                                        type="text"
                                        value={settings.college_name}
                                        onChange={(e) => setSettings({ ...settings, college_name: e.target.value })}
                                        className="w-full px-5 py-4 bg-parchment border-none rounded-2xl text-primary font-bold outline-none focus:ring-2 focus:ring-primary/10"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-primary/40 uppercase tracking-widest ml-1">Abbreviation</label>
                                    <input
                                        type="text"
                                        value={settings.college_abbr}
                                        onChange={(e) => setSettings({ ...settings, college_abbr: e.target.value })}
                                        className="w-full px-5 py-4 bg-parchment border-none rounded-2xl text-primary font-bold outline-none focus:ring-2 focus:ring-primary/10"
                                    />
                                </div>
                                <div className="space-y-1 md:col-span-2">
                                    <label className="text-[10px] font-black text-primary/40 uppercase tracking-widest ml-1">Contact Email</label>
                                    <input
                                        type="email"
                                        value={settings.contact_email}
                                        onChange={(e) => setSettings({ ...settings, contact_email: e.target.value })}
                                        className="w-full px-5 py-4 bg-parchment border-none rounded-2xl text-primary font-bold outline-none focus:ring-2 focus:ring-primary/10"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Academic Settings */}
                    {activeTab === 'academic' && (
                        <div className="card-light p-8 space-y-6">
                            <h2 className="text-sm font-black text-primary uppercase tracking-widest flex items-center gap-2">
                                <SettingsIcon className="w-4 h-4 text-accent" /> Academic Framework
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-primary/40 uppercase tracking-widest ml-1">Active Year</label>
                                    <input
                                        type="text"
                                        value={settings.academic_year}
                                        onChange={(e) => setSettings({ ...settings, academic_year: e.target.value })}
                                        className="w-full px-5 py-4 bg-parchment border-none rounded-2xl text-primary font-bold outline-none focus:ring-2 focus:ring-primary/10"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-primary/40 uppercase tracking-widest ml-1">Current Semester</label>
                                    <select
                                        value={settings.semester}
                                        onChange={(e) => setSettings({ ...settings, semester: e.target.value })}
                                        className="w-full px-5 py-4 bg-parchment border-none rounded-2xl text-primary font-bold outline-none focus:ring-2 focus:ring-primary/10"
                                    >
                                        <option>Semester 1</option>
                                        <option>Semester 2</option>
                                        <option>Summer Session</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Portal Controls */}
                    {activeTab === 'portals' && (
                        <div className="card-light p-8 space-y-6">
                            <h2 className="text-sm font-black text-primary uppercase tracking-widest flex items-center gap-2">
                                <Lock className="w-4 h-4 text-accent" /> Portal Access Control
                            </h2>
                            <div className="space-y-4">
                                {[
                                    { key: 'student_portal_enabled', label: 'Student Portal Access', desc: 'Allow students to login and view grades/attendance' },
                                    { key: 'teacher_portal_enabled', label: 'Faculty Portal Access', desc: 'Allow teachers to manage classes and enter marks' },
                                    { key: 'parent_portal_enabled', label: 'Parent Portal Access', desc: 'Allow parents to view student progress' },
                                    { key: 'allow_registration', label: 'New Student Registration', desc: 'Allow open registration for new students' },
                                ].map((item) => (
                                    <div key={item.key} className="flex items-center justify-between p-4 bg-parchment rounded-2xl">
                                        <div>
                                            <p className="text-[10px] font-black text-primary uppercase tracking-widest">{item.label}</p>
                                            <p className="text-[9px] text-primary/40 font-bold uppercase mt-0.5">{item.desc}</p>
                                        </div>
                                        <div className="relative inline-block w-12 mr-2 align-middle select-none transition duration-200 ease-in">
                                            <input
                                                type="checkbox"
                                                checked={settings[item.key]}
                                                onChange={() => setSettings({ ...settings, [item.key]: !settings[item.key] })}
                                                className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer transition-all duration-300 transform translate-x-0 checked:translate-x-6 checked:border-accent"
                                            />
                                            <div className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer transition-colors duration-300 ${settings[item.key] ? 'bg-accent' : 'bg-gray-300'}`}></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Data Management */}
                    {activeTab === 'data' && (
                        <div className="card-light p-8 space-y-6">
                            <h2 className="text-sm font-black text-primary uppercase tracking-widest flex items-center gap-2">
                                <Database className="w-4 h-4 text-accent" /> Database Management
                            </h2>
                            <div className="p-6 bg-parchment rounded-2xl border border-primary/5">
                                <h3 className="text-sm font-bold text-primary mb-2">System Backup</h3>
                                <p className="text-xs text-gray-500 mb-6">Download a complete snapshot of the database (SQLite). This file contains all student records, grades, and system settings. Store it securely.</p>
                                <button
                                    onClick={handleBackup}
                                    className="flex items-center gap-3 bg-primary text-white px-6 py-4 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-primary-dark transition-all shadow-lg hover:shadow-xl"
                                >
                                    <Download className="w-4 h-4 text-accent" />
                                    Download Database Backup
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Right Column: Quick Actions */}
                <div className="space-y-6">
                    <div className="card-light p-8">
                        <div className="flex items-center gap-3 mb-8">
                            <Shield className="w-5 h-5 text-accent" />
                            <h2 className="text-sm font-black text-primary uppercase tracking-widest">Emergency</h2>
                        </div>
                        <div className="space-y-4">
                            <div className="p-4 bg-red-50 rounded-2xl border border-red-100">
                                <div className="flex items-center justify-between mb-2">
                                    <p className="text-[10px] font-black text-red-600 uppercase tracking-widest">Maintenance Mode</p>
                                    <div className="relative inline-block w-10 align-middle select-none">
                                        <input
                                            type="checkbox"
                                            checked={settings.maintenance_mode}
                                            onChange={() => setSettings({ ...settings, maintenance_mode: !settings.maintenance_mode })}
                                            className="absolute block w-5 h-5 rounded-full bg-white border-4 appearance-none cursor-pointer transition-transform duration-300 transform translate-x-0 checked:translate-x-5"
                                        />
                                        <div className={`block overflow-hidden h-5 rounded-full cursor-pointer transition-colors ${settings.maintenance_mode ? 'bg-red-500' : 'bg-gray-300'}`}></div>
                                    </div>
                                </div>
                                <p className="text-[9px] text-red-400 font-bold leading-relaxed">
                                    When enabled, only Super Admin can login. All other portals will be locked immediately.
                                </p>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="w-full bg-primary text-accent py-5 rounded-[1.5rem] font-black text-xs uppercase tracking-[0.2em] hover:bg-primary-dark shadow-xl transition-all border border-accent/20 flex items-center justify-center gap-3 disabled:opacity-70 disabled:cursor-not-allowed group"
                    >
                        {saving ? (
                            <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                            <Save className="w-4 h-4 group-hover:scale-110 transition-transform" />
                        )}
                        {saving ? 'Syncing...' : 'Save Configuration'}
                    </button>
                </div>
            </div>
        </div>
    );
}

