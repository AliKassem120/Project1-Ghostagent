export default function GhostLogo({ className = "w-8 h-8" }: { className?: string }) {
    return (
        <svg
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={className}
        >
            <defs>
                <linearGradient id="ghost-gradient" x1="0" y1="0" x2="32" y2="32">
                    <stop offset="0%" stopColor="#818cf8" />
                    <stop offset="100%" stopColor="#c084fc" />
                </linearGradient>
            </defs>
            {/* Ghost Body */}
            <path
                d="M16 2C10 2 6 6 6 12V24C6 26.2 7.8 28 10 28H22C24.2 28 26 26.2 26 24V12C26 6 22 2 16 2Z"
                fill="url(#ghost-gradient)"
                fillOpacity="0.2"
                stroke="url(#ghost-gradient)"
                strokeWidth="2"
            />
            {/* Eyes */}
            <circle cx="12" cy="12" r="2" fill="white" />
            <circle cx="20" cy="12" r="2" fill="white" />
            {/* Digital Signal / Smile */}
            <path
                d="M11 20H13V18H15V22H17V18H19V20H21"
                stroke="white"
                strokeWidth="1.5"
                strokeLinecap="round"
            />
        </svg>
    );
}
