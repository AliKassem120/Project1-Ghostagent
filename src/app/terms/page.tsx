import Footer from '@/components/Footer';
import Navbar from '@/components/Navbar';

export default function TermsOfService() {
    return (
        <main className="min-h-screen bg-background text-foreground">
            <Navbar />
            <div className="max-w-4xl mx-auto px-6 py-32 space-y-12">
                <div className="space-y-4 text-center">
                    <h1 className="text-4xl md:text-5xl font-bold text-white">Terms of Service</h1>
                    <p className="text-muted-foreground">Last updated: {new Date().toLocaleDateString()}</p>
                </div>

                <div className="prose prose-invert prose-lg max-w-none text-muted-foreground space-y-8">
                    <section>
                        <h2 className="text-2xl font-semibold text-white mb-4">1. Acceptance of Terms</h2>
                        <p>
                            By accessing or using GhostAgent ("we," "our," or "us"), you agree to be bound by these Terms of Service. If you do not agree to these terms, you may not access or use our services.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold text-white mb-4">2. Description of Service</h2>
                        <p>
                            GhostAgent provides an automated Instagram DM management platform powered by Artificial Intelligence (AI). We enable businesses to manage messaging workflows, inventory syncing, and automated replies.
                        </p>
                    </section>

                    <section className="bg-destructive/10 border border-destructive/20 p-8 rounded-2xl">
                        <h2 className="text-2xl font-semibold text-white mb-4">3. AI Liability Disclaimer</h2>
                        <p className="mb-4">
                            <strong>GhostAgent is an AI-powered tool.</strong> While we strive for accuracy, AI models may generate incorrect, misleading, or inappropriate responses ("hallucinations").
                        </p>
                        <p className="mb-4">
                            <strong>You acknowledge and agree that:</strong>
                        </p>
                        <ul className="list-disc pl-6 space-y-2">
                            <li>You are solely responsible for reviewing and overseeing the AI's interactions with your customers.</li>
                            <li>GhostAgent is not liable for any loss of business, reputation damage, or legal consequences arising from AI-generated content.</li>
                            <li>You should regularly monitor the AI's performance and intervene when necessary.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold text-white mb-4">4. User Responsibilities</h2>
                        <p>You agree to use the service in compliance with all applicable laws and Meta's Terms of Service. You are responsible for maintaining the security of your account credentials.</p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold text-white mb-4">5. Termination</h2>
                        <p>We reserve the right to suspend or terminate your access to GhostAgent at our sole discretion, without notice, for conduct that we believe violates these Terms of Service or is harmful to other users, us, or third parties, or for any other reason.</p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold text-white mb-4">6. Changes to Terms</h2>
                        <p>We reserve the right to modify these terms at any time. Your continued use of the service constitutes acceptance of the modified terms.</p>
                    </section>
                </div>
            </div>
            <Footer />
        </main>
    );
}
