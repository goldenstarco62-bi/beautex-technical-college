import React from 'react';

export default function SplashLoader() {
    return (
        <div className="fixed inset-0 bg-white z-[9999] flex flex-col items-center justify-center animate-in fade-in duration-300">
            <div className="relative flex flex-col items-center max-w-xs text-center space-y-6">
                {/* Glowing decorative rings */}
                <div className="relative w-20 h-20 flex items-center justify-center">
                    <div className="absolute inset-0 border-4 border-maroon/5 rounded-full"></div>
                    <div className="absolute inset-0 border-4 border-t-maroon border-r-gold border-b-transparent border-l-transparent rounded-full animate-spin"></div>
                    
                    {/* Pulsing center badge */}
                    <div className="w-12 h-12 bg-maroon rounded-2xl flex items-center justify-center text-gold font-black text-xs shadow-lg shadow-maroon/20 animate-pulse">
                        BTTC
                    </div>
                </div>

                <div className="space-y-1.5">
                    <h3 className="text-xs font-black text-gray-800 uppercase tracking-[0.25em]">
                        Beautex Technical College
                    </h3>
                    <p className="text-[9px] text-gray-400 font-black uppercase tracking-[0.15em] animate-pulse">
                        Initializing Portal
                    </p>
                </div>
            </div>
        </div>
    );
}
