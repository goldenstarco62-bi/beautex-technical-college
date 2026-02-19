import React from 'react';
import { GraduationCap, QrCode, ShieldCheck, Globe } from 'lucide-react';

export default function IDCard({ data, role }) {
    if (!data) return null;

    const isStudent = role === 'student';

    return (
        <div id={`id-card-${data.id}`} className="id-card-container w-[400px] h-[250px] relative overflow-hidden font-serif select-none group">
            {/* Base Layer: Maroon Background */}
            <div className="absolute inset-0 bg-[#4A0000] shadow-2xl"></div>

            {/* Accent Layer: Gold Accents */}
            <div className="absolute -top-20 -right-20 w-64 h-64 bg-gold/10 rounded-full blur-[80px]"></div>
            <div className="absolute -bottom-20 -left-20 w-48 h-48 bg-gold/5 rounded-full blur-[60px]"></div>

            {/* Pattern Overlay */}
            <div className="absolute inset-0 opacity-[0.05] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, #FFD700 1px, transparent 0)', backgroundSize: '16px 16px' }}></div>

            {/* Header: Royal Branding */}
            <div className="relative px-8 pt-6 flex justify-between items-start">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-gold/40 to-transparent backdrop-blur-md rounded-xl border border-gold/30">
                        <GraduationCap className="w-6 h-6 text-gold" />
                    </div>
                    <div>
                        <h2 className="text-sm font-black text-gold uppercase tracking-[0.2em] leading-none mb-1">Beautex</h2>
                        <p className="text-[7px] text-gold/60 font-bold uppercase tracking-[0.4em]">Technical Training College</p>
                    </div>
                </div>
                <div className="flex flex-col items-end">
                    <div className="px-3 py-1 bg-gold/20 backdrop-blur-md border border-gold/30 rounded-full">
                        <p className="text-[8px] font-black text-gold uppercase tracking-widest">{role}</p>
                    </div>
                </div>
            </div>

            {/* Body: Profile & Details */}
            <div className="relative px-8 pt-6 flex gap-8">
                {/* Photo Section */}
                <div className="relative">
                    <div className="w-24 h-28 bg-gold/5 backdrop-blur-xl rounded-2xl border border-gold/20 overflow-hidden shadow-inner flex items-center justify-center">
                        {data.photo ? (
                            <img src={data.photo} alt={data.name} className="w-full h-full object-cover" />
                        ) : (
                            <div className="text-gold/20 font-black text-4xl">
                                {data.name?.[0].toUpperCase()}
                            </div>
                        )}
                    </div>
                    <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-maroon rounded-xl border border-gold/40 flex items-center justify-center">
                        <ShieldCheck className="w-4 h-4 text-gold" />
                    </div>
                </div>

                {/* Details Section */}
                <div className="flex-1 space-y-3 ms-[-10px]">
                    <div>
                        <p className="text-[7px] font-black text-gold/40 uppercase tracking-[0.3em] mb-1">Holder Identification</p>
                        <h3 className="text-lg font-black text-gold uppercase tracking-tight leading-tight line-clamp-1">
                            {data.name}
                        </h3>
                    </div>

                    <div className="grid grid-cols-1 gap-2">
                        <div>
                            <p className="text-[6px] font-black text-gold/40 uppercase tracking-widest mb-0.5">Academic Program</p>
                            <p className="text-[10px] font-black text-gold uppercase tracking-tight truncate border-b border-gold/20 pb-1">
                                {data.course || data.department || 'N/A'}
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <p className="text-[6px] font-black text-gold/40 uppercase tracking-widest mb-0.5">Reference ID</p>
                            <p className="text-[9px] font-bold text-gold">
                                {data.id}
                            </p>
                        </div>
                        <div>
                            <p className="text-[6px] font-black text-gold/40 uppercase tracking-widest mb-0.5">Status</p>
                            <p className="text-[9px] font-bold text-gold uppercase">Student Active</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <p className="text-[6px] font-black text-gold/40 uppercase tracking-widest mb-0.5">Enrolled</p>
                            <p className="text-[8px] font-bold text-gold/90">{data.enrolled_date || '2024-01-01'}</p>
                        </div>
                        <div>
                            <p className="text-[6px] font-black text-gold/40 uppercase tracking-widest mb-0.5">Completion</p>
                            <p className="text-[8px] font-bold text-gold/90">{data.completion_date || 'N/A'}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer: Security & Branding */}
            <div className="absolute bottom-0 inset-x-0 h-10 px-8 flex justify-between items-center border-t border-gold/10 bg-gold/5">
                <div className="flex items-center gap-2">
                    <p className="text-[8px] font-black text-gold/60 uppercase tracking-widest">Authorized Digitally</p>
                </div>
                <div className="bg-white/90 p-0.5 rounded-md backdrop-blur-md relative overflow-hidden">
                    <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=50x50&data=${data.id}`}
                        alt="ID QR"
                        className="w-6 h-6 object-contain"
                    />
                </div>
            </div>

            {/* Gold Edge Accent */}
            <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-gold/60 via-gold to-gold/60"></div>

            {/* Print Styles */}
            <style dangerouslySetInnerHTML={{
                __html: `
                @media print {
                    body * { visibility: hidden; }
                    #id-card-${data.id}, #id-card-${data.id} * { visibility: visible; }
                    #id-card-${data.id} {
                        position: fixed;
                        left: 50%;
                        top: 50%;
                        transform: translate(-50%, -50%);
                        width: 85.6mm;
                        height: 54mm;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                        box-shadow: none !important;
                        border: none !important;
                    }
                    /* Ensure background images and colors print */
                    .id-card-container {
                        background-color: #4A0000 !important;
                    }
                }
            `}} />
        </div>
    );
}
