import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';

export default function AppMinimal() {
    return (
        <ThemeProvider>
            <AuthProvider>
                <div className="p-10 text-center">
                    <h1 className="text-2xl font-bold text-green-600 mb-4">✓ Context Providers Loaded</h1>
                    <p className="mb-4">If you see this, AuthContext and ThemeProvider are working.</p>
                    <button
                        onClick={() => {
                            localStorage.clear();
                            window.location.reload();
                        }}
                        className="bg-red-500 text-white px-4 py-2 rounded"
                    >
                        Reset Application Data
                    </button>
                </div>
            </AuthProvider>
        </ThemeProvider>
    );
}
