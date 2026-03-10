import React, { useState, useEffect } from 'react';
import { Smartphone, Download, X } from 'lucide-react';

const PWAInstallPrompt = () => {
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const handler = (e) => {
            // Prevent Chrome 67 and earlier from automatically showing the prompt
            e.preventDefault();
            // Stash the event so it can be triggered later.
            setDeferredPrompt(e);
            // Show the install button if the user hasn't dismissed it this session
            try {
                if (!sessionStorage.getItem('pwa_prompt_dismissed')) {
                    setIsVisible(true);
                }
            } catch (storageErr) {
                console.warn('⚠️ [PWA] Session storage access denied:', storageErr.message);
                setIsVisible(true); // Show it anyway if we can't remember dismissal
            }
        };

        window.addEventListener('beforeinstallprompt', handler);

        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const handleInstallClick = async () => {
        if (!deferredPrompt) return;

        // Show the install prompt
        deferredPrompt.prompt();

        // Wait for the user to respond to the prompt
        // We've used the prompt, and can't use it again, throw it away
        setDeferredPrompt(null);
        setIsVisible(false);
    };

    const handleDismiss = () => {
        setIsVisible(false);
        try {
            sessionStorage.setItem('pwa_prompt_dismissed', 'true');
        } catch (e) { }
    };

    if (!isVisible) return null;

    return (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 w-[90%] max-w-md z-[9999] animate-in slide-in-from-top-full duration-500">
            <div className="bg-maroon text-gold p-4 rounded-2xl shadow-2xl border border-gold/20 backdrop-blur-xl flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gold/10 rounded-xl flex items-center justify-center border border-gold/20">
                        <Smartphone className="w-6 h-6 text-gold" />
                    </div>
                    <div>
                        <p className="text-xs font-black uppercase tracking-widest text-gold/60">Beautex Portal</p>
                        <p className="text-sm font-bold text-white">Install on your phone?</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={handleInstallClick}
                        className="bg-gold text-maroon px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-transform active:scale-95 flex items-center gap-2"
                    >
                        <Download className="w-3.5 h-3.5" />
                        Install
                    </button>
                    <button
                        onClick={handleDismiss}
                        className="p-2 text-gold/40 hover:text-gold transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PWAInstallPrompt;
