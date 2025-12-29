import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, Copy, DollarSign, TrendingUp, Mail, CheckCircle } from 'lucide-react';
import Layout from '../components/Layout';
import SocialShareButtons from '../components/SocialShareButtons';
import { affiliateApi } from '../lib/api';
import { useToastStore } from '../store/toastStore';

export default function Affiliate() {
  const queryClient = useQueryClient();
  const toast = useToastStore();
  const [payoutEmail, setPayoutEmail] = useState('');
  const [copied, setCopied] = useState(false);

  const { data: stats } = useQuery({
    queryKey: ['affiliate-stats'],
    queryFn: affiliateApi.getStats,
  });

  const generateCodeMutation = useMutation({
    mutationFn: affiliateApi.generateCode,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['affiliate-stats'] });
      toast.success('Affiliate code generated successfully!');
    },
  });

  const updateEmailMutation = useMutation({
    mutationFn: (email: string) => affiliateApi.updatePayoutEmail(email),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['affiliate-stats'] });
      setPayoutEmail('');
      toast.success('Payout email updated successfully!');
    },
  });

  const copyReferralLink = () => {
    const link = `${window.location.origin}?ref=${stats?.affiliate_code}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    toast.success('Referral link copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const earnings = (stats?.total_earnings_cents || 0) / 100;
  const pendingPayout = (stats?.pending_payout_cents || 0) / 100;

  return (
    <Layout>
      <div className="page-container max-w-5xl">
        <div className="mb-8">
          <h1 className="text-4xl font-display font-bold mb-2">Affiliate Program</h1>
          <p className="text-gray-400 text-lg">
            Earn 30% commission on every referral
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <div className="card group hover:scale-105 transition-transform">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <div className="p-2 sm:p-3 bg-brand-500/20 rounded-xl">
                <Users className="w-5 h-5 sm:w-6 sm:h-6 text-brand-400" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-bold mb-1">
              {stats?.total_referrals || 0}
            </div>
            <div className="text-xs sm:text-sm text-gray-400">Total Referrals</div>
          </div>

          <div className="card group hover:scale-105 transition-transform">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <div className="p-2 sm:p-3 bg-accent-green/20 rounded-xl">
                <DollarSign className="w-5 h-5 sm:w-6 sm:h-6 text-accent-green" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-bold mb-1">
              ${earnings.toFixed(2)}
            </div>
            <div className="text-xs sm:text-sm text-gray-400">Total Earnings</div>
          </div>

          <div className="card group hover:scale-105 transition-transform">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <div className="p-2 sm:p-3 bg-accent-orange/20 rounded-xl">
                <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-accent-orange" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-bold mb-1">
              ${pendingPayout.toFixed(2)}
            </div>
            <div className="text-xs sm:text-sm text-gray-400">Pending Payout</div>
          </div>
        </div>

        {stats?.affiliate_code ? (
          <div className="card mb-8 bg-gradient-to-r from-brand-500/10 to-accent-purple/10 border-brand-500/20">
            <h3 className="text-xl font-bold mb-4">Your Referral Link</h3>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <input
                type="text"
                value={`${window.location.origin}?ref=${stats.affiliate_code}`}
                readOnly
                className="input-field flex-1 font-mono text-sm"
              />
              <button
                onClick={copyReferralLink}
                className="btn-primary flex items-center justify-center gap-2 whitespace-nowrap"
              >
                {copied ? (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-5 h-5" />
                    Copy Link
                  </>
                )}
              </button>
            </div>
            <div className="mt-4 pt-4 border-t border-white/10">
              <SocialShareButtons
                url={`${window.location.origin}?ref=${stats.affiliate_code}`}
                title="Check out Inkwell AI - Transform ideas into published books!"
                description="I'm using Inkwell AI to create amazing books. Join me and earn 1000 free credits with my referral link!"
              />
            </div>
            <div className="mt-3 text-sm text-gray-400">
              Share this link to earn 30% commission on every sale
            </div>
          </div>
        ) : (
          <div className="card mb-8 text-center">
            <h3 className="text-xl font-bold mb-4">Generate Your Affiliate Code</h3>
            <p className="text-gray-400 mb-6">
              Start earning by sharing Inkwell AI with others
            </p>
            <button
              onClick={() => generateCodeMutation.mutate()}
              disabled={generateCodeMutation.isPending}
              className="btn-primary"
            >
              {generateCodeMutation.isPending ? 'Generating...' : 'Generate Affiliate Code'}
            </button>
          </div>
        )}

        <div className="card mb-8">
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Mail className="w-6 h-6 text-brand-400" />
            Payout Email
          </h3>
          <p className="text-gray-400 mb-4 text-sm">
            {stats?.payout_email
              ? `Payouts will be sent to: ${stats.payout_email}`
              : 'Set your PayPal email to receive payouts'}
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              updateEmailMutation.mutate(payoutEmail);
            }}
            className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3"
          >
            <input
              type="email"
              value={payoutEmail}
              onChange={(e) => setPayoutEmail(e.target.value)}
              placeholder="PayPal email address"
              className="input-field flex-1"
              required
            />
            <button
              type="submit"
              disabled={updateEmailMutation.isPending || !payoutEmail.trim()}
              className="btn-primary whitespace-nowrap"
            >
              {updateEmailMutation.isPending ? 'Saving...' : 'Update Email'}
            </button>
          </form>
        </div>

        <div className="card">
          <h3 className="text-xl font-bold mb-4">How It Works</h3>
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-brand-500/20 flex items-center justify-center flex-shrink-0">
                <span className="font-bold text-brand-400">1</span>
              </div>
              <div>
                <div className="font-semibold mb-1">Share Your Link</div>
                <div className="text-sm text-gray-400">
                  Share your unique referral link with friends, on social media, or your blog
                </div>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-brand-500/20 flex items-center justify-center flex-shrink-0">
                <span className="font-bold text-brand-400">2</span>
              </div>
              <div>
                <div className="font-semibold mb-1">Users Sign Up</div>
                <div className="text-sm text-gray-400">
                  When someone purchases using your link, they become your referral
                </div>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-brand-500/20 flex items-center justify-center flex-shrink-0">
                <span className="font-bold text-brand-400">3</span>
              </div>
              <div>
                <div className="font-semibold mb-1">Earn Commission</div>
                <div className="text-sm text-gray-400">
                  You earn 30% commission on every purchase made through your link
                </div>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-brand-500/20 flex items-center justify-center flex-shrink-0">
                <span className="font-bold text-brand-400">4</span>
              </div>
              <div>
                <div className="font-semibold mb-1">Get Paid</div>
                <div className="text-sm text-gray-400">
                  Request payout via PayPal once you reach $50 minimum
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
