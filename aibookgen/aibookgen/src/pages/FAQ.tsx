import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ChevronDown, HelpCircle, BookOpen, CreditCard, Zap, Download } from 'lucide-react';
import Layout from '../components/Layout';

interface FAQItem {
  question: string;
  answer: string;
  category: string;
}

const faqs: FAQItem[] = [
  {
    category: 'Getting Started',
    question: 'How do I create my first book?',
    answer: 'Click the "New Book" button on your dashboard, enter a description of what you want to write about, choose the number of pages, and our AI will generate a complete book outline and start writing!',
  },
  {
    category: 'Getting Started',
    question: 'What types of books can I create?',
    answer: 'You can create any type of book including fiction novels, non-fiction guides, children\'s books, cookbooks, travel guides, self-help books, and more. Just describe what you want in the book description.',
  },
  {
    category: 'Credits & Billing',
    question: 'How do credits work?',
    answer: 'Each page generation costs 1 credit. Completing a book (generating the cover) costs 3 credits. Exporting a book costs 1 credit. You can purchase credit packages or subscribe for monthly credits.',
  },
  {
    category: 'Credits & Billing',
    question: 'Do credits expire?',
    answer: 'No, credits never expire as long as your account is active. You can use them whenever you\'re ready to create.',
  },
  {
    category: 'Book Generation',
    question: 'How long does it take to generate a book?',
    answer: 'Each page takes approximately 20-40 seconds to generate. A 10-page book would take about 3-7 minutes total if you generate all pages at once.',
  },
  {
    category: 'Book Generation',
    question: 'Can I edit the generated content?',
    answer: 'Yes! You can edit any page content directly in the editor. Click the "Edit" button on any page to make changes. You can also edit the book title, subtitle, and description.',
  },
  {
    category: 'Book Generation',
    question: 'Can I guide the AI while generating pages?',
    answer: 'Absolutely! When generating a new page, you can provide optional guidance to steer the content in a specific direction. This helps you maintain creative control.',
  },
  {
    category: 'Exporting',
    question: 'What export formats are available?',
    answer: 'You can export your completed books in EPUB, PDF, and DOCX formats. EPUB is ideal for e-readers, PDF for universal compatibility, and DOCX for further editing.',
  },
  {
    category: 'Exporting',
    question: 'Can I download my book multiple times?',
    answer: 'Yes, once a book is completed, you can download it as many times as you want in any format without using additional credits.',
  },
  {
    category: 'Account',
    question: 'Can I delete pages or books?',
    answer: 'Yes, you can delete individual pages (except the title page) or entire books. This helps you refine your content and manage your library.',
  },
  {
    category: 'Account',
    question: 'Is my content private?',
    answer: 'Yes, all your generated books are completely private and belong to you. We don\'t share or use your content for any purpose other than serving it back to you.',
  },
  {
    category: 'Technical',
    question: 'Which AI model is used?',
    answer: 'You can choose between Claude (Anthropic) for creative fiction and complex narratives, or GPT-4 (OpenAI) for versatile content and non-fiction. Select your preference in Settings.',
  },
];

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const categories = ['All', ...Array.from(new Set(faqs.map(f => f.category)))];
  const filteredFaqs = selectedCategory === 'All'
    ? faqs
    : faqs.filter(f => f.category === selectedCategory);

  const categoryIcons: Record<string, any> = {
    'Getting Started': BookOpen,
    'Credits & Billing': CreditCard,
    'Book Generation': Zap,
    'Exporting': Download,
    'Account': HelpCircle,
    'Technical': HelpCircle,
  };

  return (
    <Layout>
      <div className="page-container max-w-4xl">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>

        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <HelpCircle className="w-8 h-8 text-brand-400" />
            <h1 className="text-4xl font-display font-bold">Frequently Asked Questions</h1>
          </div>
          <p className="text-gray-400 text-lg">
            Find answers to common questions about AI Book Generator
          </p>
        </div>

        <div className="mb-6 flex flex-wrap gap-2">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-4 py-2 rounded-xl font-medium transition-all ${
                selectedCategory === category
                  ? 'bg-brand-500 text-white'
                  : 'glass-morphism hover:bg-white/10 text-gray-400'
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {filteredFaqs.map((faq, index) => {
            const isOpen = openIndex === index;
            const Icon = categoryIcons[faq.category] || HelpCircle;

            return (
              <div
                key={index}
                className="card hover:bg-white/10 transition-all cursor-pointer"
                onClick={() => setOpenIndex(isOpen ? null : index)}
              >
                <div className="flex items-start gap-4">
                  <div className="p-2 bg-brand-500/20 rounded-lg flex-shrink-0">
                    <Icon className="w-5 h-5 text-brand-400" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-4">
                      <h3 className="font-semibold text-lg">{faq.question}</h3>
                      <ChevronDown
                        className={`w-5 h-5 text-gray-400 flex-shrink-0 transition-transform ${
                          isOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </div>
                    <div className="text-xs text-brand-400 mt-1 mb-2">{faq.category}</div>
                    {isOpen && (
                      <p className="text-gray-300 mt-3 leading-relaxed animate-fade-in">
                        {faq.answer}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-12 card bg-gradient-to-r from-brand-500/10 to-accent-purple/10 border-brand-500/20">
          <h3 className="text-xl font-bold mb-3">Still have questions?</h3>
          <p className="text-gray-400 mb-4">
            Can't find what you're looking for? We're here to help!
          </p>
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary inline-flex items-center gap-2"
          >
            <HelpCircle className="w-5 h-5" />
            Contact Support
          </a>
        </div>
      </div>
    </Layout>
  );
}
