'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

export default function StarBackground() {
    const [stars, setStars] = useState<{ id: number; x: number; y: number; size: number; duration: number; delay: number }[]>([]);

    useEffect(() => {
        // Generate more random stars for better density
        const newStars = Array.from({ length: 100 }).map((_, i) => ({
            id: i,
            x: Math.random() * 100,
            y: Math.random() * 100,
            size: Math.random() * 2 + 0.5,
            duration: Math.random() * 3 + 2,
            delay: Math.random() * 5
        }));

        // Use setTimeout to avoid setState during render
        const timer = setTimeout(() => setStars(newStars), 0);
        return () => clearTimeout(timer);
    }, []);

    return (
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-900/20 via-black to-black">
            {stars.map((star) => (
                <motion.div
                    key={star.id}
                    initial={{ opacity: 0 }}
                    animate={{
                        opacity: [0, 0.8, 0],
                        scale: [0.5, 1, 0.5]
                    }}
                    transition={{
                        duration: star.duration,
                        repeat: Infinity,
                        delay: star.delay,
                        ease: "easeInOut",
                    }}
                    style={{
                        position: 'absolute',
                        left: `${star.x}%`,
                        top: `${star.y}%`,
                        width: star.size,
                        height: star.size,
                        backgroundColor: 'white',
                        borderRadius: '50%',
                        boxShadow: `0 0 ${star.size * 2}px rgba(255, 255, 255, 0.8)`
                    }}
                />
            ))}
            {/* Add a subtle nebula effect */}
            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-tr from-purple-900/20 via-transparent to-blue-900/20 mix-blend-screen" />
        </div>
    );
}
