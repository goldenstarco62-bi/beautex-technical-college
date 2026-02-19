import React from 'react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        console.error("Uncaught error:", error, errorInfo);
        this.setState({ error, errorInfo });
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen flex items-center justify-center bg-gray-50 p-8">
                    <div className="bg-white p-8 rounded-2xl shadow-xl max-w-2xl w-full border border-red-100">
                        <h1 className="text-2xl font-black text-red-600 mb-4 uppercase tracking-widest">Something went wrong</h1>
                        <p className="text-gray-600 mb-6 font-medium">The application crashed. Please report the following error:</p>

                        <div className="bg-gray-900 text-red-300 p-6 rounded-xl overflow-auto text-xs font-mono mb-6 max-h-[400px]">
                            <p className="mb-2 font-bold">{this.state.error && this.state.error.toString()}</p>
                            <pre className="whitespace-pre-wrap opacity-70">
                                {this.state.errorInfo && this.state.errorInfo.componentStack}
                            </pre>
                        </div>

                        <button
                            onClick={() => window.location.reload()}
                            className="bg-red-600 text-white px-6 py-3 rounded-xl font-bold uppercase tracking-widest hover:bg-red-700 transition-colors"
                        >
                            Reload Page
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
