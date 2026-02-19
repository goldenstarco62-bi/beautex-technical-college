import React from 'react';

export default function AppDebug() {
    return (
        <div style={{ padding: '50px', fontFamily: 'sans-serif' }}>
            <h1 style={{ color: 'green' }}>✓ System Core is Running</h1>
            <p>If you can see this message, the React application is mounting correctly.</p>
            <p>The issue lies within the complex component tree.</p>
            <button onClick={() => window.location.reload()} style={{ marginTop: '20px', padding: '10px 20px' }}>
                Reload
            </button>
        </div>
    );
}
