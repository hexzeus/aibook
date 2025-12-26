import { TrendingDown } from 'lucide-react';

interface CreditConsumptionToastProps {
  creditsUsed: number;
  creditsRemaining: number;
  action: string;
}

export function showCreditConsumption(creditsUsed: number, creditsRemaining: number, action: string) {
  const container = document.createElement('div');
  container.className = 'fixed top-20 right-4 z-[9998] animate-slide-in';
  container.innerHTML = `
    <div class="glass-morphism rounded-xl p-4 shadow-glow border-2 border-brand-500/30 max-w-sm">
      <div class="flex items-start gap-3">
        <div class="p-2 bg-brand-500/20 rounded-lg flex-shrink-0">
          <svg class="w-5 h-5 text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path>
          </svg>
        </div>
        <div class="flex-1">
          <div class="font-semibold text-white mb-1">Credits Used</div>
          <div class="text-sm text-gray-300 mb-2">${action}</div>
          <div class="flex items-center justify-between text-xs">
            <span class="text-red-400 font-medium">-${creditsUsed} ${creditsUsed === 1 ? 'credit' : 'credits'}</span>
            <span class="text-gray-400">${creditsRemaining.toLocaleString()} remaining</span>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(container);

  // Auto remove after 4 seconds
  setTimeout(() => {
    container.style.animation = 'fade-out 0.3s ease-out';
    setTimeout(() => {
      document.body.removeChild(container);
    }, 300);
  }, 4000);
}
