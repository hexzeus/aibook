import axios, { AxiosError } from 'axios';
import { useToastStore } from '../store/toastStore';
import { useRateLimitStore } from '../store/rateLimitStore';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://aibook-9rbb.onrender.com';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('license_key');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ detail?: string; error?: string; message?: string; retry_after?: number }>) => {
    const toast = useToastStore.getState();
    const rateLimitStore = useRateLimitStore.getState();

    if (error.response?.status === 401) {
      localStorage.removeItem('license_key');
      toast.error('Session expired. Please log in again.');
      window.location.href = '/auth';
    } else if (error.response?.status === 402) {
      toast.error('Insufficient credits. Please purchase more credits to continue.');
    } else if (error.response?.status === 429) {
      const retryAfter = error.response.data?.retry_after || 60; // Default to 60 seconds
      const resetTime = new Date(Date.now() + retryAfter * 1000);
      rateLimitStore.setRateLimited(resetTime);
      toast.error('Too many requests. Please wait before trying again.');
    } else if (error.response?.status === 500) {
      const message = error.response.data?.detail || error.response.data?.error || 'Server error. Please try again.';
      toast.error(message);
    } else if (error.response?.data) {
      const message = error.response.data.detail || error.response.data.error || error.response.data.message || 'An error occurred';
      toast.error(message);
    } else if (error.code === 'ERR_NETWORK') {
      toast.error('Network error. Please check your internet connection.');
    } else {
      toast.error('An unexpected error occurred. Please try again.');
    }

    return Promise.reject(error);
  }
);

export interface Book {
  book_id: string;
  title: string;
  subtitle?: string;
  description: string;
  book_type: string;
  target_pages: number;
  page_count: number;
  pages_generated: number;
  completion_percentage: number;
  status: string;
  is_completed: boolean;
  cover_svg?: string;
  epub_page_count?: number;  // Actual EPUB page count (estimated)
  created_at: string;
  updated_at: string;
  completed_at?: string;
  structure?: {
    title: string;
    subtitle?: string;
    sections: Array<{ title: string; pages: number }>;
    themes?: string[];
    tone?: string;
  };
  style_profile?: any;  // Style profile configuration
  pages?: Page[];
}

export interface Page {
  page_id: string;
  page_number: number;
  section: string;
  content: string;
  is_title_page: boolean;
  word_count?: number;
  created_at: string;
  notes?: string;
  illustration_url?: string;
}

export interface Credits {
  total: number;
  used: number;
  remaining: number;
}

export interface UserStats {
  credits: Credits;
  usage: {
    books_created: number;
    pages_generated: number;
    exports: number;
  };
  preferred_model: string;
}

export interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  price: string;
  price_cents: number;
  savings_percent: number;
  badge?: string;
  is_featured: boolean;
  purchase_url: string;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  price_monthly: string;
  price_yearly: string;
  price_monthly_cents: number;
  price_yearly_cents: number;
  credits_per_month: number;
  features: string[];
  is_popular: boolean;
}

export interface AffiliateStats {
  success: boolean;
  affiliate_code: string;
  total_referrals: number;
  total_earnings_cents: number;
  pending_payout_cents: number;
  paid_out_cents: number;
  payout_email?: string;
  recent_referrals: Array<{
    email: string;
    created_at: string;
    credits_granted: number;
  }>;
}

export const authApi = {
  validateLicense: async (licenseKey: string) => {
    const response = await api.get('/api/credits', {
      headers: { Authorization: `Bearer ${licenseKey}` }
    });
    return response.data;
  },
};

export const creditsApi = {
  getCredits: async (): Promise<UserStats> => {
    const response = await api.get('/api/credits');
    return response.data;
  },

  getPackages: async (): Promise<{ success: boolean; packages: CreditPackage[] }> => {
    const response = await api.get('/api/credit-packages');
    return response.data;
  },

  initiatePurchase: async (packageId: string) => {
    const response = await api.post('/api/credits/purchase', { package_id: packageId });
    return response.data;
  },
};

export const booksApi = {
  createBook: async (data: { description: string; target_pages: number; book_type: string; target_language?: string }) => {
    const response = await api.post('/api/books', data);
    return response.data;
  },

  getBooks: async (limit = 50, offset = 0): Promise<{ success: boolean; books: Book[]; total: number }> => {
    const response = await api.get('/api/books', { params: { limit, offset } });
    return response.data;
  },

  getInProgressBooks: async (): Promise<{ success: boolean; books: Book[] }> => {
    const response = await api.get('/api/books/in-progress');
    return response.data;
  },

  getCompletedBooks: async (): Promise<{ success: boolean; books: Book[] }> => {
    const response = await api.get('/api/books/completed');
    return response.data;
  },

  getBook: async (bookId: string): Promise<{ success: boolean; book: Book }> => {
    const response = await api.get(`/api/books/${bookId}`);
    return response.data;
  },

  generatePage: async (data: { book_id: string; page_number: number; user_input?: string }) => {
    const response = await api.post('/api/books/generate-page', data);
    return response.data;
  },

  updatePage: async (data: { book_id: string; page_number: number; content: string }) => {
    const response = await api.put('/api/books/update-page', data);
    return response.data;
  },

  updateBook: async (bookId: string, data: { title?: string; subtitle?: string; description?: string }) => {
    const response = await api.put(`/api/books/${bookId}`, { book_id: bookId, ...data });
    return response.data;
  },

  deletePage: async (bookId: string, pageId: string) => {
    const response = await api.delete('/api/books/page', { data: { book_id: bookId, page_id: pageId } });
    return response.data;
  },

  completeBook: async (bookId: string) => {
    const response = await api.post('/api/books/complete', { book_id: bookId });
    return response.data;
  },

  exportBook: async (bookId: string, format: 'epub' | 'pdf' | 'docx' = 'epub'): Promise<Blob> => {
    const response = await api.post('/api/books/export', {
      book_id: bookId,
      format: format
    }, {
      responseType: 'blob',
    });
    return response.data;
  },

  deleteBook: async (bookId: string) => {
    const response = await api.delete(`/api/books/${bookId}`);
    return response.data;
  },

  archiveBook: async (bookId: string) => {
    const response = await api.post(`/api/books/${bookId}/archive`);
    return response.data;
  },

  restoreBook: async (bookId: string) => {
    const response = await api.post(`/api/books/${bookId}/restore`);
    return response.data;
  },

  getArchivedBooks: async (): Promise<{ success: boolean; books: Book[] }> => {
    const response = await api.get('/api/books/archived');
    return response.data;
  },

  duplicateBook: async (bookId: string) => {
    const response = await api.post(`/api/books/${bookId}/duplicate`);
    return response.data;
  },

  validateEPUB: async (bookId: string) => {
    const response = await api.post('/api/books/validate-epub', { book_id: bookId });
    return response.data;
  },

  checkReadiness: async (bookId: string, validateEpub: boolean = false) => {
    const response = await api.post('/api/books/check-readiness', {
      book_id: bookId,
      validate_epub: validateEpub
    });
    return response.data;
  },

  reorderPages: async (bookId: string, pageOrder: string[]) => {
    const response = await api.post(`/api/books/${bookId}/reorder-pages`, { page_order: pageOrder });
    return response.data;
  },

  duplicatePage: async (bookId: string, pageId: string) => {
    const response = await api.post(`/api/books/${bookId}/pages/${pageId}/duplicate`);
    return response.data;
  },

  updatePageNotes: async (bookId: string, pageId: string, notes: string) => {
    const response = await api.put(`/api/books/${bookId}/pages/${pageId}/notes`, { notes });
    return response.data;
  },

  regenerateCover: async (bookId: string) => {
    const response = await api.post(`/api/books/${bookId}/regenerate-cover`);
    return response.data;
  },

  autoGenerateBook: async (bookId: string, withIllustrations: boolean = false) => {
    const response = await api.post('/api/books/auto-generate', {
      book_id: bookId,
      with_illustrations: withIllustrations,
    });
    return response.data;
  },
};

export const subscriptionApi = {
  getPlans: async (): Promise<{ success: boolean; plans: SubscriptionPlan[] }> => {
    const response = await api.get('/api/subscriptions/plans');
    return response.data;
  },

  getStatus: async () => {
    const response = await api.get('/api/subscriptions/status');
    return response.data;
  },

  activate: async (planId: string, billingCycle: string) => {
    const response = await api.post('/api/subscriptions/activate', { plan_id: planId, billing_cycle: billingCycle });
    return response.data;
  },

  cancel: async () => {
    const response = await api.post('/api/subscriptions/cancel');
    return response.data;
  },
};

export const affiliateApi = {
  getStats: async (): Promise<AffiliateStats> => {
    const response = await api.get('/api/affiliate/stats');
    return response.data;
  },

  generateCode: async () => {
    const response = await api.post('/api/affiliate/generate-code');
    return response.data;
  },

  updatePayoutEmail: async (email: string) => {
    const response = await api.post('/api/affiliate/update-payout-email', { email });
    return response.data;
  },

  requestPayout: async (paypalEmail: string) => {
    const response = await api.post('/api/affiliate/request-payout', { paypal_email: paypalEmail });
    return response.data;
  },
};

export const userApi = {
  updateEmail: async (email: string) => {
    const response = await api.post('/api/users/update-email', { email });
    return response.data;
  },

  updatePreferredModel: async (modelProvider: 'claude' | 'openai') => {
    const response = await api.post('/api/users/update-preferred-model', { model_provider: modelProvider });
    return response.data;
  },

  getNotificationPreferences: async () => {
    const response = await api.get('/api/users/notification-preferences');
    return response.data.preferences;
  },

  updateNotificationPreferences: async (preferences: Record<string, boolean>) => {
    const response = await api.post('/api/users/notification-preferences', { preferences });
    return response.data;
  },
};

export const premiumApi = {
  generateIllustration: async (bookId: string, pageNumber: number, prompt: string) => {
    const response = await api.post('/api/premium/generate-illustration', {
      book_id: bookId,
      page_number: pageNumber,
      prompt: prompt,
    });
    return response.data;
  },

  deleteIllustration: async (bookId: string, pageNumber: number) => {
    const response = await api.delete('/api/premium/delete-illustration', {
      data: {
        book_id: bookId,
        page_number: pageNumber,
      }
    });
    return response.data;
  },

  applyStyle: async (bookId: string, stylePrompt: string, targetPages?: number[]) => {
    const response = await api.post('/api/premium/apply-style', {
      book_id: bookId,
      style_prompt: stylePrompt,
      target_pages: targetPages,
    });
    return response.data;
  },

  bulkExport: async (bookId: string, formats: string[]) => {
    const response = await api.post('/api/premium/bulk-export', {
      book_id: bookId,
      formats: formats,
    }, {
      responseType: 'blob',
    });
    return response.data;
  },
};

export interface BookExportRecord {
  export_id: string;
  book_id: string;
  book_title: string;
  format: string;
  file_size_bytes?: number;
  download_count: number;
  export_status: string;
  created_at: string;
  last_downloaded_at?: string;
}

export const exportsApi = {
  getHistory: async (limit = 50, offset = 0): Promise<{ success: boolean; exports: BookExportRecord[]; total: number }> => {
    const response = await api.get('/api/exports/history', { params: { limit, offset } });
    return response.data;
  },

  deleteExport: async (exportId: string) => {
    const response = await api.delete(`/api/exports/${exportId}`);
    return response.data;
  },

  deleteAllExports: async () => {
    const response = await api.delete('/api/exports');
    return response.data;
  },
};

export const translationApi = {
  getSupportedLanguages: async (): Promise<{ languages: Record<string, string> }> => {
    const response = await api.get('/api/translation/languages');
    return response.data;
  },

  translateBook: async (bookId: string, targetLanguage: string) => {
    const response = await api.post(`/api/books/${bookId}/translate`, {
      target_language: targetLanguage
    });
    return response.data;
  },

  translatePage: async (bookId: string, pageNumber: number, targetLanguage: string) => {
    const response = await api.post(`/api/books/${bookId}/pages/${pageNumber}/translate`, {
      target_language: targetLanguage
    });
    return response.data;
  },
};

export default api;
