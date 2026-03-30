import { useState, useEffect } from 'react';
import type { Book, VocabEntry, Note, ReadingStatus, BookLanguage } from './types';

const STORAGE_KEY = 'book-recorder-data';

const SAMPLE_BOOKS: Book[] = [
  {
    id: '1',
    userId: 'mom',
    title: '채식주의자',
    author: '한강',
    genre: '소설',
    language: 'korean',
    totalPages: 247,
    currentPage: 247,
    status: 'finished',
    rating: 5,
    review: '강렬하고 충격적인 이야기. 인간 본성과 폭력성에 대해 깊이 생각하게 만든다.',
    startDate: '2024-01-10',
    finishDate: '2024-01-20',
    createdAt: '2024-01-10',
    vocab: [
      { id: 'v1', word: '채식', meaning: '고기나 생선 없이 채소만 먹는 것', page: 12, createdAt: '2024-01-11' },
      { id: 'v2', word: '몽유병', meaning: '잠을 자면서 돌아다니는 병', page: 45, createdAt: '2024-01-13' },
    ],
    notes: [
      { id: 'n1', content: '꿈 장면이 매우 인상적. 식물이 되고자 하는 욕망이 자유에 대한 열망인가?', page: 89, createdAt: '2024-01-15' },
    ],
  },
  {
    id: '2',
    userId: 'mom',
    title: '82년생 김지영',
    author: '조남주',
    genre: '소설',
    language: 'korean',
    totalPages: 190,
    currentPage: 120,
    status: 'reading',
    startDate: '2024-02-01',
    createdAt: '2024-02-01',
    vocab: [],
    notes: [
      { id: 'n2', content: '한국 사회의 성차별 구조를 매우 현실적으로 묘사하고 있음', page: 55, createdAt: '2024-02-05' },
    ],
  },
  {
    id: '3',
    userId: 'dad',
    title: 'The Midnight Library',
    author: 'Matt Haig',
    genre: '소설',
    language: 'english',
    totalPages: 304,
    currentPage: 304,
    status: 'finished',
    rating: 4,
    review: 'A beautiful story about second chances and the infinite possibilities of life.',
    startDate: '2023-11-01',
    finishDate: '2023-11-15',
    createdAt: '2023-11-01',
    vocab: [
      { id: 'v3', word: 'mundane', meaning: '세속적인, 평범한 (일상적이고 특별하지 않은)', page: 23, createdAt: '2023-11-03' },
      { id: 'v4', word: 'regret', meaning: '후회, 유감 (과거의 행동을 아쉬워하는 감정)', page: 45, createdAt: '2023-11-05' },
    ],
    notes: [
      { id: 'n3', content: 'The metaphor of the library as infinite lives is brilliant', page: 60, createdAt: '2023-11-08' },
    ],
  },
  {
    id: '4',
    userId: 'suyeon',
    title: '아몬드',
    author: '손원평',
    genre: '소설',
    language: 'korean',
    totalPages: 264,
    status: 'want-to-read',
    createdAt: '2025-01-05',
    vocab: [],
    notes: [],
  },
  {
    id: '5',
    userId: 'dad',
    title: 'Atomic Habits',
    author: 'James Clear',
    genre: '자기계발',
    language: 'english',
    totalPages: 320,
    currentPage: 180,
    status: 'reading',
    startDate: '2025-02-10',
    createdAt: '2025-02-10',
    vocab: [
      { id: 'v5', word: 'compound', meaning: '복리의, 복합적인 (작은 변화들이 쌓여 큰 결과를 만드는)', page: 15, createdAt: '2025-02-12' },
    ],
    notes: [],
  },
];

function loadBooks(): Book[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      const parsed = JSON.parse(data) as Book[];
      // Migrate old books without language field
      return parsed.map(b => ({ ...b, language: b.language ?? ('korean' as BookLanguage) }));
    }
  } catch {}
  return SAMPLE_BOOKS;
}

function saveBooks(books: Book[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(books));
}

export function useBooks() {
  const [books, setBooks] = useState<Book[]>(loadBooks);

  useEffect(() => {
    saveBooks(books);
  }, [books]);

  const addBook = (book: Omit<Book, 'id' | 'userId' | 'createdAt' | 'vocab' | 'notes'>, userId: string) => {
    const newBook: Book = {
      ...book,
      id: Date.now().toString(),
      userId,
      createdAt: new Date().toISOString().split('T')[0],
      vocab: [],
      notes: [],
    };
    setBooks(prev => [newBook, ...prev]);
    return newBook.id;
  };

  const updateBook = (id: string, updates: Partial<Book>) => {
    setBooks(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b));
  };

  const deleteBook = (id: string) => {
    setBooks(prev => prev.filter(b => b.id !== id));
  };

  const addVocab = (bookId: string, entry: Omit<VocabEntry, 'id' | 'createdAt'>) => {  // sentence is optional in VocabEntry
    const newEntry: VocabEntry = {
      ...entry,
      id: Date.now().toString(),
      createdAt: new Date().toISOString().split('T')[0],
    };
    setBooks(prev => prev.map(b =>
      b.id === bookId ? { ...b, vocab: [...b.vocab, newEntry] } : b
    ));
  };

  const deleteVocab = (bookId: string, vocabId: string) => {
    setBooks(prev => prev.map(b =>
      b.id === bookId ? { ...b, vocab: b.vocab.filter(v => v.id !== vocabId) } : b
    ));
  };

  const addNote = (bookId: string, note: Omit<Note, 'id' | 'createdAt'>) => {
    const newNote: Note = {
      ...note,
      id: Date.now().toString(),
      createdAt: new Date().toISOString().split('T')[0],
    };
    setBooks(prev => prev.map(b =>
      b.id === bookId ? { ...b, notes: [...b.notes, newNote] } : b
    ));
  };

  const deleteNote = (bookId: string, noteId: string) => {
    setBooks(prev => prev.map(b =>
      b.id === bookId ? { ...b, notes: b.notes.filter(n => n.id !== noteId) } : b
    ));
  };

  const getStats = (userId: string) => {
    const userBooks = books.filter(b => b.userId === userId);
    const finished = userBooks.filter(b => b.status === 'finished');
    const reading = userBooks.filter(b => b.status === 'reading');
    const wantToRead = userBooks.filter(b => b.status === 'want-to-read');
    const totalVocab = userBooks.reduce((acc, b) => acc + b.vocab.length, 0);
    const totalNotes = userBooks.reduce((acc, b) => acc + b.notes.length, 0);
    const avgRating = finished.filter(b => b.rating).reduce((acc, b, _, arr) =>
      acc + (b.rating || 0) / arr.length, 0);
    return { finished: finished.length, reading: reading.length, wantToRead: wantToRead.length, totalVocab, totalNotes, avgRating };
  };

  const getYears = (userId: string): number[] => {
    const years = new Set<number>();
    books.filter(b => b.userId === userId).forEach(b => {
      const dateStr = b.finishDate ?? b.startDate ?? b.createdAt;
      const year = new Date(dateStr).getFullYear();
      if (!isNaN(year)) years.add(year);
    });
    return Array.from(years).sort((a, b) => b - a);
  };

  const getBookYear = (book: Book): number => {
    const dateStr = book.finishDate ?? book.startDate ?? book.createdAt;
    return new Date(dateStr).getFullYear();
  };

  const filterBooks = (
    userId: string,
    status: ReadingStatus | 'all',
    language: BookLanguage | 'all',
    year: number | 'all',
    search: string
  ) => {
    return books.filter(b => {
      const matchUser = b.userId === userId;
      const matchStatus = status === 'all' || b.status === status;
      const matchLang = language === 'all' || b.language === language;
      const matchYear = year === 'all' || getBookYear(b) === year;
      const matchSearch = !search ||
        b.title.toLowerCase().includes(search.toLowerCase()) ||
        b.author.toLowerCase().includes(search.toLowerCase());
      return matchUser && matchStatus && matchLang && matchYear && matchSearch;
    });
  };

  const groupByYear = (filteredBooks: Book[]): Map<number, Book[]> => {
    const map = new Map<number, Book[]>();
    filteredBooks.forEach(b => {
      const year = getBookYear(b);
      if (!map.has(year)) map.set(year, []);
      map.get(year)!.push(b);
    });
    return new Map([...map.entries()].sort((a, b) => b[0] - a[0]));
  };

  return {
    books,
    addBook, updateBook, deleteBook,
    addVocab, deleteVocab,
    addNote, deleteNote,
    getStats, filterBooks, getYears, groupByYear,
  };
}
