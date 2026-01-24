'use client';

import { useEffect, useRef } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';

export default function FloatingGhost() {
    const x = useMotionValue(0);
    const y = useMotionValue(0);

    const springConfig = { damping: 25, stiffness: 150 };
    const rotateX = useSpring(useTransform(y, [-300, 300], [15, -15]), springConfig);
    const rotateY = useSpring(useTransform(x, [-300, 300], [-15, 15]), springConfig);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            const rect = document.body.getBoundingClientRect();
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            x.set(e.clientX - centerX);
            y.set(e.clientY - centerY);
        };

        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, [x, y]);

    return (
        <div className="relative w-64 h-64 flex items-center justify-center">
            <motion.div
                style={{
                    rotateX,
                    rotateY,
                    transformStyle: 'preserve-3d',
                }}
                animate={{
                    y: [0, -20, 0],
                }}
                transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: 'easeInOut',
                }}
                className="relative"
            >
                <motion.svg
                    viewBox="0 0 200 200"
                    className="w-full h-full drop-shadow-[0_0_40px_rgba(192,132,252,0.6)]"
                    style={{
                        filter: 'drop-shadow(0 0 40px rgba(192, 132, 252, 0.6))',
                    }}
                >
                    <defs>
                        <linearGradient id="ghost-glow" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#c084fc" stopOpacity="0.8" />
                            <stop offset="100%" stopColor="#818cf8" stopOpacity="0.8" />
                        </linearGradient>
                        <filter id="glow">
                            <feGaussianBlur stdDeviation="8" result="coloredBlur" />
                            <feMerge>
                                <feMergeNode in="coloredBlur" />
                                <feMergeNode in="SourceGraphic" />
                            </feMerge>
                        </filter>
                    </defs>

                    {/* Ghost Body */}
                    <path
                        d="M100 40 C70 40, 50 60, 50 90 L50 140 C50 145, 55 150, 60 150 L65 145 L70 150 L75 145 L80 150 L85 145 L90 150 L95 145 L100 150 L105 145 L110 150 L115 145 L120 150 L125 145 L130 150 L135 145 L140 150 C145 150, 150 145, 150 140 L150 90 C150 60, 130 40, 100 40 Z"
                        fill="url(#ghost-glow)"
                        filter="url(#glow)"
                    />

                    {/* Eyes */}
                    <motion.circle
                        cx="80"
                        cy="90"
                        r="8"
                        fill="#000"
                        animate={{ scaleY: [1, 0.1, 1] }}
                        transition={{ duration: 3, repeat: Infinity, repeatDelay: 2 }}
                    />
                    <motion.circle
                        cx="120"
                        cy="90"
                        r="8"
                        fill="#000"
                        animate={{ scaleY: [1, 0.1, 1] }}
                        transition={{ duration: 3, repeat: Infinity, repeatDelay: 2 }}
                    />

                    {/* Mouth */}
                    <path
                        d="M85 110 Q100 120 115 110"
                        stroke="#000"
                        strokeWidth="4"
                        fill="none"
                        strokeLinecap="round"
                    />
                </motion.svg>
            </motion.div>
        </div>
    );
}
