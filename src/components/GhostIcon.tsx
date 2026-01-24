'use client';

import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { useEffect } from 'react';

export default function GhostIcon() {
    const x = useMotionValue(0);
    const y = useMotionValue(0);

    const mouseX = useSpring(x, { stiffness: 150, damping: 15 });
    const mouseY = useSpring(y, { stiffness: 150, damping: 15 });

    function handleMouseMove({ clientX, clientY }: MouseEvent) {
        const { innerWidth, innerHeight } = window;
        const xPct = clientX / innerWidth - 0.5;
        const yPct = clientY / innerHeight - 0.5;
        x.set(xPct * 200); // reduced range for 3D effect
        y.set(yPct * 200);
    }

    useEffect(() => {
        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);

    const rotateX = useTransform(mouseY, [-100, 100], [30, -30]);
    const rotateY = useTransform(mouseX, [-100, 100], [-30, 30]);

    return (
        <div className="relative w-64 h-64 perspective-1000">
            <motion.div
                style={{
                    rotateX,
                    rotateY,
                    x: mouseX,
                    y: mouseY,
                }}
                className="w-full h-full relative"
            >
                <div className="absolute inset-0 bg-primary/20 blur-[100px] rounded-full animate-pulse" />
                <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1"
                    className="w-full h-full text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]"
                >
                    <path
                        d="M9 10h.01M15 10h.01M12 2a8 8 0 0 0-8 8v12l3-3 2.5 2.5L12 19l2.5 2.5L17 19l3 3V10a8 8 0 0 0-8-8z"
                        fill="rgba(255, 255, 255, 0.1)"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </svg>
            </motion.div>
        </div>
    );
}
