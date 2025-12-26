import { create } from 'zustand';
import type { Book } from '../lib/api';

interface BookState {
  currentBook: Book | null;
  generatingPage: boolean;
  completingBook: boolean;
  setCurrentBook: (book: Book | null) => void;
  setGeneratingPage: (status: boolean) => void;
  setCompletingBook: (status: boolean) => void;
}

export const useBookStore = create<BookState>((set) => ({
  currentBook: null,
  generatingPage: false,
  completingBook: false,
  setCurrentBook: (book) => set({ currentBook: book }),
  setGeneratingPage: (status) => set({ generatingPage: status }),
  setCompletingBook: (status) => set({ completingBook: status }),
}));
