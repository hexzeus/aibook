import { useToastStore } from '../store/toastStore';

/**
 * Copy text to clipboard with fallback for older browsers
 */
export async function copyToClipboard(text: string, successMessage?: string): Promise<boolean> {
  const toast = useToastStore.getState();

  try {
    // Modern clipboard API (preferred)
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      toast.success(successMessage || 'Copied to clipboard!');
      return true;
    }

    // Fallback for older browsers or non-HTTPS contexts
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);

    if (successful) {
      toast.success(successMessage || 'Copied to clipboard!');
      return true;
    } else {
      throw new Error('Copy command failed');
    }
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    toast.error('Failed to copy to clipboard');
    return false;
  }
}

/**
 * Share content using Web Share API with fallback to clipboard
 */
export async function shareContent(data: { title?: string; text?: string; url?: string }): Promise<boolean> {
  const toast = useToastStore.getState();

  try {
    // Try Web Share API first (mobile-friendly)
    if (navigator.share) {
      await navigator.share(data);
      return true;
    }

    // Fallback: copy URL to clipboard
    const shareText = data.url || data.text || data.title || '';
    if (shareText) {
      return await copyToClipboard(shareText, 'Link copied! Share it with others.');
    }

    toast.error('Sharing not supported on this device');
    return false;
  } catch (error) {
    // User cancelled the share or error occurred
    if ((error as Error).name !== 'AbortError') {
      console.error('Failed to share:', error);
      toast.error('Failed to share content');
    }
    return false;
  }
}

/**
 * Copy formatted book content to clipboard
 */
export async function copyBookContent(title: string, content: string): Promise<boolean> {
  const formattedContent = `${title}\n${'='.repeat(title.length)}\n\n${content}`;
  return await copyToClipboard(formattedContent, 'Book content copied!');
}
