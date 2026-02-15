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
                    iconBg: 'bg-red-500/10',
                    iconColor: 'text-red-400',
                    buttonBg: 'bg-red-600 hover:bg-red-500',
                    borderColor: 'border-white/[0.08]',
                    defaultIcon: <Trash2 className="w-6 h-6" />,
                };
            case 'info':
                return {
                    iconBg: 'bg-blue-500/10',
                    iconColor: 'text-blue-400',
                    buttonBg: 'bg-blue-600 hover:bg-blue-500',
                    borderColor: 'border-white/[0.08]',
                    defaultIcon: <Info className="w-6 h-6" />,
                };
            default:
                return {
                    iconBg: 'bg-primary/10',
                    iconColor: 'text-primary',
                    buttonBg: 'bg-primary hover:bg-primary/90',
                    borderColor: 'border-white/[0.08]',
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
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className={`
                            relative z-10 w-full max-w-md
                            bg-[#12131A]
                            border ${styles.borderColor}
                            rounded-2xl
                            shadow-xl
                            overflow-hidden
                        `}
                    >
                        {/* Close Button */}
                        <button
                            onClick={onCancel}
                            className="absolute top-4 right-4 p-1.5 rounded-lg text-white/20 hover:text-white hover:bg-white/[0.06] transition-colors"
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
                            <h2 className="text-xl font-semibold text-white mb-2">
                                {title}
                            </h2>

                            {/* Message */}
                            <p className="text-white/40 leading-relaxed text-sm">
                                {message}
                            </p>

                            {/* Actions */}
                            <div className="mt-8 flex justify-end gap-3">
                                <button
                                    onClick={onCancel}
                                    className="
                                        rounded-xl px-5 py-2.5 
                                        text-sm font-medium 
                                        text-white/40 
                                        hover:text-white hover:bg-white/[0.06] 
                                        border border-white/[0.08] hover:border-white/[0.12]
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
                                        text-sm font-semibold text-white 
                                        ${styles.buttonBg}
                                        shadow-md
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
