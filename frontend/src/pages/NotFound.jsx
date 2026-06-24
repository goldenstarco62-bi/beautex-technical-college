import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Home, FileQuestion } from 'lucide-react';

export default function NotFound() {
    const navigate = useNavigate();

    return (
        <div className="min-h-[80vh] flex items-center justify-center p-6 relative overflow-hidden animate-in fade-in duration-500">
            {/* Ambient background decoration */}
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-maroon/[0.03] rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-gold/[0.03] rounded-full blur-3xl translate-x-1/2 translate-y-1/2"></div>

            <div className="text-center space-y-8 max-w-lg z-10 relative">
                {/* 404 illustration or badge */}
                <div className="relative inline-flex items-center justify-center">
                    <div className="absolute inset-0 bg-maroon/5 rounded-full scale-150 blur-xl animate-pulse"></div>
                    <div className="w-24 h-24 bg-gradient-to-tr from-maroon to-maroon/80 rounded-3xl flex items-center justify-center text-gold border border-maroon/20 shadow-xl shadow-maroon/10">
                        <FileQuestion className="w-12 h-12" />
                    </div>
                </div>

                <div className="space-y-3">
                    <h1 className="text-8xl font-black text-gray-800 tracking-tighter leading-none select-none">
                        404
                    </h1>
                    <h2 className="text-xl font-black text-gray-700 uppercase tracking-wide">
                        Page Not Found
                    </h2>
                    <p className="text-sm text-gray-400 font-medium max-w-sm mx-auto leading-relaxed">
                        The requested URL was not found on this server, or you don't have permission to access it.
                    </p>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
                    <button
                        onClick={() => navigate(-1)}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3.5 bg-gray-50 text-gray-600 border border-gray-100 rounded-xl hover:bg-gray-100 transition-all text-xs font-black uppercase tracking-wider"
                    >
                        <ArrowLeft className="w-4 h-4" /> Go Back
                    </button>
                    <Link
                        to="/"
                        className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3.5 bg-maroon text-gold rounded-xl hover:bg-elite-maroon shadow-lg shadow-maroon/10 hover:shadow-xl transition-all text-xs font-black uppercase tracking-wider"
                    >
                        <Home className="w-4 h-4" /> Go Home
                    </Link>
                </div>
            </div>
        </div>
    );
}
