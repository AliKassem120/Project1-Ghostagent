'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
    id: string;
    message: string;
    type: ToastType;
}

interface ToastContextType {
    success: (message: string) => void;
    error: (message: string) => void;
    info: (message: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
}

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const addToast = useCallback((message: string, type: ToastType) => {
        const id = Math.random().toString(36).substring(2, 9);
        setToasts(prev => [...prev, { id, message, type }]);

        // Auto-remove after 4 seconds
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 4000);
    }, []);

    const removeToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const toast = {
        success: (message: string) => addToast(message, 'success'),
        error: (message: string) => addToast(message, 'error'),
        info: (message: string) => addToast(message, 'info'),
    };

    const getIcon = (type: ToastType) => {
        switch (type) {
            case 'success': return <CheckCircle className="w-5 h-5 text-green-400" />;
            case 'error': return <AlertCircle className="w-5 h-5 text-red-400" />;
            case 'info': return <Info className="w-5 h-5 text-cyan-400" />;
        }
    };

    const getBorderColor = (type: ToastType) => {
        switch (type) {
            case 'success': return 'border-green-500/50 shadow-[0_0_20px_rgba(34,197,94,0.3)]';
            case 'error': return 'border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.3)]';
            case 'info': return 'border-cyan-500/50 shadow-[0_0_20px_rgba(34,211,238,0.3)]';
        }
    };

    return (
        <ToastContext.Provider value={toast}>
            {children}

            {/* Toast Container - Fixed at bottom */}
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-3 pointer-events-none">
                <AnimatePresence mode="popLayout">
                    {toasts.map((t) => (
                        <motion.div
                            key={t.id}
                            initial={{ opacity: 0, y: 50, scale: 0.9 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 20, scale: 0.9 }}
                            transition={{
                                type: 'spring',
                                damping: 25,
                                stiffness: 300
                            }}
                            className={`
                                pointer-events-auto
                                px-5 py-4 
                                rounded-2xl 
                                bg-black/80 
                                backdrop-blur-xl 
                                border 
                                ${getBorderColor(t.type)}
                                flex items-center gap-3 
                                min-w-[280px] max-w-[90vw]
                            `}
                        >
                            {getIcon(t.type)}
                            <span className="text-white font-medium flex-1">{t.message}</span>
                            <button
                                onClick={() => removeToast(t.id)}
                                className="text-white/40 hover:text-white transition-colors p-1"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </ToastContext.Provider>
    );
}
