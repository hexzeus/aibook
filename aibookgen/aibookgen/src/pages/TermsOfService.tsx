import { Link } from 'react-router-dom';
import { ArrowLeft, FileText } from 'lucide-react';

export default function TermsOfService() {
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
            <FileText className="w-8 h-8 text-brand-400" />
            <h1 className="text-4xl font-display font-bold">Terms of Service</h1>
          </div>

          <div className="prose prose-invert max-w-none space-y-6 text-gray-300">
            <p className="text-sm text-gray-500">Last Updated: {new Date().toLocaleDateString()}</p>

            <section>
              <h2 className="text-2xl font-bold text-white mb-3">1. Acceptance of Terms</h2>
              <p>
                By accessing and using AI Book Generator ("the Service"), you accept and agree to be bound by the terms
                and provision of this agreement.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-3">2. Use License</h2>
              <p>
                Permission is granted to temporarily use the Service for personal, non-commercial transitory viewing only.
                This is the grant of a license, not a transfer of title, and under this license you may not:
              </p>
              <ul className="list-disc list-inside ml-4 space-y-2">
                <li>Modify or copy the materials</li>
                <li>Use the materials for any commercial purpose or public display</li>
                <li>Attempt to reverse engineer any software contained in the Service</li>
                <li>Remove any copyright or proprietary notations from the materials</li>
                <li>Transfer the materials to another person or "mirror" the materials on any other server</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-3">3. Credits and Payments</h2>
              <p>
                Credits are used to generate AI content. Credit purchases are final and non-refundable. Credits do not
                expire unless your account is inactive for more than 365 days.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-3">4. Content Ownership</h2>
              <p>
                You retain all rights to the content generated through our Service. We do not claim ownership of your
                generated books or content.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-3">5. Prohibited Uses</h2>
              <p>You may not use the Service to:</p>
              <ul className="list-disc list-inside ml-4 space-y-2">
                <li>Generate illegal, harmful, or offensive content</li>
                <li>Violate any applicable laws or regulations</li>
                <li>Infringe on intellectual property rights</li>
                <li>Harass, abuse, or harm another person</li>
                <li>Spam or engage in fraudulent activity</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-3">6. Account Termination</h2>
              <p>
                We reserve the right to terminate or suspend access to the Service immediately, without prior notice or
                liability, for any reason whatsoever, including breach of Terms.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-3">7. Disclaimer</h2>
              <p>
                The Service is provided on an "as is" and "as available" basis. We make no warranties, expressed or
                implied, and hereby disclaim all other warranties including implied warranties of merchantability,
                fitness for a particular purpose, or non-infringement.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-3">8. Limitations of Liability</h2>
              <p>
                In no event shall AI Book Generator or its suppliers be liable for any damages arising out of the use
                or inability to use the Service.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-3">9. Changes to Terms</h2>
              <p>
                We reserve the right to modify these terms at any time. Continued use of the Service after changes
                constitutes acceptance of the new terms.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-white mb-3">10. Contact</h2>
              <p>
                If you have any questions about these Terms, please contact us through our support channels.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
