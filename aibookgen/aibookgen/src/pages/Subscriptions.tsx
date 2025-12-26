import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, Crown, Zap, TrendingUp } from 'lucide-react';
import Layout from '../components/Layout';
import { subscriptionApi } from '../lib/api';
import { useToastStore } from '../store/toastStore';

export default function Subscriptions() {
  const queryClient = useQueryClient();
  const toast = useToastStore();

  const { data: plansData } = useQuery({
    queryKey: ['subscription-plans'],
    queryFn: subscriptionApi.getPlans,
  });

  const { data: statusData } = useQuery({
    queryKey: ['subscription-status'],
    queryFn: subscriptionApi.getStatus,
  });

  const activateMutation = useMutation({
    mutationFn: ({ planId, billingCycle }: { planId: string; billingCycle: string }) =>
      subscriptionApi.activate(planId, billingCycle),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription-status'] });
      queryClient.invalidateQueries({ queryKey: ['credits'] });
      toast.success('Subscription activated successfully!');
    },
  });

  const cancelMutation = useMutation({
    mutationFn: subscriptionApi.cancel,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription-status'] });
      toast.success('Subscription cancelled successfully');
    },
  });

  const plans = plansData?.plans || [];
  const currentStatus = statusData?.subscription;

  return (
    <Layout>
      <div className="page-container max-w-6xl">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-display font-bold mb-2 flex items-center justify-center gap-3">
            <Crown className="w-10 h-10 text-brand-400" />
            <span>Subscription Plans</span>
          </h1>
          <p className="text-gray-400 text-lg">
            Get unlimited credits with a monthly subscription
          </p>
        </div>

        {currentStatus && (
          <div className="card bg-gradient-to-r from-brand-500/10 to-accent-purple/10 border-brand-500/20 mb-8">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h3 className="text-xl font-bold mb-1">Current Subscription</h3>
                <p className="text-gray-400">
                  {currentStatus.plan_name} - {currentStatus.status === 'active' ? 'Active' : 'Cancelled'}
                </p>
                {currentStatus.next_billing_date && (
                  <p className="text-sm text-gray-500 mt-1">
                    Next billing: {new Date(currentStatus.next_billing_date).toLocaleDateString()}
                  </p>
                )}
              </div>
              {currentStatus.status === 'active' && (
                <button
                  onClick={() => cancelMutation.mutate()}
                  disabled={cancelMutation.isPending}
                  className="btn-secondary text-red-400 hover:bg-red-500/20"
                >
                  {cancelMutation.isPending ? 'Cancelling...' : 'Cancel Subscription'}
                </button>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`card relative ${
                plan.is_popular
                  ? 'border-2 border-brand-500 shadow-glow transform scale-105'
                  : ''
              }`}
            >
              {plan.is_popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-accent-orange to-accent-pink text-white text-sm font-bold px-6 py-1 rounded-full">
                  Most Popular
                </div>
              )}

              <div className="text-center mb-6">
                <h3 className="text-2xl font-display font-bold mb-2">{plan.name}</h3>
                <div className="mb-4">
                  <div className="text-4xl font-bold gradient-text">
                    {plan.price_monthly}
                  </div>
                  <div className="text-gray-400 text-sm">per month</div>
                  <div className="text-brand-400 text-sm mt-2">
                    or {plan.price_yearly} billed yearly
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="w-5 h-5 text-brand-400" />
                  <span className="font-semibold">
                    {plan.credits_per_month.toLocaleString()} credits/month
                  </span>
                </div>
              </div>

              <ul className="space-y-3 mb-6">
                {plan.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm">
                    <Check className="w-4 h-4 text-accent-green flex-shrink-0 mt-0.5" />
                    <span className="text-gray-300">{feature}</span>
                  </li>
                ))}
              </ul>

              <div className="space-y-2">
                <button
                  onClick={() =>
                    activateMutation.mutate({ planId: plan.id, billingCycle: 'monthly' })
                  }
                  disabled={activateMutation.isPending || currentStatus?.plan_id === plan.id}
                  className={`w-full ${
                    plan.is_popular ? 'btn-primary' : 'btn-secondary'
                  } py-3`}
                >
                  {currentStatus?.plan_id === plan.id
                    ? 'Current Plan'
                    : activateMutation.isPending
                    ? 'Processing...'
                    : 'Subscribe Monthly'}
                </button>
                <button
                  onClick={() =>
                    activateMutation.mutate({ planId: plan.id, billingCycle: 'yearly' })
                  }
                  disabled={activateMutation.isPending || currentStatus?.plan_id === plan.id}
                  className="w-full btn-secondary py-2 text-sm"
                >
                  Subscribe Yearly (Save 20%)
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="card bg-gradient-to-r from-brand-500/5 to-accent-purple/5">
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-brand-400" />
            Why Subscribe?
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
            <div>
              <h4 className="font-semibold mb-2">Never Run Out of Credits</h4>
              <p className="text-gray-400">
                Get a fresh batch of credits every month automatically
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Better Value</h4>
              <p className="text-gray-400">
                Save up to 50% compared to one-time credit purchases
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Priority Support</h4>
              <p className="text-gray-400">
                Get faster responses and dedicated assistance
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Cancel Anytime</h4>
              <p className="text-gray-400">
                No long-term commitment, cancel whenever you want
              </p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
