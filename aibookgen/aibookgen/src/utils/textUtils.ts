export function countWords(text: string): number {
  if (!text || text.trim().length === 0) return 0;

  // Remove extra whitespace and count words
  const words = text
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .filter(word => word.length > 0);

  return words.length;
}

export function formatWordCount(count: number): string {
  if (count === 0) return '0 words';
  if (count === 1) return '1 word';
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k words`;
  }
  return `${count.toLocaleString()} words`;
}

export function estimateReadingTime(wordCount: number): string {
  // Average reading speed: 200 words per minute
  const minutes = Math.ceil(wordCount / 200);
  if (minutes === 0) return '< 1 min read';
  if (minutes === 1) return '1 min read';
  return `${minutes} min read`;
}
