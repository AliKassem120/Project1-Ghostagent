'use client';

export default function StarBackground() {
    return (
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
            {/* Subtle radial gradient for depth — no animations, no particles */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(88,28,135,0.08)_0%,_transparent_60%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_rgba(30,27,75,0.06)_0%,_transparent_50%)]" />
        </div>
    );
}
