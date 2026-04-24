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
            <div className="min-h-screen flex items-center justify-center bg-parchment">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-maroon/10 border-t-maroon rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-maroon font-black uppercase tracking-widest text-[10px]">Verifying Protocol...</p>
                </div>
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/login" />;
    }

    return (
        <div className="min-h-screen bg-[#FDFBFA] dark:bg-black text-[#212121] dark:text-white transition-colors duration-500">
            <SearchHub isOpen={searchOpen} onClose={() => setSearchOpen(false)} />

            <div className="print:hidden">
                <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />
            </div>
            <div className="lg:ml-72 relative min-h-screen flex flex-col print:ml-0 transition-all duration-300">
                <div className="print:hidden">
                    <Navbar onMenuClick={() => setSidebarOpen(!sidebarOpen)} onSearchClick={() => setSearchOpen(true)} />
                </div>
                <main className="flex-1 p-4 lg:p-10 pt-20 lg:pt-28 pb-24 lg:pb-10 print:p-0 print:pt-4 overflow-x-hidden">
                    {children}
                </main>
                <div className="print:hidden">
                    <MobileBottomNav onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
                </div>
            </div>
        </div>
    );
}

