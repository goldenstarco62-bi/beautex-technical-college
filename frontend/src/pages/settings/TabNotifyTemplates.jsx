import React from 'react';

export default function TabNotifyTemplates(ctx) {
    const { settings, set, activeSmsPreview, setActiveSmsPreview } = ctx;
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in duration-300">
            <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-100 dark:border-white/5 p-6 space-y-4 shadow-sm text-left">
                <div>
                    <h4 className="text-xs font-black uppercase tracking-widest text-maroon dark:text-gold border-b border-gray-100 dark:border-white/5 pb-2">Custom Notification Templates</h4>
                    <p className="text-[9px] text-zinc-400 font-semibold mt-1">Configure automated text message content. Tokens map DB parameters dynamically.</p>
                </div>

                {[
                    { key: 'template_admission_sms', label: 'Student Admission Confirmation SMS', tokens: ['{name}', '{admission_no}', '{start_date}'] },
                    { key: 'template_fee_reminder_sms', label: 'Overdue Tuition Balance Alert SMS', tokens: ['{name}', '{balance}', '{due_date}'] },
                    { key: 'template_results_sms', label: 'Academic Term Grade Publishing SMS', tokens: ['{name}', '{gpa}'] },
                    { key: 'template_absentee_sms', label: 'Student Absence Notification SMS', tokens: ['{name}', '{date}'] }
                ].map(item => {
                    const isActive = activeSmsPreview === item.key;
                    return (
                        <div key={item.key} onClick={() => setActiveSmsPreview(item.key)}
                            className={`p-4 rounded-2xl border transition-all cursor-pointer ${isActive ? 'border-maroon dark:border-gold bg-maroon/[0.01] dark:bg-gold/[0.01]' : 'border-gray-100 dark:border-white/5 hover:border-gray-200'}`}>
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-[10px] font-black uppercase tracking-wider text-zinc-700 dark:text-zinc-200">{item.label}</span>
                                {isActive && <span className="text-[7.5px] bg-gold text-maroon font-black uppercase px-2 py-0.5 rounded-full tracking-widest">Editing</span>}
                            </div>
                            <textarea value={settings[item.key] || ''} onChange={e=>set(item.key,e.target.value)} rows={3}
                                className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:ring-1 focus:ring-maroon resize-none font-sans" />
                            <div className="flex flex-wrap gap-1.5 mt-2">
                                <span className="text-[8px] font-black text-zinc-400 uppercase tracking-widest self-center">Available variables:</span>
                                {item.tokens.map(tok => (
                                    <span key={tok} className="text-[8px] font-mono font-bold bg-gray-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 px-1.5 py-0.5 rounded border border-gray-200 dark:border-white/5">{tok}</span>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-100 dark:border-white/5 p-6 shadow-sm flex flex-col justify-between">
                <div>
                    <h4 className="text-xs font-black uppercase tracking-widest text-maroon dark:text-gold border-b border-gray-100 dark:border-white/5 pb-2">SMS Dispatch Visual Mockup</h4>
                    <p className="text-[9px] text-zinc-400 font-semibold mt-1">Live smartphone rendering showing how the recipient receives the message.</p>
                </div>

                <div className="flex-1 mt-6 flex justify-center items-center">
                    {/* iPhone smartphone Mockup */}
                    <div className="w-[240px] h-[440px] bg-zinc-950 rounded-[40px] border-4 border-zinc-800 shadow-2xl overflow-hidden flex flex-col p-2 relative ring-4 ring-zinc-900">
                        {/* Notch */}
                        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-24 h-4 bg-zinc-950 rounded-full z-20 flex items-center justify-center"><div className="w-1.5 h-1.5 rounded-full bg-zinc-900 mr-2" /><div className="w-12 h-1 bg-zinc-900 rounded-full" /></div>
                        
                        {/* Screen Content */}
                        <div className="flex-1 bg-zinc-100 dark:bg-zinc-900 rounded-[32px] overflow-hidden flex flex-col pt-5 relative">
                            {/* Carrier Top bar */}
                            <div className="h-6 flex items-center justify-between px-4 text-[7px] text-zinc-400 font-black uppercase tracking-widest">
                                <span>11:34 AM</span>
                                <div className="flex items-center gap-1"><span>4G</span><div className="w-4 h-2 border border-zinc-400 rounded-sm p-0.5"><div className="h-full bg-zinc-400 rounded-sm w-3/4" /></div></div>
                            </div>
                            
                            {/* Contact Header */}
                            <div className="h-10 border-b border-zinc-200/50 bg-white/70 dark:bg-zinc-950/70 backdrop-blur-md flex flex-col items-center justify-center">
                                <span className="text-[9px] font-black text-zinc-700 dark:text-zinc-200 tracking-wider">BEAUTEX SMS</span>
                                <span className="text-[6.5px] text-green-500 font-black tracking-widest uppercase">Verified Sender</span>
                            </div>
                            
                            {/* Chat Messages Area */}
                            <div className="flex-1 p-3 overflow-y-auto flex flex-col justify-end text-left space-y-2 bg-[#e5ddd5] dark:bg-zinc-950">
                                <div className="p-3 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 rounded-2xl rounded-bl-none text-[9.5px] font-semibold leading-relaxed shadow-sm max-w-[85%] border border-zinc-200/40 animate-in slide-in-from-bottom duration-300">
                                    {(() => {
                                        const template = settings[activeSmsPreview] || '';
                                        return template
                                            .replace(/{name}/g, 'Alex Kamau')
                                            .replace(/{admission_no}/g, 'BTC/2026/042')
                                            .replace(/{start_date}/g, 'July 6, 2026')
                                            .replace(/{balance}/g, '12,500')
                                            .replace(/{due_date}/g, 'July 15, 2026')
                                            .replace(/{gpa}/g, '3.82')
                                            .replace(/{date}/g, new Date().toLocaleDateString());
                                    })()}
                                    <span className="text-[6.5px] text-zinc-400 font-bold block text-right mt-1.5 uppercase">11:34 AM</span>
                                </div>
                            </div>
                            
                            {/* Input Bar */}
                            <div className="h-8 bg-white border-t border-zinc-200 flex items-center px-3 gap-2">
                                <div className="flex-1 h-5 bg-zinc-100 rounded-full border border-zinc-200" />
                                <div className="w-5 h-5 rounded-full bg-green-500" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
