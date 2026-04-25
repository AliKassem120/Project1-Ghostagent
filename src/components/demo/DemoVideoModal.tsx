'use client';

import { X, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useRef, useEffect } from 'react';

interface DemoVideoModalProps {
    isOpen: boolean;
    onClose: () => void;
    videoSrc: string;
    posterSrc?: string;
}

export default function DemoVideoModal({ isOpen, onClose, videoSrc, posterSrc }: DemoVideoModalProps) {
    const [isLoading, setIsLoading] = useState(true);
    const videoRef = useRef<HTMLVideoElement>(null);

    // Auto-play when opened
    useEffect(() => {
        if (isOpen && videoRef.current) {
            setIsLoading(true);
            videoRef.current.play().catch((err) => {
                console.log("Autoplay prevented:", err);
            });
        }
    }, [isOpen]);

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100]"
                    />

                    {/* Modal */}
                    <div className="fixed inset-0 z-[101] flex items-center justify-center p-4 md:p-8">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="relative w-full max-w-6xl bg-surface-1 rounded-3xl p-2 md:p-4 border border-border shadow-2xl flex flex-col"
                        >
                            <button
                                onClick={onClose}
                                className="absolute -top-12 right-0 md:-right-12 p-3 rounded-full bg-surface-2/80 hover:bg-surface-2 text-white transition-colors z-10 border border-border/50 backdrop-blur"
                            >
                                <X className="w-6 h-6" />
                            </button>

                            <div className="aspect-video bg-black rounded-2xl overflow-hidden relative flex items-center justify-center shadow-inner">
                                {isLoading && (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/80 z-20">
                                        <Loader2 className="w-10 h-10 text-primary animate-spin" />
                                        <p className="text-muted-foreground font-medium">Loading high-quality demo...</p>
                                    </div>
                                )}
                                
                                <video
                                    ref={videoRef}
                                    src={videoSrc}
                                    poster={posterSrc}
                                    className="w-full h-full object-cover"
                                    controls
                                    playsInline
                                    muted
                                    onPlaying={() => setIsLoading(false)}
                                    onWaiting={() => setIsLoading(true)}
                                    onError={(e) => {
                                        setIsLoading(false);
                                        console.error("Failed to load demo video", e);
                                    }}
                                />
                            </div>

                            <div className="mt-6 md:mt-8 mb-4 text-center px-4">
                                <h3 className="text-2xl md:text-3xl font-black mb-3 tracking-tight">GhostAgent Product Demo</h3>
                                <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                                    See how GhostAgent fully automates your Instagram sales and service bookings in under 60 seconds.
                                </p>
                            </div>
                        </motion.div>
                    </div>
                </>
            )}
        </AnimatePresence>
    );
}
