'use client';

import { useEffect, useState } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';

interface CountUpProps {
    end: number;
    duration?: number;
    prefix?: string;
    suffix?: string;
    decimals?: number;
}

export default function CountUp({ end, duration = 2, prefix = '', suffix = '', decimals = 0 }: CountUpProps) {
    const count = useMotionValue(0);
    const rounded = useSpring(count, { damping: 50, stiffness: 100 });
    const [displayValue, setDisplayValue] = useState('0');

    useEffect(() => {
        count.set(end);
    }, [count, end]);

    useEffect(() => {
        const unsubscribe = rounded.on('change', (latest) => {
            setDisplayValue(latest.toFixed(decimals));
        });
        return unsubscribe;
    }, [rounded, decimals]);

    return (
        <span>
            {prefix}{displayValue}{suffix}
        </span>
    );
}
