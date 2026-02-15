import Link from 'next/link';
import GhostLogo from '@/components/GhostLogo';
import { Twitter, Instagram, Mail } from 'lucide-react';

export default function Footer() {
    return (
        <footer className="border-t border-white/5 bg-background text-muted-foreground py-12 px-6">
            <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12">
                {/* Brand */}
                <div className="space-y-4">
                    <Link href="/" className="flex items-center gap-2 text-white hover:opacity-80 transition-opacity">
                        <GhostLogo className="w-8 h-8" />
                        <span className="text-xl font-bold tracking-tight">GhostAgent</span>
                    </Link>
                    <p className="text-sm">Automating Instagram DMs for the next generation of commerce.</p>
                </div>

                {/* Product */}
                <div>
                    <h3 className="text-white font-semibold mb-4">Product</h3>
                    <ul className="space-y-3 text-sm">
                        <li><Link href="/#features" className="hover:text-primary transition-colors">Features</Link></li>
                        <li><Link href="/#pricing" className="hover:text-primary transition-colors">Pricing</Link></li>
                        <li><Link href="/login" className="hover:text-primary transition-colors">Login</Link></li>
                    </ul>
                </div>

                {/* Legal */}
                <div>
                    <h3 className="text-white font-semibold mb-4">Legal</h3>
                    <ul className="space-y-3 text-sm">
                        <li><Link href="/privacy" className="hover:text-primary transition-colors">Privacy Policy</Link></li>
                        <li><Link href="/terms" className="hover:text-primary transition-colors">Terms of Service</Link></li>
                        <li><Link href="/privacy#deletion" className="hover:text-primary transition-colors">Data Deletion</Link></li>
                    </ul>
                </div>

                {/* Connect */}
                <div>
                    <h3 className="text-white font-semibold mb-4">Connect</h3>
                    <ul className="space-y-3 text-sm">
                        <li>
                            <Link href="/contact" className="flex items-center gap-2 hover:text-primary transition-colors">
                                <Mail className="w-4 h-4" /> Contact Support
                            </Link>
                        </li>
                        <li>
                            <a href="#" className="flex items-center gap-2 hover:text-primary transition-colors">
                                <Twitter className="w-4 h-4" /> Twitter
                            </a>
                        </li>
                        <li>
                            <a href="#" className="flex items-center gap-2 hover:text-primary transition-colors">
                                <Instagram className="w-4 h-4" /> Instagram
                            </a>
                        </li>
                    </ul>
                </div>
            </div>
            <div className="max-w-7xl mx-auto mt-12 pt-8 border-t border-white/5 text-center text-xs opacity-50">
                &copy; {new Date().getFullYear()} GhostAgent. All rights reserved.
            </div>
        </footer>
    );
}
