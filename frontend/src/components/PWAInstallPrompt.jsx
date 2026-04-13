import React, { useState, useEffect } from 'react';
import { Smartphone, Download, X, Share } from 'lucide-react';

// Detect iOS Safari — it never fires beforeinstallprompt
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const isInStandaloneMode = () =>
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;

const PWAInstallPrompt = () => {
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [showAndroidBanner, setShowAndroidBanner] = useState(false);
    const [showIOSBanner, setShowIOSBanner] = useState(false);

    useEffect(() => {
        // If already installed as a PWA, never show anything
        if (isInStandaloneMode()) return;

        // ── iOS Safari: show manual instructions ──────────────────────────────
        if (isIOS()) {
            try {
                if (!sessionStorage.getItem('pwa_prompt_dismissed')) {
                    setShowIOSBanner(true);
                }
            } catch {
                setShowIOSBanner(true);
            }
            return; // iOS won't fire beforeinstallprompt, stop here
        }

        // ── Android / Chrome: use the deferred prompt ─────────────────────────
        const showIfAvailable = (prompt) => {
            if (!prompt) return;
            setDeferredPrompt(prompt);
            try {
                if (!sessionStorage.getItem('pwa_prompt_dismissed')) {
                    setShowAndroidBanner(true);
                }
            } catch {
                setShowAndroidBanner(true);
            }
        };

        // The event may have already fired before this component mounted.
        // index.html captures it early and stores it on window.__pwaInstallEvent.
        if (window.__pwaInstallEvent) {
            showIfAvailable(window.__pwaInstallEvent);
        }

        // Also listen for the custom event dispatched by index.html
        // in case the component mounts around the same time as the event.
        const onReady = () => showIfAvailable(window.__pwaInstallEvent);
        window.addEventListener('pwa-install-ready', onReady);

        return () => window.removeEventListener('pwa-install-ready', onReady);
    }, []);

    const handleInstall = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        await deferredPrompt.userChoice;
        window.__pwaInstallEvent = null;
        setDeferredPrompt(null);
        setShowAndroidBanner(false);
    };

    const handleDismiss = () => {
        setShowAndroidBanner(false);
        setShowIOSBanner(false);
        try { sessionStorage.setItem('pwa_prompt_dismissed', 'true'); } catch { /* noop */ }
    };

    // ── Android banner ─────────────────────────────────────────────────────────
    if (showAndroidBanner) {
        return (
            <div className="fixed top-4 left-1/2 -translate-x-1/2 w-[92%] max-w-md z-[9999]"
                style={{ animation: 'slideDown 0.4s cubic-bezier(0.16,1,0.3,1) both' }}>
                <style>{`
                    @keyframes slideDown {
                        from { opacity: 0; transform: translateX(-50%) translateY(-20px); }
                        to   { opacity: 1; transform: translateX(-50%) translateY(0);    }
                    }
                `}</style>
                <div className="bg-maroon text-white rounded-2xl shadow-2xl border border-yellow-500/30 p-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="shrink-0 w-10 h-10 bg-yellow-500/10 rounded-xl flex items-center justify-center border border-yellow-500/20">
                            <Smartphone className="w-5 h-5 text-yellow-400" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[10px] font-black uppercase tracking-widest text-yellow-400/70 truncate">Beautex Portal</p>
                            <p className="text-sm font-bold leading-tight">Install app on your phone</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            id="pwa-install-btn"
                            onClick={handleInstall}
                            className="bg-yellow-400 text-maroon px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 active:scale-95 transition-transform"
                        >
                            <Download className="w-3.5 h-3.5" />
                            Install
                        </button>
                        <button
                            id="pwa-dismiss-btn"
                            onClick={handleDismiss}
                            className="p-1.5 text-yellow-400/50 hover:text-yellow-400 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ── iOS banner: manual "Add to Home Screen" instructions ──────────────────
    if (showIOSBanner) {
        return (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[92%] max-w-md z-[9999]"
                style={{ animation: 'slideUp 0.4s cubic-bezier(0.16,1,0.3,1) both' }}>
                <style>{`
                    @keyframes slideUp {
                        from { opacity: 0; transform: translateX(-50%) translateY(20px); }
                        to   { opacity: 1; transform: translateX(-50%) translateY(0);   }
                    }
                `}</style>
                <div className="bg-maroon text-white rounded-2xl shadow-2xl border border-yellow-500/30 p-4">
                    <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-3">
                            <div className="shrink-0 w-10 h-10 bg-yellow-500/10 rounded-xl flex items-center justify-center border border-yellow-500/20">
                                <Share className="w-5 h-5 text-yellow-400" />
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-yellow-400/70">Beautex Portal</p>
                                <p className="text-sm font-bold leading-tight">Add to Home Screen</p>
                            </div>
                        </div>
                        <button id="pwa-ios-dismiss-btn" onClick={handleDismiss} className="p-1 text-yellow-400/50 hover:text-yellow-400 transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    <ol className="text-xs text-white/70 space-y-1.5 pl-1">
                        <li className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-yellow-400/10 border border-yellow-400/30 flex items-center justify-center text-yellow-400 font-black text-[10px] shrink-0">1</span>
                            Tap the <strong className="text-white">Share</strong> button in Safari's toolbar
                        </li>
                        <li className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-yellow-400/10 border border-yellow-400/30 flex items-center justify-center text-yellow-400 font-black text-[10px] shrink-0">2</span>
                            Scroll down and tap <strong className="text-white">Add to Home Screen</strong>
                        </li>
                        <li className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-yellow-400/10 border border-yellow-400/30 flex items-center justify-center text-yellow-400 font-black text-[10px] shrink-0">3</span>
                            Tap <strong className="text-white">Add</strong> to install the app
                        </li>
                    </ol>
                    {/* Caret arrow pointing down toward the toolbar */}
                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-maroon border-r border-b border-yellow-500/30 rotate-45" />
                </div>
            </div>
        );
    }

    return null;
};

export default PWAInstallPrompt;
