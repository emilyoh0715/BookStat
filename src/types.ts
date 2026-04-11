export type ReadingStatus = 'reading' | 'want-to-read' | 'finished' | 'paused';

export type BookLanguage = 'korean' | 'english' | 'other';

export interface VocabEntry {
  id: string;
  word: string;
  meaning: string;
  sentence?: string;
  page?: number;
  createdAt: string;
}

export interface Note {
  id: string;
  content: string;
  page?: number;
  createdAt: string;
}

export interface Book {
  id: string;
  userId: string;
  title: string;
  author: string;
  publisher?: string;
  cover?: string;
  genre?: string;
  language: BookLanguage;
  totalPages?: number;
  currentPage?: number;
  status: ReadingStatus;
  rating?: number;
  review?: string;
  startDate?: string;
  finishDate?: string;
  createdAt: string;
  vocab: VocabEntry[];
  notes: Note[];
}
