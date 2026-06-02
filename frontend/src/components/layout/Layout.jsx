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
        <div className="min-h-screen bg-[#f5f6fa] dark:bg-[#0d0d0d] text-[#212121] dark:text-white transition-colors duration-500">
            <SearchHub isOpen={searchOpen} onClose={() => setSearchOpen(false)} />

            {/* Sidebar */}
            <div className="print:hidden">
                <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />
            </div>

            {/* Main content area - offset by sidebar width */}
            <div className="lg:ml-64 relative min-h-screen flex flex-col print:ml-0 transition-all duration-300">
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
