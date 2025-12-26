import { Link } from 'react-router-dom';
import { ArrowLeft, Shield } from 'lucide-react';

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>

        <div className="card">
          <div className="flex items-center gap-3 mb-6">
            <Shield className="w-8 h-8 text-brand-400" />
            <h1 className="text-4xl font-display font-bold">Privacy Policy</h1>
          </div>

          <div className="prose prose-invert max-w-none space-y-6 text-gray-300">
            <p className="text-sm text-gray-500">Last Updated: {new Date().toLocaleDateString()}</p>

            <section>
              <h2 className="text-2xl font-bold text-white mb-3">1. Information We Collect</h2>
              <p>We collect information that you provide directly to us, including:</p>
              <ul className="list-disc list-inside ml-4 space-y-2">
                <li>Email address</li>
                <li>License key from Gumroad purchase</li>
                <li>Generated book content and metadata</li>
                <li>Usage statistics and analytics</li>
                <li>Payment information (processed securely through Gumroad/Stripe)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-3">2. How We Use Your Information</h2>
              <p>We use the information we collect to:</p>
              <ul className="list-disc list-inside ml-4 space-y-2">
                <li>Provide, maintain, and improve our Service</li>
                <li>Process your transactions and send related information</li>
                <li>Send you technical notices and support messages</li>
                <li>Respond to your comments and questions</li>
                <li>Monitor and analyze trends, usage, and activities</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-3">3. Data Storage and Security</h2>
              <p>
                We store your data securely using industry-standard encryption. Your generated books and personal
                information are stored in secure databases with restricted access.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-3">4. Data Sharing</h2>
              <p>
                We do not sell your personal information. We may share your information only in the following circumstances:
              </p>
              <ul className="list-disc list-inside ml-4 space-y-2">
                <li>With your consent</li>
                <li>To comply with legal obligations</li>
                <li>To protect our rights and prevent fraud</li>
                <li>With service providers who assist in our operations (under strict confidentiality)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-3">5. AI-Generated Content</h2>
              <p>
                Your generated content is processed through AI models (Claude and GPT-4). While we strive to maintain
                privacy, please be aware that:
              </p>
              <ul className="list-disc list-inside ml-4 space-y-2">
                <li>AI providers may process your prompts to generate content</li>
                <li>We do not use your content to train AI models</li>
                <li>Generated content is stored securely in your account</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-3">6. Cookies and Tracking</h2>
              <p>
                We use local storage and session management to keep you logged in and personalize your experience.
                We do not use third-party tracking cookies for advertising.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-3">7. Your Rights</h2>
              <p>You have the right to:</p>
              <ul className="list-disc list-inside ml-4 space-y-2">
                <li>Access your personal data</li>
                <li>Correct inaccurate data</li>
                <li>Request deletion of your data</li>
                <li>Export your data</li>
                <li>Opt-out of marketing communications</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-3">8. Data Retention</h2>
              <p>
                We retain your information for as long as your account is active or as needed to provide services.
                Inactive accounts (no login for 365+ days) may be archived or deleted.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-3">9. Children's Privacy</h2>
              <p>
                Our Service is not intended for children under 13. We do not knowingly collect information from
                children under 13.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-3">10. Changes to Privacy Policy</h2>
              <p>
                We may update this Privacy Policy from time to time. We will notify you of any changes by posting the
                new Privacy Policy on this page.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-3">11. Contact Us</h2>
              <p>
                If you have questions about this Privacy Policy, please contact us through our support channels.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
