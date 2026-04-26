import Link from 'next/link';
import GhostLogo from '@/components/GhostLogo';
import { Instagram, Mail, HelpCircle } from 'lucide-react';

export default function Footer() {
    return (
        <footer className="relative z-10 border-t border-border bg-background pt-20 pb-10 overflow-hidden">
            {/* Background Glow */}
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] bg-primary/5 blur-[120px] rounded-full -z-10" />

            <div className="max-w-7xl mx-auto px-6">
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-12 mb-16">
                    {/* Brand Column */}
                    <div className="col-span-2 lg:col-span-2 space-y-6">
                        <Link href="/" className="flex items-center gap-2.5 group">
                            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                                <GhostLogo className="w-5 h-5 text-primary" />
                            </div>
                            <span className="text-xl font-black tracking-tighter text-foreground">GhostAgent</span>
                        </Link>
                        <p className="text-muted-foreground text-sm font-medium leading-relaxed max-w-xs">
                            The enterprise-grade AI business agent for Instagram DMs. Sell products and book appointments on autopilot.
                        </p>
                        <div className="flex items-center gap-4">
                            <a href="#" className="w-9 h-9 rounded-lg bg-surface-1 border border-border flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/30 transition-all">
                                <Instagram className="w-4 h-4" />
                            </a>
                            <a href="mailto:hello@ghostagent.ai" className="w-9 h-9 rounded-lg bg-surface-1 border border-border flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/30 transition-all">
                                <Mail className="w-4 h-4" />
                            </a>
                        </div>
                    </div>

                    {/* Product Links */}
                    <div className="space-y-6">
                        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/40">Product</h4>
                        <ul className="space-y-4">
                            <li><Link href="/#features" className="text-sm font-bold text-muted-foreground hover:text-primary transition-colors">Features</Link></li>
                            <li><Link href="/#pricing" className="text-sm font-bold text-muted-foreground hover:text-primary transition-colors">Pricing</Link></li>
                            <li><Link href="/demo" className="text-sm font-bold text-muted-foreground hover:text-primary transition-colors">Watch Demo</Link></li>
                            <li><Link href="/about" className="text-sm font-bold text-muted-foreground hover:text-primary transition-colors">About</Link></li>
                        </ul>
                    </div>

                    {/* Company Links */}
                    <div className="space-y-6">
                        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/40">Company</h4>
                        <ul className="space-y-4">
                            <li><Link href="/contact" className="text-sm font-bold text-muted-foreground hover:text-primary transition-colors">Contact</Link></li>
                            <li><Link href="/privacy" className="text-sm font-bold text-muted-foreground hover:text-primary transition-colors">Privacy Policy</Link></li>
                            <li><Link href="/terms" className="text-sm font-bold text-muted-foreground hover:text-primary transition-colors">Terms of Service</Link></li>
                        </ul>
                    </div>

                    {/* Support Links */}
                    <div className="space-y-6">
                        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/40">Support</h4>
                        <ul className="space-y-4">
                            <li><Link href="/help" className="text-sm font-bold text-muted-foreground hover:text-primary transition-colors flex items-center gap-2">Help Center <HelpCircle className="w-3 h-3" /></Link></li>
                            <li><a href="mailto:support@ghostagent.ai" className="text-sm font-bold text-muted-foreground hover:text-primary transition-colors">Email Support</a></li>
                        </ul>
                    </div>
                </div>

                {/* Bottom Bar */}
                <div className="pt-8 border-t border-border/50 flex flex-col md:flex-row items-center justify-between gap-6">
                    <p className="text-xs font-bold text-muted-foreground/50 tracking-widest uppercase">
                        &copy; {new Date().getFullYear()} GhostAgent. All rights reserved.
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
