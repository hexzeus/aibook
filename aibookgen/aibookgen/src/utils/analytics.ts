/**
 * Simple analytics utility for tracking user events
 * Can be easily integrated with Google Analytics, Mixpanel, or other services
 */

interface AnalyticsEvent {
  category: string;
  action: string;
  label?: string;
  value?: number;
}

/**
 * Track an analytics event
 */
export function trackEvent({ category, action, label, value }: AnalyticsEvent): void {
  // Log to console in development
  if (import.meta.env.DEV) {
    console.log('[Analytics]', { category, action, label, value });
  }

  // Google Analytics 4
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('event', action, {
      event_category: category,
      event_label: label,
      value: value,
    });
  }

  // Mixpanel
  if (typeof window !== 'undefined' && (window as any).mixpanel) {
    (window as any).mixpanel.track(`${category}: ${action}`, {
      label,
      value,
    });
  }

  // Custom analytics endpoint (optional)
  // fetch('/api/analytics/event', {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({ category, action, label, value }),
  // }).catch(console.error);
}

/**
 * Track page view
 */
export function trackPageView(path: string, title?: string): void {
  if (import.meta.env.DEV) {
    console.log('[Analytics] Page View:', path, title);
  }

  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('config', 'GA_MEASUREMENT_ID', {
      page_path: path,
      page_title: title,
    });
  }

  if (typeof window !== 'undefined' && (window as any).mixpanel) {
    (window as any).mixpanel.track_pageview({ page: path, title });
  }
}

// Pre-defined event trackers for common actions
export const analytics = {
  // Book events
  bookCreated: (bookType: string) =>
    trackEvent({ category: 'Book', action: 'Created', label: bookType }),

  bookCompleted: (bookId: string) =>
    trackEvent({ category: 'Book', action: 'Completed', label: bookId }),

  bookExported: (format: string) =>
    trackEvent({ category: 'Book', action: 'Exported', label: format }),

  bookShared: (platform: string) =>
    trackEvent({ category: 'Book', action: 'Shared', label: platform }),

  bookPrinted: () =>
    trackEvent({ category: 'Book', action: 'Printed' }),

  bookDeleted: () =>
    trackEvent({ category: 'Book', action: 'Deleted' }),

  // Page events
  pageGenerated: (pageNumber: number) =>
    trackEvent({ category: 'Page', action: 'Generated', value: pageNumber }),

  pageEdited: () =>
    trackEvent({ category: 'Page', action: 'Edited' }),

  pageDuplicated: () =>
    trackEvent({ category: 'Page', action: 'Duplicated' }),

  // Credit events
  creditsPurchased: (amount: number) =>
    trackEvent({ category: 'Credits', action: 'Purchased', value: amount }),

  // Premium features
  premiumIllustration: () =>
    trackEvent({ category: 'Premium', action: 'Illustration Generated' }),

  premiumStyleApplied: () =>
    trackEvent({ category: 'Premium', action: 'Style Applied' }),

  premiumBulkExport: (formatCount: number) =>
    trackEvent({ category: 'Premium', action: 'Bulk Export', value: formatCount }),

  // User engagement
  affiliateSignup: () =>
    trackEvent({ category: 'Engagement', action: 'Affiliate Signup' }),

  subscriptionActivated: (plan: string) =>
    trackEvent({ category: 'Subscription', action: 'Activated', label: plan }),

  // Errors
  error: (errorType: string, errorMessage: string) =>
    trackEvent({ category: 'Error', action: errorType, label: errorMessage }),
};
