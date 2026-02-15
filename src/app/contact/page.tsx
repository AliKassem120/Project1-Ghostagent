import Footer from '@/components/Footer';
import Navbar from '@/components/Navbar';
import { Mail, MessageSquare } from 'lucide-react';

export default function Contact() {
    return (
        <main className="min-h-screen bg-background text-foreground">
            <Navbar />
            <div className="max-w-7xl mx-auto px-6 py-32 flex flex-col items-center justify-center min-h-[80vh]">

                <h1 className="text-4xl md:text-5xl font-bold text-white mb-6 text-center">Contact Support</h1>
                <p className="text-muted-foreground mb-12 text-center max-w-lg">
                    Have a question or need help setting up your agent? We're here to help.
                </p>

                <div className="w-full max-w-md bg-card border border-white/5 rounded-3xl p-8 shadow-2xl">
                    <form className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-white ml-1">Email Address</label>
                            <input
                                type="email"
                                placeholder="you@example.com"
                                className="w-full bg-background border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-1 focus:ring-primary focus:border-primary/50 outline-none transition-all placeholder:text-muted-foreground/50"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-white ml-1">Message</label>
                            <textarea
                                rows={4}
                                placeholder="How can we help?"
                                className="w-full bg-background border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-1 focus:ring-primary focus:border-primary/50 outline-none transition-all placeholder:text-muted-foreground/50 resize-none"
                            />
                        </div>

                        <button className="w-full py-4 bg-primary text-black font-bold rounded-xl hover:opacity-90 transition-opacity">
                            Send Message
                        </button>
                    </form>

                    <div className="mt-8 pt-8 border-t border-white/5 text-center">
                        <p className="text-sm text-muted-foreground flex items-center justify-center gap-2">
                            <Mail className="w-4 h-4" />
                            Or email us directly at
                            <a href="mailto:support@ghostagent.com" className="text-primary hover:underline">support@ghostagent.com</a>
                        </p>
                    </div>
                </div>

            </div>
            <Footer />
        </main>
    );
}
