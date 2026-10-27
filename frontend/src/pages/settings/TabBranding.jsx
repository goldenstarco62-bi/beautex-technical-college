import React from 'react';
import { FieldRow, GOLD, Inp } from './atoms';
import { Building, FileText, Edit3 } from 'lucide-react';

export default function TabBranding(ctx) {
    const { settings, set, uploadingLogo, setUploadingLogo, uploadingStamp, setUploadingStamp, uploadingSignature, setUploadingSignature, logoRef, stampRef, sigRef, handleFileUpload } = ctx;
    const emailInvalid = !!settings.contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(settings.contact_email.trim());
    const phoneInvalid = [settings.college_phone, settings.college_phone2].some(p => !!p && !/^\+?[\d][\d\s\-().,]{5,}$/.test(p.trim()));
    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-2">
                {[
                    { key:'college_logo', label:'College Crest Logo', desc: 'Used on portal top navigation and official certificates.', icon:Building, ref:logoRef, up:uploadingLogo, setU:setUploadingLogo },
                    { key:'college_stamp', label:'Official Seal Stamp', desc: 'Stamped on printed transcripts and graduation awards.', icon:FileText, ref:stampRef, up:uploadingStamp, setU:setUploadingStamp },
                    { key:'college_signature', label:'Principal Signature', desc: 'Appears as the authorized signatory on diplomas.', icon:Edit3, ref:sigRef, up:uploadingSignature, setU:setUploadingSignature },
                ].map(item => {
                    const Icon = item.icon;
                    return (
                        <div key={item.key} className="p-6 bg-gray-50/50 dark:bg-white/[0.02] rounded-3xl border border-gray-200 dark:border-white/5 text-center flex flex-col items-center gap-4 hover:border-gold/30 transition-all duration-200 group">
                            <div className="w-24 h-24 bg-white dark:bg-zinc-800 rounded-2xl border border-gray-200 dark:border-white/10 flex items-center justify-center overflow-hidden shadow-inner group-hover:scale-105 transition-transform duration-300 relative">
                                {settings[item.key] ? (
                                    <img src={settings[item.key]} alt={item.label} className="w-full h-full object-contain p-2" />
                                ) : (
                                    <div className="flex flex-col items-center justify-center text-zinc-300 dark:text-zinc-600">
                                        <Icon className="w-8 h-8 mb-1" />
                                        <span className="text-[7.5px] font-black uppercase tracking-widest">No File</span>
                                    </div>
                                )}
                            </div>
                            <div className="space-y-1">
                                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-700 dark:text-zinc-300">{item.label}</p>
                                <p className="text-[8px] text-zinc-400 font-semibold leading-relaxed max-w-[180px] mx-auto">{item.desc}</p>
                            </div>
                            <button onClick={() => item.ref.current?.click()} disabled={item.up}
                                className="text-[9px] font-black uppercase tracking-widest text-white px-5 py-2.5 rounded-xl transition-all duration-200 hover:opacity-90 disabled:opacity-50 shadow-sm"
                                style={{ backgroundColor: settings.sidebar_colors || '#7a0000', border: `1px solid ${GOLD}40` }}>
                                {item.up ? 'Uploading...' : 'Choose File'}
                            </button>
                            <input ref={item.ref} type="file" accept="image/*" className="hidden" onChange={e => handleFileUpload(e.target.files[0], item.key, item.setU)} />
                        </div>
                    );
                })}
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-white/5 rounded-3xl p-6 space-y-4 shadow-sm">
                <p className="text-[10px] font-black text-maroon dark:text-gold uppercase tracking-widest border-b border-gray-100 dark:border-white/5 pb-2 mb-2">College Information Details</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FieldRow label="College Name"><Inp value={settings.college_name} onChange={e=>set('college_name',e.target.value)} /></FieldRow>
                    <FieldRow label="Abbreviation"><Inp value={settings.college_abbr} onChange={e=>set('college_abbr',e.target.value)} /></FieldRow>
                    <FieldRow label="Motto Statement"><Inp value={settings.college_motto} onChange={e=>set('college_motto',e.target.value)} /></FieldRow>
                    <FieldRow label="Principal Name"><Inp value={settings.college_principal} onChange={e=>set('college_principal',e.target.value)} /></FieldRow>
                    <FieldRow label="TVETA Reg Number"><Inp value={settings.college_reg_number} onChange={e=>set('college_reg_number',e.target.value)} /></FieldRow>
                    <FieldRow label="KRA PIN Code"><Inp value={settings.college_kra_pin} onChange={e=>set('college_kra_pin',e.target.value)} /></FieldRow>
                </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-white/5 rounded-3xl p-6 space-y-4 shadow-sm">
                <p className="text-[10px] font-black text-maroon dark:text-gold uppercase tracking-widest border-b border-gray-100 dark:border-white/5 pb-2 mb-2">Contact & Locations</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FieldRow label="Physical Address"><Inp value={settings.college_address} onChange={e=>set('college_address',e.target.value)} placeholder="e.g. Utawala, Geokarma Building" /></FieldRow>
                    <FieldRow label="Contact Email"><Inp value={settings.contact_email} onChange={e=>set('contact_email',e.target.value)} placeholder="e.g. info@beautex.ac.ke" /></FieldRow>
                    <FieldRow label="Website Domain"><Inp value={settings.college_website} onChange={e=>set('college_website',e.target.value)} placeholder="e.g. https://beautex.ac.ke" /></FieldRow>
                    <FieldRow label="Primary Telephone"><Inp value={settings.college_phone} onChange={e=>set('college_phone',e.target.value)} placeholder="e.g. 0708 247 557" /></FieldRow>
                    <FieldRow label="Secondary Telephone"><Inp value={settings.college_phone2} onChange={e=>set('college_phone2',e.target.value)} placeholder="e.g. 0733 000 000" /></FieldRow>
                </div>
                {(emailInvalid || phoneInvalid) && (
                    <div role="alert" className="p-3.5 rounded-xl border border-red-200 dark:border-red-950/40 bg-red-50/70 dark:bg-red-950/10 space-y-1 text-left">
                        {emailInvalid && <p className="text-[9.5px] text-red-700 dark:text-red-300 font-semibold">Contact email does not look like a valid address (expected name@domain.xx).</p>}
                        {phoneInvalid && <p className="text-[9.5px] text-red-700 dark:text-red-300 font-semibold">Telephone numbers should contain digits only (spaces, +, - allowed).</p>}
                    </div>
                )}
            </div>
        </div>
    );
}
