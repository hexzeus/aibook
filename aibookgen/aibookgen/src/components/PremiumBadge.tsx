import { Crown, Sparkles, Zap } from 'lucide-react';

interface PremiumBadgeProps {
  type?: 'pro' | 'premium' | 'new';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function PremiumBadge({ type = 'premium', size = 'md', className = '' }: PremiumBadgeProps) {
  const badges = {
    pro: {
      icon: Crown,
      label: 'PRO',
      gradient: 'from-yellow-500 to-orange-500',
      bg: 'bg-yellow-500/10',
      border: 'border-yellow-500/30',
      text: 'text-yellow-400',
    },
    premium: {
      icon: Sparkles,
      label: 'PREMIUM',
      gradient: 'from-brand-500 to-accent-purple',
      bg: 'bg-brand-500/10',
      border: 'border-brand-500/30',
      text: 'text-brand-400',
    },
    new: {
      icon: Zap,
      label: 'NEW',
      gradient: 'from-accent-green to-accent-pink',
      bg: 'bg-accent-green/10',
      border: 'border-accent-green/30',
      text: 'text-accent-green',
    },
  };

  const badge = badges[type];
  const Icon = badge.icon;

  const sizes = {
    sm: 'text-[10px] px-1.5 py-0.5',
    md: 'text-xs px-2 py-1',
    lg: 'text-sm px-3 py-1.5',
  };

  const iconSizes = {
    sm: 'w-2.5 h-2.5',
    md: 'w-3 h-3',
    lg: 'w-4 h-4',
  };

  return (
    <span
      className={`inline-flex items-center gap-1 ${badge.bg} ${badge.border} border ${sizes[size]} rounded-full font-bold ${badge.text} ${className} animate-pulse`}
    >
      <Icon className={iconSizes[size]} />
      <span>{badge.label}</span>
    </span>
  );
}
