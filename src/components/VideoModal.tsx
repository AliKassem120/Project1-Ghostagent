'use client';

import { X, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';

interface VideoModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function VideoModal({ isOpen, onClose }: VideoModalProps) {
    const [isLoading, setIsLoading] = useState(true);

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
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100]"
                    />

                    {/* Modal */}
                    <div className="fixed inset-0 z-[101] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="relative w-full max-w-5xl bg-surface-1 rounded-3xl p-6 border border-border"
                        >
                            <button
                                onClick={onClose}
                                className="absolute top-4 right-4 p-2 rounded-full bg-surface-2 hover:bg-surface-2 transition-colors z-10"
                            >
                                <X className="w-6 h-6" />
                            </button>

                            <div className="aspect-video bg-black rounded-2xl overflow-hidden flex items-center justify-center relative">
                                {isLoading && (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/80">
                                        <Loader2 className="w-12 h-12 text-primary animate-spin" />
                                        <p className="text-muted-foreground">Loading demo (7.7 MB)...</p>
                                    </div>
                                )}
                                <img
                                    src="/demo.webp"
                                    alt="GhostAgent Product Demo"
                                    className="w-full h-full object-contain"
                                    onLoad={() => setIsLoading(false)}
                                    onError={() => {
                                        setIsLoading(false);
                                        console.error("Failed to load demo video");
                                    }}
                                />
                            </div>

                            <div className="mt-6 text-center">
                                <h3 className="text-2xl font-bold mb-2">GhostAgent Product Demo</h3>
                                <p className="text-muted-foreground">See how GhostAgent automates your Instagram sales in under 2 minutes.</p>
                            </div>
                        </motion.div>
                    </div>
                </>
            )}
        </AnimatePresence>
    );
}
