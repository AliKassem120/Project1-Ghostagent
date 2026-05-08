'use client';

import { Link } from '@/i18n/navigation';
import GhostLogo from '@/components/GhostLogo';
import { Instagram, Mail, HelpCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';

export default function Footer() {
    const t = useTranslations('Footer');

    return (
        <footer className="relative z-10 border-t border-border bg-background pt-20 pb-10 overflow-hidden">
            {/* Background Glow */}
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] bg-primary/5 blur-[120px] rounded-full -z-10" />

            <div className="max-w-7xl mx-auto px-6">
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-12 mb-16">
                    {/* Brand Column */}
                    <div className="col-span-2 lg:col-span-2 space-y-6">
                        <Link href="/" className="flex items-center group">
                            <GhostLogo size="lg" />
                        </Link>
                        <p className="text-muted-foreground text-sm font-medium leading-relaxed max-w-xs">
                            {t('tagline')}
                        </p>
                        <div className="flex items-center gap-4">
                            <a href="https://instagram.com/ghostagent.ai" target="_blank" rel="noopener noreferrer" className="w-9 h-9 rounded-lg bg-surface-1 border border-border flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/30 transition-all">
                                <Instagram className="w-4 h-4" />
                            </a>
                            <a href="mailto:support@ghostagent.qzz.io" className="w-9 h-9 rounded-lg bg-surface-1 border border-border flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/30 transition-all">
                                <Mail className="w-4 h-4" />
                            </a>
                        </div>
                    </div>

                    {/* Product Links */}
                    <div className="space-y-6">
                        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/40">{t('product')}</h4>
                        <ul className="space-y-4">
                            <li><Link href="/#features" className="text-sm font-bold text-muted-foreground hover:text-primary transition-colors">{t('features')}</Link></li>
                            <li><Link href="/how-it-works" className="text-sm font-bold text-muted-foreground hover:text-primary transition-colors">{t('howItWorks')}</Link></li>
                            <li><Link href="/#pricing" className="text-sm font-bold text-muted-foreground hover:text-primary transition-colors">{t('pricing')}</Link></li>
                            <li><Link href="/about" className="text-sm font-bold text-muted-foreground hover:text-primary transition-colors">{t('about')}</Link></li>
                        </ul>
                    </div>

                    {/* Company Links */}
                    <div className="space-y-6">
                        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/40">{t('company')}</h4>
                        <ul className="space-y-4">
                            <li><Link href="/contact" className="text-sm font-bold text-muted-foreground hover:text-primary transition-colors">{t('contact')}</Link></li>
                            <li><Link href="/privacy" className="text-sm font-bold text-muted-foreground hover:text-primary transition-colors">{t('privacy')}</Link></li>
                            <li><Link href="/terms" className="text-sm font-bold text-muted-foreground hover:text-primary transition-colors">{t('terms')}</Link></li>
                        </ul>
                    </div>

                    {/* Legal Links */}
                    <div className="space-y-6">
                        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/40">{t('legal')}</h4>
                        <ul className="space-y-4">
                            <li><a href="mailto:support@ghostagent.qzz.io" className="text-sm font-bold text-muted-foreground hover:text-primary transition-colors flex items-center gap-2"><HelpCircle className="w-3 h-3" /> support@ghostagent.qzz.io</a></li>
                        </ul>
                    </div>
                </div>

                {/* Bottom Bar */}
                <div className="pt-8 border-t border-border/50 flex flex-col md:flex-row items-center justify-between gap-6">
                    <p className="text-xs font-bold text-muted-foreground/50 tracking-widest uppercase">
                        &copy; {new Date().getFullYear()} GhostAgent. {t('rights')}
                    </p>
                    <div className="flex items-center gap-8">
                        <span className="text-[10px] font-black text-muted-foreground/30 tracking-widest uppercase">Built with Meta API</span>
                        <div className="flex items-center gap-1.5 opacity-40">
                            <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                            <span className="text-[10px] font-bold text-foreground">Systems Operational</span>
                        </div>
                    </div>
                </div>
            </div>
        </footer>
    );
}
