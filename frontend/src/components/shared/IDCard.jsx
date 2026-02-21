import React from 'react';
import { User, ShieldCheck } from 'lucide-react';

export default function IDCard({ data, role }) {
    if (!data) return null;

    const isStudent = role === 'student';
    const expiryYear = 2026;
    const serialNo = `BTTC-ID-${data.id}-${expiryYear}`;

    return (
        <div className="id-card-print-wrap">
            {/* FRONT SIDE - LANDSCAPE */}
            <div className="id-card landscape relative bg-white overflow-hidden font-sans border border-gray-200 shadow-xl mb-8" id={`id-card-front-${data.id}`}>
                {/* Background Watermark Logo */}
                <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none">
                    <img src="/logo.jpg" alt="" className="w-64 h-64 grayscale" />
                </div>

                {/* Top Section */}
                <div className="bg-[#800000] text-white px-4 py-1.5 border-b-2 border-[#FFD700]">
                    <h1 className="text-[9pt] font-black uppercase tracking-tight leading-none text-center">Beautex Technical Training College</h1>
                    <p className="text-[6.5pt] font-bold uppercase tracking-widest text-center text-[#FFD700] mt-0.5">Official Student ID Card</p>
                </div>

                {/* Middle Section */}
                <div className="flex px-5 pt-2.5 gap-5 relative z-10">
                    {/* Left: Passport Photo (Slightly smaller to give text more room) */}
                    <div className="shrink-0">
                        <div className="w-[26mm] h-[32mm] bg-gray-50 border-2 border-[#800000] rounded-sm overflow-hidden shadow-inner relative">
                            {data.photo ? (
                                <img src={data.photo} alt={data.name} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center text-gray-300">
                                    <User className="w-10 h-10 opacity-20" />
                                    <span className="text-[5pt] uppercase font-black opacity-20 mt-1">Photo</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right: Student Details - Reduced Font Sizes and Fixed Overlap */}
                    <div className="flex-1 space-y-1.5 text-left overflow-hidden">
                        <div className="mb-0.5">
                            <p className="text-[6.5pt] font-black text-[#800000] uppercase tracking-widest leading-none mb-0.5">Full Name</p>
                            <p className="text-[10pt] font-bold text-gray-900 border-b border-gray-50 pb-0.5 truncate">{data.name}</p>
                        </div>

                        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                            <div>
                                <p className="text-[6.5pt] font-black text-gray-400 uppercase tracking-widest leading-none mb-0.5">Admission No</p>
                                <p className="text-[9pt] font-bold text-gray-800">{data.id}</p>
                            </div>
                            <div>
                                <p className="text-[6.5pt] font-black text-gray-400 uppercase tracking-widest leading-none mb-0.5">Valid Until</p>
                                <p className="text-[9pt] font-bold text-gray-800">Dec {expiryYear}</p>
                            </div>
                            <div className="col-span-2 pt-0.5">
                                <p className="text-[6.5pt] font-black text-[#800000] uppercase tracking-widest leading-none mb-0.5">Course / Programme</p>
                                <p className="text-[9.5pt] font-black text-gray-900 uppercase leading-snug">{data.course || 'Cosmetology'}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Bottom Section - Moved lower to prevent overlap with info */}
                <div className="absolute bottom-2.5 inset-x-5 flex justify-between items-end border-t border-gray-100 pt-1.5">
                    <div className="space-y-0.5">
                        <p className="text-[5.5pt] font-black text-gray-400 uppercase tracking-widest leading-none">Serial No: <span className="text-gray-600">{serialNo}</span></p>
                        <div className="flex items-center gap-3 pt-0.5">
                            <div className="text-center relative">
                                <div className="h-3 border-b border-gray-300 w-24 mb-0.5"></div>
                                <p className="text-[5pt] font-black text-gray-400 uppercase tracking-widest leading-none">Registrar Signature</p>
                                {/* Watermark Stamp */}
                                <div className="absolute -top-3 -right-5 w-8 h-8 rounded-full border border-[#800000]/10 flex items-center justify-center opacity-[0.08] rotate-12 pointer-events-none">
                                    <ShieldCheck className="w-5 h-5 text-[#800000]" />
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-[6pt] font-bold text-gray-400 uppercase tracking-[0.2em] mb-0.5">Official Document</p>
                        <p className="text-[5.5pt] font-bold text-[#800000] uppercase tracking-widest">Verified Registry</p>
                    </div>
                </div>
            </div>

            {/* BACK SIDE - LANDSCAPE */}
            <div className="id-card landscape relative bg-[#fafafa] overflow-hidden font-sans border border-gray-200 shadow-xl" id={`id-card-back-${data.id}`}>
                {/* Background Watermark Logo */}
                <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none">
                    <img src="/logo.jpg" alt="" className="w-64 h-64 grayscale rotate-12" />
                </div>

                <div className="h-1.5 bg-[#800000]"></div>

                <div className="p-5 flex flex-col h-full relative z-10">
                    <div className="grid grid-cols-2 gap-8 mb-auto">
                        {/* Emergency Contact */}
                        <div className="space-y-1.5">
                            <h3 className="text-[7pt] font-black text-[#800000] uppercase tracking-widest border-b border-[#800000]/20 pb-0.5">Emergency Contact</h3>
                            <div className="space-y-1">
                                <div>
                                    <p className="text-[6pt] font-black text-gray-400 uppercase leading-none mb-0.5">Name:</p>
                                    <p className="text-[8pt] font-bold text-gray-800 border-b border-gray-100 border-dashed truncate">{data.guardian_name || '____________________'}</p>
                                </div>
                                <div>
                                    <p className="text-[6pt] font-black text-gray-400 uppercase leading-none mb-0.5">Phone:</p>
                                    <p className="text-[8pt] font-bold text-gray-800 border-b border-gray-100 border-dashed truncate">{data.guardian_contact || '____________________'}</p>
                                </div>
                            </div>
                        </div>

                        {/* College Contact */}
                        <div className="space-y-1.5">
                            <h3 className="text-[7pt] font-black text-[#800000] uppercase tracking-widest border-b border-[#800000]/20 pb-0.5">College Contact</h3>
                            <div className="space-y-0.5 text-[7pt] font-medium text-gray-700 leading-tight">
                                <p>Utawala – Geokarma Building</p>
                                <p>Behind Astrol Petrol Station</p>
                                <p className="pt-1.5 font-black text-[#800000] text-[8pt]">Tel: 0708 247 557</p>
                            </div>
                        </div>
                    </div>

                    {/* Rules/Terms - Maroon Background - Smaller Font */}
                    <div className="mt-3 bg-[#800000] p-2.5 rounded-lg space-y-1.5 shadow-inner border border-white/10">
                        <div className="flex gap-2 items-center">
                            <p className="text-[6.5pt] font-bold text-white leading-tight uppercase tracking-wider inline-flex items-center gap-2">
                                <span className="text-[#FFD700] text-[5pt]">●</span> This card remains the property of Beautex Technical Training College.
                            </p>
                        </div>
                        <div className="flex gap-2 items-center">
                            <p className="text-[6.5pt] font-bold text-white leading-tight uppercase tracking-wider inline-flex items-center gap-2">
                                <span className="text-[#FFD700] text-[5pt]">●</span> This card Must be worn within college premises at all times.
                            </p>
                        </div>
                        <div className="flex gap-2 items-center">
                            <p className="text-[6.5pt] font-bold text-white leading-tight uppercase tracking-wider inline-flex items-center gap-2">
                                <span className="text-[#FFD700] text-[5pt]">●</span> Lost card should be reported to registry immediately.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="bg-[#800000] py-1 text-center mt-auto border-t border-[#FFD700]/10">
                    <p className="text-[6pt] font-black text-[#FFD700] uppercase tracking-[0.3em]">Excellence in Technical Training</p>
                </div>
            </div>

            <style>{`
                .id-card-print-wrap {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    padding: 20px;
                }
                .id-card.landscape {
                    width: 85.6mm;
                    height: 53.98mm;
                    border-radius: 1.5mm;
                    background-color: white !important;
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                    page-break-after: always;
                    border: 0.1mm solid #e5e7eb;
                }
                @media print {
                    body * { visibility: hidden; }
                    .id-card-print-wrap, .id-card-print-wrap * { visibility: visible; }
                    .id-card-print-wrap {
                        position: fixed;
                        top: 0; left: 0;
                        width: 100%; height: 100%;
                        display: flex; flex-direction: column;
                        align-items: center; justify-content: flex-start;
                        padding-top: 20mm;
                        background: white !important;
                    }
                    .id-card.landscape {
                        margin-bottom: 20mm !important;
                        box-shadow: none !important;
                        border: 0.1mm solid #f0f0f0 !important;
                    }
                }
            `}</style>
        </div>
    );
}
