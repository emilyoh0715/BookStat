import { useState, useEffect } from 'react';
import type { Book, VocabEntry, Note, ReadingStatus, BookLanguage } from './types';
import { supabase } from './lib/supabase';

// DB row → Book 변환
function dbToBook(row: Record<string, unknown>): Book {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    title: row.title as string,
    author: row.author as string,
    cover: row.cover as string | undefined,
    genre: row.genre as string | undefined,
    language: (row.language as BookLanguage) ?? 'korean',
    totalPages: row.total_pages as number | undefined,
    currentPage: row.current_page as number | undefined,
    status: row.status as ReadingStatus,
    rating: row.rating as number | undefined,
    review: row.review as string | undefined,
    startDate: row.start_date as string | undefined,
    finishDate: row.finish_date as string | undefined,
    createdAt: row.created_at as string,
    vocab: (row.vocab as VocabEntry[]) ?? [],
    notes: (row.notes as Note[]) ?? [],
  };
}

// Book → DB row 변환
function bookToDb(book: Book) {
  return {
    id: book.id,
    user_id: book.userId,
    title: book.title,
    author: book.author,
    cover: book.cover ?? null,
    genre: book.genre ?? null,
    language: book.language,
    total_pages: book.totalPages ?? null,
    current_page: book.currentPage ?? null,
    status: book.status,
    rating: book.rating ?? null,
    review: book.review ?? null,
    start_date: book.startDate ?? null,
    finish_date: book.finishDate ?? null,
    created_at: book.createdAt,
    vocab: book.vocab,
    notes: book.notes,
  };
}

export function useBooks() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);

  // 초기 로드 — 세션 준비 후 실행
  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoading(false); return; }
      const { data, error } = await supabase.from('books').select('*').order('created_at', { ascending: false });
      console.log('[useBooks] fetched:', data?.length, 'error:', error);
      if (data) setBooks(data.map(dbToBook));
      setLoading(false);
    };
    load();

    // 로그인/로그아웃 시 재로드
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('[useBooks] auth state change:', _event, !!session);
      if (session) load();
      else setBooks([]);
    });

    // 실시간 동기화 — 다른 가족이 추가/수정/삭제하면 자동 반영
    const channel = supabase
      .channel('books-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'books' }, () => {
        load();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, []);

  const addBook = async (book: Omit<Book, 'id' | 'userId' | 'createdAt' | 'vocab' | 'notes'>, userId: string) => {
    const newBook: Book = {
      ...book,
      id: Date.now().toString(),
      userId,
      createdAt: new Date().toISOString().split('T')[0],
      vocab: [],
      notes: [],
    };
    setBooks(prev => [newBook, ...prev]);
    await supabase.from('books').insert(bookToDb(newBook));
    return newBook.id;
  };

  const updateBook = async (id: string, updates: Partial<Book>) => {
    setBooks(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b));
    const book = books.find(b => b.id === id);
    if (!book) return;
    await supabase.from('books').update(bookToDb({ ...book, ...updates })).eq('id', id);
  };

  const deleteBook = async (id: string) => {
    setBooks(prev => prev.filter(b => b.id !== id));
    await supabase.from('books').delete().eq('id', id);
  };

  const addVocab = async (bookId: string, entry: Omit<VocabEntry, 'id' | 'createdAt'>) => {  // sentence is optional in VocabEntry
    const newEntry: VocabEntry = {
      ...entry,
      id: Date.now().toString(),
      createdAt: new Date().toISOString().split('T')[0],
    };
    setBooks(prev => prev.map(b => {
      if (b.id !== bookId) return b;
      const updated = { ...b, vocab: [...b.vocab, newEntry] };
      supabase.from('books').update({ vocab: updated.vocab }).eq('id', bookId);
      return updated;
    }));
  };

  const deleteVocab = async (bookId: string, vocabId: string) => {
    setBooks(prev => prev.map(b => {
      if (b.id !== bookId) return b;
      const updated = { ...b, vocab: b.vocab.filter(v => v.id !== vocabId) };
      supabase.from('books').update({ vocab: updated.vocab }).eq('id', bookId);
      return updated;
    }));
  };

  const addNote = async (bookId: string, note: Omit<Note, 'id' | 'createdAt'>) => {
    const newNote: Note = {
      ...note,
      id: Date.now().toString(),
      createdAt: new Date().toISOString().split('T')[0],
    };
    setBooks(prev => prev.map(b => {
      if (b.id !== bookId) return b;
      const updated = { ...b, notes: [...b.notes, newNote] };
      supabase.from('books').update({ notes: updated.notes }).eq('id', bookId);
      return updated;
    }));
  };

  const deleteNote = async (bookId: string, noteId: string) => {
    setBooks(prev => prev.map(b => {
      if (b.id !== bookId) return b;
      const updated = { ...b, notes: b.notes.filter(n => n.id !== noteId) };
      supabase.from('books').update({ notes: updated.notes }).eq('id', bookId);
      return updated;
    }));
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
    loading,
    addBook, updateBook, deleteBook,
    addVocab, deleteVocab,
    addNote, deleteNote,
    getStats, filterBooks, getYears, groupByYear,
  };
}
