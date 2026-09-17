import React from 'react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("Uncaught error caught by ErrorBoundary:", error, errorInfo);
        this.setState({ error, errorInfo });
    }

    handleReload = () => {
        window.location.reload();
    };

    handleResetAndReload = () => {
        try {
            localStorage.clear();
            sessionStorage.clear();
        } catch (e) {
            console.error("Error clearing storage:", e);
        }
        window.location.href = '/login';
    };

    render() {
        if (this.state.hasError) {
            const errorMsg = this.state.error?.message || '';
            const isChunkError = this.state.error?.name === 'ChunkLoadError' || 
                errorMsg.includes('Failed to fetch dynamically imported module') ||
                errorMsg.includes('Importing a module script failed') ||
                errorMsg.includes('Loading chunk');

            return (
                <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6 sm:p-8">
                    <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-xl max-w-2xl w-full border border-red-100">
                        <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mb-4 font-black text-xl">
                            !
                        </div>
                        <h1 className="text-xl sm:text-2xl font-black text-maroon mb-2 uppercase tracking-tight">
                            {isChunkError ? 'System Update Detected' : 'Application Recovered from Error'}
                        </h1>
                        <p className="text-gray-600 mb-6 text-xs sm:text-sm font-medium leading-relaxed">
                            {isChunkError 
                                ? 'A new version of the application was deployed. Reloading will fetch the updated system modules.'
                                : 'An unexpected error occurred. You can reload the page or reset session storage to restore full operation.'}
                        </p>

                        <div className="bg-gray-900 text-red-300 p-5 rounded-2xl overflow-auto text-[11px] font-mono mb-6 max-h-[250px] shadow-inner">
                            <p className="mb-2 font-bold">{this.state.error && this.state.error.toString()}</p>
                            {this.state.errorInfo && (
                                <pre className="whitespace-pre-wrap opacity-70">
                                    {this.state.errorInfo.componentStack}
                                </pre>
                            )}
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3">
                            <button
                                onClick={this.handleReload}
                                className="bg-maroon text-gold px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-elite-maroon transition-all shadow-md flex-1 text-center"
                            >
                                Reload Page
                            </button>

                            <button
                                onClick={this.handleResetAndReload}
                                className="bg-gray-100 text-gray-700 px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-gray-200 transition-all flex-1 text-center"
                            >
                                Clear Cache & Return to Login
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;

