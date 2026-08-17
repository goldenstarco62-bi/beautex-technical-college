import { useEffect, useRef, useState } from 'react';
import { SESSION_WARNING_BEFORE_MS } from '../../utils/sessionConfig';

/**
 * SessionWarningModal
 *
 * Renders a full-screen overlay warning the user they are about to be logged out
 * due to inactivity.  A live countdown shows how many seconds remain.
 * Clicking "Stay Logged In" calls `onStayLoggedIn()` which resets the inactivity
 * timer in AuthContext.
 *
 * Props:
 *   visible        – boolean, controls render
 *   onStayLoggedIn – function, called when the user dismisses the warning
 *   secondsLeft    – number, remaining seconds passed in from AuthContext
 */
export default function SessionWarningModal({ visible, onStayLoggedIn, secondsLeft }) {
    const btnRef = useRef(null);

    // Auto-focus the button when the modal appears so keyboard users can act quickly
    useEffect(() => {
        if (visible && btnRef.current) {
            btnRef.current.focus();
        }
    }, [visible]);

    if (!visible) return null;

    // Derive a 0-1 progress value for the SVG ring (goes from 1 → 0 as time runs out)
    const total = Math.round(SESSION_WARNING_BEFORE_MS / 1000); // 30
    const progress = Math.max(0, Math.min(1, secondsLeft / total));

    // SVG ring parameters
    const radius = 42;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference * (1 - progress);

    // Urgency colour: green → amber → red
    const ringColour = secondsLeft > 20 ? '#22c55e' : secondsLeft > 10 ? '#f59e0b' : '#ef4444';
    const countColour = secondsLeft > 20 ? '#4ade80' : secondsLeft > 10 ? '#fbbf24' : '#f87171';

    return (
        <>
            {/* ── Inline styles (no Tailwind dependency) ── */}
            <style>{`
                @keyframes bttc-pulse {
                    0%, 100% { opacity: 1; }
                    50%       { opacity: .6; }
                }
                @keyframes bttc-fade-in {
                    from { opacity: 0; transform: translateY(-12px) scale(.97); }
                    to   { opacity: 1; transform: translateY(0)       scale(1); }
                }
                .bttc-session-overlay {
                    position: fixed;
                    inset: 0;
                    z-index: 99999;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: rgba(0,0,0,.65);
                    backdrop-filter: blur(4px);
                    -webkit-backdrop-filter: blur(4px);
                }
                .bttc-session-card {
                    background: #1e1e2e;
                    border: 1px solid rgba(255,255,255,.10);
                    border-radius: 20px;
                    box-shadow: 0 24px 60px rgba(0,0,0,.6), 0 0 0 1px rgba(255,255,255,.05);
                    padding: 40px 44px;
                    max-width: 420px;
                    width: 90vw;
                    text-align: center;
                    animation: bttc-fade-in .25s ease both;
                    font-family: 'Inter', 'Segoe UI', sans-serif;
                }
                .bttc-session-ring-wrap {
                    position: relative;
                    width: 100px;
                    height: 100px;
                    margin: 0 auto 20px;
                }
                .bttc-session-ring-svg {
                    transform: rotate(-90deg);
                    width: 100%;
                    height: 100%;
                }
                .bttc-session-ring-bg {
                    fill: none;
                    stroke: rgba(255,255,255,.08);
                    stroke-width: 6;
                }
                .bttc-session-ring-fg {
                    fill: none;
                    stroke-width: 6;
                    stroke-linecap: round;
                    transition: stroke-dashoffset .9s linear, stroke .3s;
                }
                .bttc-session-count {
                    position: absolute;
                    inset: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 26px;
                    font-weight: 700;
                    transition: color .3s;
                }
                .bttc-session-icon {
                    font-size: 18px;
                    margin-bottom: 6px;
                    animation: bttc-pulse 1.4s ease-in-out infinite;
                }
                .bttc-session-title {
                    color: #f1f5f9;
                    font-size: 19px;
                    font-weight: 700;
                    margin: 0 0 8px;
                    letter-spacing: -.3px;
                }
                .bttc-session-body {
                    color: #94a3b8;
                    font-size: 14px;
                    line-height: 1.6;
                    margin: 0 0 28px;
                }
                .bttc-session-body strong {
                    color: #cbd5e1;
                }
                .bttc-session-btn {
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    background: linear-gradient(135deg, #7c3aed, #6d28d9);
                    color: #fff;
                    border: none;
                    border-radius: 12px;
                    padding: 13px 32px;
                    font-size: 15px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: transform .15s, box-shadow .15s, background .15s;
                    box-shadow: 0 4px 18px rgba(109,40,217,.4);
                    width: 100%;
                    justify-content: center;
                    outline-offset: 3px;
                }
                .bttc-session-btn:hover {
                    background: linear-gradient(135deg, #8b5cf6, #7c3aed);
                    transform: translateY(-1px);
                    box-shadow: 0 8px 24px rgba(109,40,217,.5);
                }
                .bttc-session-btn:active {
                    transform: translateY(0);
                }
                .bttc-session-btn:focus-visible {
                    outline: 2px solid #8b5cf6;
                }
                .bttc-session-divider {
                    margin: 20px 0 16px;
                    border: none;
                    border-top: 1px solid rgba(255,255,255,.07);
                }
                .bttc-session-logout-hint {
                    color: #475569;
                    font-size: 12px;
                }
            `}</style>

            <div
                className="bttc-session-overlay"
                role="dialog"
                aria-modal="true"
                aria-labelledby="session-warning-title"
                aria-describedby="session-warning-desc"
            >
                <div className="bttc-session-card">
                    {/* Countdown ring */}
                    <div className="bttc-session-ring-wrap" aria-hidden="true">
                        <svg className="bttc-session-ring-svg" viewBox="0 0 96 96">
                            <circle className="bttc-session-ring-bg" cx="48" cy="48" r={radius} />
                            <circle
                                className="bttc-session-ring-fg"
                                cx="48"
                                cy="48"
                                r={radius}
                                stroke={ringColour}
                                strokeDasharray={circumference}
                                strokeDashoffset={strokeDashoffset}
                            />
                        </svg>
                        <div className="bttc-session-count" style={{ color: countColour }}>
                            {secondsLeft}
                        </div>
                    </div>

                    {/* Icon + heading */}
                    <div className="bttc-session-icon">⏱️</div>
                    <h2 className="bttc-session-title" id="session-warning-title">
                        Session Expiring Soon
                    </h2>

                    {/* Body copy */}
                    <p className="bttc-session-body" id="session-warning-desc">
                        You have been inactive for a while.<br />
                        You will be automatically logged out in{' '}
                        <strong>{secondsLeft} second{secondsLeft !== 1 ? 's' : ''}</strong> to protect your account.
                    </p>

                    {/* CTA */}
                    <button
                        id="session-stay-logged-in-btn"
                        ref={btnRef}
                        className="bttc-session-btn"
                        onClick={onStayLoggedIn}
                    >
                        ✅ Stay Logged In
                    </button>

                    <hr className="bttc-session-divider" />
                    <p className="bttc-session-logout-hint">
                        You will be redirected to the login page if no action is taken.
                    </p>
                </div>
            </div>
        </>
    );
}
