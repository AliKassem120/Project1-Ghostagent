'use client';

import { useRef, useEffect, useState } from 'react';
import { motion, useInView } from 'framer-motion';

interface StatItemProps {
  value: string;
  targetNumber: number;
  suffix: string;
  label: string;
}

function StatItem({ value, targetNumber, suffix, label }: StatItemProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (isInView && targetNumber > 0) {
      let start = 0;
      const duration = 2000; // 2 seconds
      const increment = targetNumber / (duration / 16); // 60 FPS approx

      const timer = setInterval(() => {
        start += increment;
        if (start >= targetNumber) {
          setCount(targetNumber);
          clearInterval(timer);
        } else {
          setCount(Math.floor(start));
        }
      }, 16);

      return () => clearInterval(timer);
    }
  }, [isInView, targetNumber]);

  return (
    <div ref={ref} className="flex flex-col items-center justify-center p-4 text-center">
      <span className="text-3xl md:text-4xl font-black text-primary tracking-tight">
        {targetNumber > 0 ? (
          <>
            {count}
            {suffix}
          </>
        ) : (
          value
        )}
      </span>
      <span className="text-[10px] md:text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1">
        {label}
      </span>
    </div>
  );
}

export default function TrustedByBar() {
  return (
    <section className="relative w-full max-w-7xl mx-auto px-5 mb-12 sm:mb-20 z-10">
      <div className="glass-frosted border border-border/60 rounded-3xl md:rounded-[2rem] p-4 md:p-6 grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-0 divide-y md:divide-y-0 md:divide-x divide-border/40 shadow-lg">
        <StatItem value="24/7" targetNumber={24} suffix="/7" label="Availability" />
        <StatItem value="< 3s" targetNumber={3} suffix="s" label="Response Time" />
        <StatItem value="4" targetNumber={4} suffix="+" label="Languages" />
        <StatItem value="2" targetNumber={2} suffix="" label="Core Channels" />
      </div>
    </section>
  );
}
