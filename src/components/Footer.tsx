import Link from 'next/link';
import GhostLogo from '@/components/GhostLogo';

export default function Footer() {
    return (
        <footer className="relative z-10 border-t border-white/5 bg-background">
            <div className="max-w-7xl mx-auto px-6 py-10">
                <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                    {/* Brand */}
                    <Link href="/" className="flex items-center gap-2 text-white/50 hover:text-white/70 transition-colors">
                        <GhostLogo className="w-5 h-5" />
                        <span className="text-sm font-semibold tracking-tight">GhostAgent</span>
                    </Link>

                    {/* Links */}
                    <div className="flex items-center gap-6 text-xs text-white/30">
                        <Link href="/#features" className="hover:text-white/60 transition-colors">Features</Link>
                        <Link href="/#pricing" className="hover:text-white/60 transition-colors">Pricing</Link>
                        <Link href="/privacy" className="hover:text-white/60 transition-colors">Privacy</Link>
                        <Link href="/terms" className="hover:text-white/60 transition-colors">Terms</Link>
                        <Link href="/contact" className="hover:text-white/60 transition-colors">Contact</Link>
                    </div>

                    {/* Copyright */}
                    <p className="text-xs text-white/20">
                        &copy; {new Date().getFullYear()} GhostAgent. All rights reserved.
                    </p>
                </div>
            </div>
        </footer>
    );
}
