'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

export default function StarBackground() {
    const [stars, setStars] = useState<{ id: number; x: number; y: number; size: number; duration: number; delay: number }[]>([]);
    const [rain, setRain] = useState<{ id: number; x: number; height: number; duration: number; delay: number }[]>([]);

    useEffect(() => {
        // Generate random stars
        const newStars = Array.from({ length: 100 }).map((_, i) => ({
            id: i,
            x: Math.random() * 100,
            y: Math.random() * 100,
            size: Math.random() * 2 + 0.5,
            duration: Math.random() * 3 + 2,
            delay: Math.random() * 5
        }));
        setStars(newStars);

        // Generate digital rain
        const newRain = Array.from({ length: 40 }).map((_, i) => ({
            id: i,
            x: Math.random() * 100,
            height: Math.random() * 100 + 50,
            duration: Math.random() * 15 + 10,
            delay: Math.random() * 20
        }));
        setRain(newRain);
    }, []);

    return (
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-900/20 via-black to-black">
            {stars.map((star) => (
                <motion.div
                    key={`star-${star.id}`}
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

            {/* Digital Rain */}
            {rain.map((drop) => (
                <motion.div
                    key={`rain-${drop.id}`}
                    initial={{ top: -200, opacity: 0 }}
                    animate={{ top: '120%', opacity: [0, 0.5, 0] }}
                    transition={{
                        duration: drop.duration,
                        repeat: Infinity,
                        delay: drop.delay,
                        ease: "linear"
                    }}
                    className="absolute w-[1px] bg-gradient-to-b from-transparent via-cyan-500/50 to-purple-500/20"
                    style={{
                        left: `${drop.x}%`,
                        height: drop.height,
                    }}
                />
            ))}

            {/* Nebula */}
            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-tr from-purple-900/10 via-transparent to-blue-900/10 mix-blend-screen" />
        </div>
    );
}
