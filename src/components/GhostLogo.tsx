'use client';

/**
 * ═══════════════════════════════════════════════════════════════
 * GhostLogo — Premium brand mark + wordmark
 * ═══════════════════════════════════════════════════════════════
 * 
 * Props:
 *   - size: 'sm' | 'md' | 'lg' (controls icon + text size)
 *   - showText: whether to show "GhostAgent" text (default true)
 *   - className: additional wrapper classes
 *   - iconOnly: only render the ghost icon, no wrapper
 */

interface GhostLogoProps {
    size?: 'sm' | 'md' | 'lg';
    showText?: boolean;
    className?: string;
    iconOnly?: boolean;
}

const sizeMap = {
    sm: { icon: 'w-6 h-6', text: 'text-base', wrapper: 'gap-2' },
    md: { icon: 'w-7 h-7', text: 'text-lg', wrapper: 'gap-2.5' },
    lg: { icon: 'w-9 h-9', text: 'text-xl', wrapper: 'gap-3' },
};

function GhostMark({ className = 'w-7 h-7' }: { className?: string }) {
    return (
        <svg
            viewBox="0 0 40 40"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={className}
        >
            <defs>
                <linearGradient id="ghost-brand-grad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#a78bfa" />
                    <stop offset="50%" stopColor="#818cf8" />
                    <stop offset="100%" stopColor="#6366f1" />
                </linearGradient>
                <linearGradient id="ghost-brand-glow" x1="20" y1="0" x2="20" y2="40" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#c4b5fd" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity="0.1" />
                </linearGradient>
            </defs>
            {/* Ghost body — rounded top, wavy bottom */}
            <path
                d="M20 4C12.268 4 6 10.268 6 18V30C6 30.552 6.448 31 7 31H10.5C10.5 31 12 28 14 28C16 28 17 31 17 31H23C23 31 24 28 26 28C28 28 29.5 31 29.5 31H33C33.552 31 34 30.552 34 30V18C34 10.268 27.732 4 20 4Z"
                fill="url(#ghost-brand-glow)"
                stroke="url(#ghost-brand-grad)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            {/* Left eye */}
            <circle cx="14.5" cy="17" r="2.5" fill="url(#ghost-brand-grad)" />
            <circle cx="13.8" cy="16.3" r="0.8" fill="white" opacity="0.7" />
            {/* Right eye */}
            <circle cx="25.5" cy="17" r="2.5" fill="url(#ghost-brand-grad)" />
            <circle cx="24.8" cy="16.3" r="0.8" fill="white" opacity="0.7" />
            {/* Mouth — subtle smile */}
            <path
                d="M16 23C16 23 18 25 20 25C22 25 24 23 24 23"
                stroke="url(#ghost-brand-grad)"
                strokeWidth="1.5"
                strokeLinecap="round"
            />
        </svg>
    );
}

export default function GhostLogo({ size = 'md', showText = true, className = '', iconOnly = false }: GhostLogoProps) {
    const s = sizeMap[size];

    if (iconOnly) {
        return <GhostMark className={className || s.icon} />;
    }

    return (
        <span className={`flex items-center ${s.wrapper} ${className}`}>
            <GhostMark className={s.icon} />
            {showText && (
                <span
                    className={`font-extrabold tracking-tight text-foreground ${s.text}`}
                    style={{ fontFamily: 'var(--font-brand), system-ui, sans-serif' }}
                >
                    Ghost<span className="text-[#818cf8]">Agent</span>
                </span>
            )}
        </span>
    );
}

// Export the icon separately for places that only need the mark
export { GhostMark };
