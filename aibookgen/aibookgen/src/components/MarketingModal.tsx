import { useState } from 'react';
import { X, Sparkles, Copy, Check, TrendingUp, Share2, Target } from 'lucide-react';

interface MarketingModalProps {
  onClose: () => void;
  bookId: string;
  bookTitle: string;
  bookDescription?: string;
}

export default function MarketingModal({
  onClose,
  bookId,
  bookTitle,
  bookDescription
}: MarketingModalProps) {
  const [activeTab, setActiveTab] = useState<'description' | 'social'>('description');
  const [generating, setGenerating] = useState(false);
  const [generatedDescription, setGeneratedDescription] = useState('');
  const [socialPosts, setSocialPosts] = useState<{ platform: string; content: string }[]>([]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleGenerateDescription = async () => {
    setGenerating(true);
    try {
      const response = await fetch('/api/marketing/description', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('license_key')}`
        },
        body: JSON.stringify({
          book_id: bookId,
          style: 'compelling'
        })
      });

      if (response.ok) {
        const data = await response.json();
        setGeneratedDescription(data.description);
      }
    } catch (error) {
      console.error('Failed to generate description:', error);
      alert('Failed to generate description');
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateSocial = async () => {
    setGenerating(true);
    try {
      const response = await fetch('/api/marketing/social', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('license_key')}`
        },
        body: JSON.stringify({
          book_id: bookId
        })
      });

      if (response.ok) {
        const data = await response.json();
        setSocialPosts(data.posts);
      }
    } catch (error) {
      console.error('Failed to generate social posts:', error);
      alert('Failed to generate social posts');
    } finally {
      setGenerating(false);
    }
  };

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto overscroll-contain">
      <div className="glass-morphism rounded-2xl max-w-4xl w-full p-4 sm:p-6 md:p-8 animate-slide-up my-auto max-h-[90vh] overflow-y-auto overscroll-contain">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-brand-500/20 rounded-xl">
              <TrendingUp className="w-6 h-6 text-brand-400" />
            </div>
            <div>
              <h2 className="text-2xl font-display font-bold">Marketing Suite</h2>
              <p className="text-sm text-gray-400 mt-1">AI-powered marketing content for your book</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-all"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 p-1 bg-white/5 rounded-lg">
          <button
            onClick={() => setActiveTab('description')}
            className={`flex-1 py-2 px-4 rounded-md transition-all ${
              activeTab === 'description'
                ? 'bg-brand-500 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Target className="w-4 h-4" />
              Book Description
            </div>
          </button>
          <button
            onClick={() => setActiveTab('social')}
            className={`flex-1 py-2 px-4 rounded-md transition-all ${
              activeTab === 'social'
                ? 'bg-brand-500 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Share2 className="w-4 h-4" />
              Social Media
            </div>
          </button>
        </div>

        {/* Book Description Tab */}
        {activeTab === 'description' && (
          <div className="space-y-6">
            <div className="glass-morphism rounded-xl p-6 bg-white/5">
              <h3 className="text-lg font-semibold mb-4">Generate Compelling Book Description</h3>
              <p className="text-sm text-gray-400 mb-4">
                Create a professional book description optimized for Amazon, Goodreads, and other platforms.
                Our AI analyzes your book content to generate hook-driven copy that sells.
              </p>

              <button
                onClick={handleGenerateDescription}
                disabled={generating}
                className="btn-primary w-full mb-4"
              >
                {generating ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Analyzing your book...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <Sparkles className="w-5 h-5" />
                    Generate Description (1 credit)
                  </span>
                )}
              </button>

              {generatedDescription && (
                <div className="relative">
                  <textarea
                    value={generatedDescription}
                    onChange={(e) => setGeneratedDescription(e.target.value)}
                    className="input-field min-h-64 resize-none font-sans"
                    placeholder="Generated description will appear here..."
                  />
                  <button
                    onClick={() => copyToClipboard(generatedDescription, -1)}
                    className="absolute top-3 right-3 p-2 hover:bg-white/10 rounded-lg transition-all"
                  >
                    {copiedIndex === -1 ? (
                      <Check className="w-5 h-5 text-green-400" />
                    ) : (
                      <Copy className="w-5 h-5 text-gray-400" />
                    )}
                  </button>
                </div>
              )}
            </div>

            <div className="glass-morphism rounded-xl p-4 bg-blue-500/5 border border-blue-500/20">
              <div className="flex items-start gap-3">
                <Target className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-gray-300">
                  <strong className="text-blue-400">Pro Tip:</strong> A great book description has 3 key elements:
                  <ul className="mt-2 space-y-1 list-disc list-inside">
                    <li>Hook - Grab attention in the first sentence</li>
                    <li>Promise - What will readers gain?</li>
                    <li>Proof - Why should they trust you?</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Social Media Tab */}
        {activeTab === 'social' && (
          <div className="space-y-6">
            <div className="glass-morphism rounded-xl p-6 bg-white/5">
              <h3 className="text-lg font-semibold mb-4">Generate Social Media Posts</h3>
              <p className="text-sm text-gray-400 mb-4">
                Create platform-optimized posts for Twitter, Facebook, Instagram, and LinkedIn.
                Each post is tailored to the platform's audience and best practices.
              </p>

              <button
                onClick={handleGenerateSocial}
                disabled={generating}
                className="btn-primary w-full mb-4"
              >
                {generating ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Creating posts...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <Share2 className="w-5 h-5" />
                    Generate Social Posts (1 credit)
                  </span>
                )}
              </button>

              {socialPosts.length > 0 && (
                <div className="space-y-4">
                  {socialPosts.map((post, index) => (
                    <div key={index} className="p-4 bg-white/5 rounded-lg border border-white/10">
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-semibold text-brand-400">{post.platform}</span>
                        <button
                          onClick={() => copyToClipboard(post.content, index)}
                          className="p-2 hover:bg-white/10 rounded-lg transition-all"
                        >
                          {copiedIndex === index ? (
                            <Check className="w-4 h-4 text-green-400" />
                          ) : (
                            <Copy className="w-4 h-4 text-gray-400" />
                          )}
                        </button>
                      </div>
                      <p className="text-sm text-gray-300 whitespace-pre-wrap">{post.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="glass-morphism rounded-xl p-4 bg-purple-500/5 border border-purple-500/20">
              <div className="flex items-start gap-3">
                <Share2 className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-gray-300">
                  <strong className="text-purple-400">Platform Tips:</strong>
                  <ul className="mt-2 space-y-1 list-disc list-inside text-xs">
                    <li><strong>Twitter:</strong> Keep it punchy, use hashtags (#amwriting #booklaunch)</li>
                    <li><strong>Facebook:</strong> Longer posts work, ask questions</li>
                    <li><strong>Instagram:</strong> Visual + emotional, use emojis</li>
                    <li><strong>LinkedIn:</strong> Professional angle, thought leadership</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
