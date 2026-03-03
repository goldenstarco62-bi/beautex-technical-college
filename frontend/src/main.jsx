import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import './index.css'

// Catch unhandled promise rejections that can cause silent white screens
window.addEventListener('unhandledrejection', (event) => {
    console.error('[App] Unhandled Promise Rejection:', event.reason);
});

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <ErrorBoundary>
            <App />
        </ErrorBoundary>
    </React.StrictMode>,
)
