'use client';

import { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertTriangle, Info, Trash2 } from 'lucide-react';

type ModalVariant = 'default' | 'danger' | 'info';

interface GhostModalProps {
    isOpen: boolean;
    title: string;
    message: string | ReactNode;
    confirmText?: string;
    cancelText?: string;
    variant?: ModalVariant;
    icon?: ReactNode;
    onConfirm: () => void;
    onCancel: () => void;
}

export default function GhostModal({
    isOpen,
    title,
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    variant = 'default',
    icon,
    onConfirm,
    onCancel,
}: GhostModalProps) {
    if (!isOpen) return null;

    const getVariantStyles = () => {
        switch (variant) {
            case 'danger':
                return {
                    iconBg: 'bg-red-500/20',
                    iconColor: 'text-red-400',
                    buttonBg: 'bg-red-600 hover:bg-red-500',
                    buttonShadow: 'shadow-[0_0_20px_rgba(239,68,68,0.4)]',
                    borderColor: 'border-red-500/30',
                    glowColor: 'shadow-[0_0_40px_-10px_rgba(239,68,68,0.4)]',
                    defaultIcon: <Trash2 className="w-6 h-6" />,
                };
            case 'info':
                return {
                    iconBg: 'bg-cyan-500/20',
                    iconColor: 'text-cyan-400',
                    buttonBg: 'bg-cyan-600 hover:bg-cyan-500',
                    buttonShadow: 'shadow-[0_0_20px_rgba(34,211,238,0.4)]',
                    borderColor: 'border-cyan-500/30',
                    glowColor: 'shadow-[0_0_40px_-10px_rgba(34,211,238,0.4)]',
                    defaultIcon: <Info className="w-6 h-6" />,
                };
            default:
                return {
                    iconBg: 'bg-purple-500/20',
                    iconColor: 'text-purple-400',
                    buttonBg: 'bg-purple-600 hover:bg-purple-500',
                    buttonShadow: 'shadow-[0_0_20px_rgba(168,85,247,0.5)]',
                    borderColor: 'border-purple-500/30',
                    glowColor: 'shadow-[0_0_40px_-10px_rgba(168,85,247,0.4)]',
                    defaultIcon: <AlertTriangle className="w-6 h-6" />,
                };
        }
    };

    const styles = getVariantStyles();

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    {/* Overlay */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                        onClick={onCancel}
                    />

                    {/* Modal Container */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className={`
                            relative z-10 w-full max-w-md
                            bg-zinc-950/95 backdrop-blur-xl
                            border ${styles.borderColor}
                            rounded-2xl
                            ${styles.glowColor}
                            overflow-hidden
                        `}
                    >
                        {/* Close Button */}
                        <button
                            onClick={onCancel}
                            className="absolute top-4 right-4 p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-white/10 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        {/* Content */}
                        <div className="p-6">
                            {/* Icon */}
                            <div className={`w-14 h-14 ${styles.iconBg} rounded-2xl flex items-center justify-center mb-5 ${styles.iconColor}`}>
                                {icon || styles.defaultIcon}
                            </div>

                            {/* Title */}
                            <h2 className="text-xl font-bold text-white mb-2">
                                {title}
                            </h2>

                            {/* Message */}
                            <p className="text-zinc-400 leading-relaxed">
                                {message}
                            </p>

                            {/* Actions */}
                            <div className="mt-8 flex justify-end gap-3">
                                <button
                                    onClick={onCancel}
                                    className="
                                        rounded-xl px-5 py-2.5 
                                        text-sm font-semibold 
                                        text-zinc-400 
                                        hover:text-white hover:bg-zinc-800 
                                        border border-zinc-800 hover:border-zinc-700
                                        transition-all
                                    "
                                >
                                    {cancelText}
                                </button>
                                <button
                                    onClick={() => {
                                        onConfirm();
                                        onCancel();
                                    }}
                                    className={`
                                        rounded-xl px-5 py-2.5 
                                        text-sm font-bold text-white 
                                        ${styles.buttonBg}
                                        ${styles.buttonShadow}
                                        transition-all hover:scale-[1.02] active:scale-[0.98]
                                    `}
                                >
                                    {confirmText}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
