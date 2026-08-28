import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import MobileBottomNav from './MobileBottomNav';
import SearchHub from './SearchHub';

export default function Layout({ children }) {
    const { user, loading } = useAuth();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [searchOpen, setSearchOpen] = useState(false);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                setSearchOpen(true);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#f5f5f5]">
                <div className="text-center">
                    <div className="w-14 h-14 border-4 border-[#800000]/10 border-t-[#800000] rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-[#800000] font-black uppercase tracking-widest text-[10px]">Loading...</p>
                </div>
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/login" />;
    }

    return (
        <div className="min-h-screen text-[#212121] dark:text-white transition-colors duration-500 relative"
            style={{
                background: 'linear-gradient(145deg, #f8f5f5 0%, #f5f6fa 40%, #f5f0f0 100%)',
            }}>
            {/* Ambient background orbs */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 dark:hidden">
                <div className="absolute top-0 right-1/4 w-[600px] h-[600px] rounded-full opacity-[0.04]"
                    style={{ background: 'radial-gradient(circle, #800000 0%, transparent 70%)' }} />
                <div className="absolute bottom-1/4 left-1/3 w-[400px] h-[400px] rounded-full opacity-[0.03]"
                    style={{ background: 'radial-gradient(circle, #FFD700 0%, transparent 70%)' }} />
                {/* Subtle dot grid */}
                <div className="absolute inset-0 opacity-[0.4]"
                    style={{
                        backgroundImage: 'radial-gradient(circle, rgba(128,0,0,0.06) 1px, transparent 1px)',
                        backgroundSize: '28px 28px'
                    }} />
            </div>

            {/* Dark mode background */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 hidden dark:block"
                style={{ background: 'linear-gradient(145deg, #0a0a0a 0%, #0d0d0d 50%, #0f0a0a 100%)' }}>
                <div className="absolute top-0 right-1/4 w-[600px] h-[600px] rounded-full opacity-[0.06]"
                    style={{ background: 'radial-gradient(circle, #800000 0%, transparent 70%)' }} />
                <div className="absolute bottom-1/4 left-1/3 w-[400px] h-[400px] rounded-full opacity-[0.04]"
                    style={{ background: 'radial-gradient(circle, #FFD700 0%, transparent 70%)' }} />
            </div>

            <SearchHub isOpen={searchOpen} onClose={() => setSearchOpen(false)} />

            {/* Sidebar */}
            <div className="print:hidden">
                <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />
            </div>

            {/* Main content area - offset by sidebar width */}
            <div className="lg:ml-64 relative min-h-screen flex flex-col print:ml-0 transition-all duration-300 z-10">
                {/* Navbar */}
                <div className="print:hidden">
                    <Navbar
                        onMenuClick={() => setSidebarOpen(!sidebarOpen)}
                        onSearchClick={() => setSearchOpen(true)}
                    />
                </div>

                {/* Page Content */}
                <main className="flex-1 p-4 lg:p-6 pb-24 lg:pb-6 print:p-0 print:pt-4 overflow-x-hidden">
                    {children}
                </main>

                {/* Mobile Bottom Nav */}
                <div className="print:hidden">
                    <MobileBottomNav onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
                </div>
            </div>
        </div>
    );
}
