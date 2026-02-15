import Footer from '@/components/Footer';
import Navbar from '@/components/Navbar';

export default function PrivacyPolicy() {
    return (
        <main className="min-h-screen bg-background text-foreground">
            <Navbar />
            <div className="max-w-4xl mx-auto px-6 py-32 space-y-12">
                <div className="space-y-4 text-center">
                    <h1 className="text-4xl md:text-5xl font-bold text-white">Privacy Policy</h1>
                    <p className="text-muted-foreground">Last updated: {new Date().toLocaleDateString()}</p>
                </div>

                <div className="prose prose-invert prose-lg max-w-none text-muted-foreground space-y-8">
                    <section>
                        <h2 className="text-2xl font-semibold text-white mb-4">1. Introduction</h2>
                        <p>
                            Welcome to GhostAgent ("we," "our," or "us"). We are committed to protecting your personal information and your right to privacy.
                            This Privacy Policy explains how we collect, use, disclose, and shield your information when you use our automated Instagram DM service.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold text-white mb-4">2. Integration with Meta Platform Technologies</h2>
                        <p>
                            Our service integrates directly with Meta Platform Technologies (specifically Instagram and Facebook Graph APIs) to read and reply to direct messages on your behalf.
                            By using GhostAgent, you acknowledge that your data is processed in accordance with Meta's Platform Terms and Developer Policies.
                            We only access the data necessary to perform the automated response function.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold text-white mb-4">3. Data Storage and Processing</h2>
                        <p>
                            We use industry-standard providers to facilitate our service:
                        </p>
                        <ul className="list-disc pl-6 space-y-2 mt-4">
                            <li><strong>Supabase:</strong> We use Supabase securely to store user account information, authentication data, and activity logs.</li>
                            <li><strong>AI Processing:</strong> Incoming messages are processed by advanced AI models (such as OpenAI or Groq) to generate relevant responses. These third-party AI providers do not use your data for training their models without your explicit consent.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold text-white mb-4">4. Data Collection</h2>
                        <p>We collect the following types of information:</p>
                        <ul className="list-disc pl-6 space-y-2 mt-4">
                            <li><strong>Account Information:</strong> Your email address and authentication tokens required to link your Instagram account.</li>
                            <li><strong>Communication Data:</strong> Logs of incoming messages and outgoing AI-generated replies for the purpose of maintaining conversation history and improving service quality.</li>
                        </ul>
                    </section>

                    <section id="deletion" className="p-8 bg-card rounded-2xl border border-white/5 mt-12">
                        <h2 className="text-2xl font-semibold text-white mb-4">5. Data Deletion Instructions</h2>
                        <p className="mb-4">
                            You have the right to request the complete deletion of your personal data stored on our servers at any time.
                            To exercise this right:
                        </p>
                        <ol className="list-decimal pl-6 space-y-3">
                            <li>Send an email to <strong className="text-primary">support@ghostagent.com</strong> with the subject line "Data Deletion Request".</li>
                            <li>Include your registered email address and your connected Instagram handle.</li>
                            <li>We will process your request within 30 days and permanently delete your account, authentication tokens, and all associated chat logs from our database.</li>
                        </ol>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold text-white mb-4">6. Contact Us</h2>
                        <p>
                            If you have questions about this Privacy Policy, please contact us at support@ghostagent.com.
                        </p>
                    </section>
                </div>
            </div>
            <Footer />
        </main>
    );
}
