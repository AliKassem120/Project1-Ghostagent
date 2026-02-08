'use client';

import { createContext, useContext, ReactNode } from 'react';
import { Toaster, toast as sonnerToast } from 'sonner';
import { Ghost, CheckCircle, AlertCircle, Info } from 'lucide-react';

interface ToastOptions {
    description?: string;
    icon?: ReactNode;
}

interface ToastContextType {
    success: (message: string, options?: ToastOptions) => void;
    error: (message: string, options?: ToastOptions) => void;
    info: (message: string, options?: ToastOptions) => void;
    ghost: (message: string, options?: ToastOptions) => void;
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
    const toast: ToastContextType = {
        success: (message: string, options?: ToastOptions) => {
            sonnerToast.success(message, {
                description: options?.description,
                icon: options?.icon || <CheckCircle className="w-5 h-5 text-green-400" />,
            });
        },
        error: (message: string, options?: ToastOptions) => {
            sonnerToast.error(message, {
                description: options?.description,
                icon: options?.icon || <AlertCircle className="w-5 h-5 text-red-400" />,
            });
        },
        info: (message: string, options?: ToastOptions) => {
            sonnerToast.info(message, {
                description: options?.description,
                icon: options?.icon || <Info className="w-5 h-5 text-cyan-400" />,
            });
        },
        ghost: (message: string, options?: ToastOptions) => {
            sonnerToast(message, {
                description: options?.description,
                icon: options?.icon || <Ghost className="w-5 h-5 text-purple-400" />,
            });
        },
    };

    return (
        <ToastContext.Provider value={toast}>
            {children}

            {/* Sonner Toaster with GhostAgent Theme */}
            <Toaster
                theme="dark"
                position="bottom-center"
                expand={true}
                richColors
                closeButton
                toastOptions={{
                    style: {
                        background: 'rgba(10, 10, 10, 0.85)',
                        backdropFilter: 'blur(16px)',
                        WebkitBackdropFilter: 'blur(16px)',
                        border: '1px solid rgba(147, 51, 234, 0.3)',
                        boxShadow: '0 0 30px -5px rgba(168, 85, 247, 0.25)',
                        color: '#fff',
                        borderRadius: '16px',
                        padding: '16px 20px',
                    },
                    classNames: {
                        toast: 'ghost-toast',
                        title: 'font-semibold text-white',
                        description: 'text-white/60 text-sm',
                        closeButton: 'bg-white/10 hover:bg-white/20 border-white/10',
                    },
                    duration: 4000,
                }}
            />
        </ToastContext.Provider>
    );
}
