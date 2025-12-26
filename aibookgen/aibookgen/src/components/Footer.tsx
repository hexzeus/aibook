import { Link } from 'react-router-dom';
import { Heart } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="border-t border-white/10 glass-morphism mt-auto">
      <div className="page-container py-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <span>Made with</span>
            <Heart className="w-4 h-4 text-red-400 fill-red-400" />
            <span>by AI Book Generator</span>
          </div>

          <div className="flex items-center gap-6 text-sm">
            <Link
              to="/terms"
              className="text-gray-400 hover:text-white transition-colors"
            >
              Terms of Service
            </Link>
            <Link
              to="/privacy"
              className="text-gray-400 hover:text-white transition-colors"
            >
              Privacy Policy
            </Link>
            <Link
              to="/faq"
              className="text-gray-400 hover:text-white transition-colors"
            >
              FAQ
            </Link>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-white transition-colors"
            >
              Support
            </a>
          </div>

          <div className="text-sm text-gray-500">
            © {new Date().getFullYear()} AI Book Generator. All rights reserved.
          </div>
        </div>
      </div>
    </footer>
  );
}
