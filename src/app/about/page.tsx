import Footer from '@/components/Footer';
import Navbar from '@/components/Navbar';
import GhostLogo from '@/components/GhostLogo';

export default function AboutUs() {
    return (
        <main className="min-h-screen bg-background text-foreground">
            <Navbar />
            <div className="max-w-4xl mx-auto px-6 py-32 space-y-24">

                {/* Hero */}
                <div className="space-y-8 text-center">
                    <div className="flex justify-center mb-8">
                        <div className="p-4 bg-primary/10 rounded-full">
                            <GhostLogo className="w-16 h-16 text-primary" />
                        </div>
                    </div>
                    <h1 className="text-4xl md:text-6xl font-black tracking-tight text-white leading-tight">
                        Automating Customer Service for the <span className="text-primary">Modern Business</span>.
                    </h1>
                    <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                        GhostAgent is the AI-powered sidekick that handles your Instagram DMs, so you can focus on building your empire.
                    </p>
                </div>

                {/* Story */}
                <div className="grid md:grid-cols-2 gap-12 items-center">
                    <div className="space-y-6">
                        <h2 className="text-3xl font-bold text-white">Our Mission</h2>
                        <div className="prose prose-invert text-muted-foreground space-y-6">
                            <p>
                                We built GhostAgent because we saw small business owners drowning in DMs.
                                Trying to reply to every customer while managing inventory and shipping orders is impossible to do alone.
                            </p>
                            <p>
                                Traditional chatbots are clunky and robotic. We wanted to build something different—an AI that feels human, understands your brand voice, and actually helps you sell.
                            </p>
                            <p>
                                Today, GhostAgent processes thousands of conversations daily, helping merchants reclaim their time and capture sales they would have otherwise missed.
                            </p>
                        </div>
                    </div>
                    <div className="relative h-80 rounded-3xl bg-card border border-white/5 overflow-hidden flex items-center justify-center">
                        {/* Abstract Visual */}
                        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-transparent opacity-50" />
                        <div className="text-8xl font-black text-white/5 select-none">GHOST</div>
                    </div>
                </div>

            </div>
            <Footer />
        </main>
    );
}
