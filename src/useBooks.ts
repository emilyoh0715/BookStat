import { useState, useEffect, useRef, useCallback } from 'react';
import type { Book, VocabEntry, Note, ReadingStatus, BookLanguage } from './types';
import { supabase } from './lib/supabase';

// DB row → Book 변환
function dbToBook(row: Record<string, unknown>): Book {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    title: row.title as string,
    author: row.author as string,
    publisher: row.publisher as string | undefined,
    cover: row.cover as string | undefined,
    genre: row.genre as string | undefined,
    language: (row.language as BookLanguage) ?? 'korean',
    totalPages: row.total_pages as number | undefined,
    currentPage: row.current_page as number | undefined,
    status: row.status as ReadingStatus,
    rating: row.rating as number | undefined,
    review: row.review as string | undefined,
    reviewCreatedAt: row.review_created_at as string | undefined,
    startDate: row.start_date as string | undefined,
    finishDate: row.finish_date as string | undefined,
    createdAt: row.created_at as string,
    vocab: (row.vocab as VocabEntry[]) ?? [],
    notes: (row.notes as Note[]) ?? [],
    childEmotion: row.child_emotion as string | undefined,
    childAnswers: row.child_answers as { question: string; answer: string }[] | undefined,
  };
}

// Book → DB row 변환
function bookToDb(book: Book) {
  return {
    id: book.id,
    user_id: book.userId,
    title: book.title,
    author: book.author,
    publisher: book.publisher ?? null,
    cover: book.cover ?? null,
    genre: book.genre ?? null,
    language: book.language,
    total_pages: book.totalPages ?? null,
    current_page: book.currentPage ?? null,
    status: book.status,
    rating: book.rating ?? null,
    review: book.review ?? null,
    review_created_at: book.reviewCreatedAt ?? null,
    start_date: book.startDate ?? null,
    finish_date: book.finishDate ?? null,
    created_at: book.createdAt,
    vocab: book.vocab,
    notes: book.notes,
    child_emotion: book.childEmotion ?? null,
    child_answers: book.childAnswers ?? null,
  };
}

function bookUpdatesToDb(updates: Partial<Book>) {
  const dbUpdates: Record<string, unknown> = {};

  if ('userId' in updates) dbUpdates.user_id = updates.userId;
  if ('title' in updates) dbUpdates.title = updates.title;
  if ('author' in updates) dbUpdates.author = updates.author;
  if ('publisher' in updates) dbUpdates.publisher = updates.publisher ?? null;
  if ('cover' in updates) dbUpdates.cover = updates.cover ?? null;
  if ('genre' in updates) dbUpdates.genre = updates.genre ?? null;
  if ('language' in updates) dbUpdates.language = updates.language;
  if ('totalPages' in updates) dbUpdates.total_pages = updates.totalPages ?? null;
  if ('currentPage' in updates) dbUpdates.current_page = updates.currentPage ?? null;
  if ('status' in updates) dbUpdates.status = updates.status;
  if ('rating' in updates) dbUpdates.rating = updates.rating ?? null;
  if ('review' in updates) dbUpdates.review = updates.review ?? null;
  if ('reviewCreatedAt' in updates) dbUpdates.review_created_at = updates.reviewCreatedAt ?? null;
  if ('startDate' in updates) dbUpdates.start_date = updates.startDate ?? null;
  if ('finishDate' in updates) dbUpdates.finish_date = updates.finishDate ?? null;
  if ('createdAt' in updates) dbUpdates.created_at = updates.createdAt;
  if ('vocab' in updates) dbUpdates.vocab = updates.vocab ?? [];
  if ('notes' in updates) dbUpdates.notes = updates.notes ?? [];
  if ('childEmotion' in updates) dbUpdates.child_emotion = updates.childEmotion ?? null;
  if ('childAnswers' in updates) dbUpdates.child_answers = updates.childAnswers ?? null;

  return dbUpdates;
}

export function useBooks() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const booksRef = useRef<Book[]>([]);
  const requestId = useRef(0);
  const pendingWrites = useRef(0);
  const accountVersion = useRef(0);
  const activeAccount = useRef<string | null>(null);
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  const setBooksAndRef = useCallback((next: Book[]) => {
    booksRef.current = next;
    setBooks(next);
  }, []);

  const refetchBooks = useCallback(async () => {
    const id = ++requestId.current;
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (id !== requestId.current) return;
      const account = session?.user.id ?? null;
      if (activeAccount.current !== account) { activeAccount.current = account; accountVersion.current++; }
      if (!session) { setBooksAndRef([]); return; }
      const { data, error } = await supabase.from('books').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      if (id === requestId.current && pendingWrites.current === 0) {
        setBooksAndRef((data ?? []).map(dbToBook));
        setError(null);
      }
    } catch {
      if (id === requestId.current) setError('서재에 연결하지 못했어요. 연결 상태를 확인하고 다시 시도해주세요.');
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [setBooksAndRef]);

  useEffect(() => {
    void refetchBooks();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const account = session?.user.id ?? null;
      if (activeAccount.current !== account) { activeAccount.current = account; accountVersion.current++; }
      // Schedule outside the auth callback to avoid waiting on its session lock.
      if (session) queueMicrotask(() => { void refetchBooks(); });
      else { ++requestId.current; setBooksAndRef([]); setLoading(false); }
    });
    const channel = supabase.channel('books-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'books' }, () => { void refetchBooks(); }).subscribe();
    const invalidate = () => { requestId.current += 1; };
    return () => { invalidate(); subscription.unsubscribe(); void supabase.removeChannel(channel); };
  }, [refetchBooks, setBooksAndRef]);

  // Serialize this client's edits. A failed request never rolls back unrelated books.
  const write = async (operation: (isCurrent: () => boolean) => Promise<void>): Promise<boolean> => {
    const version = accountVersion.current;
    const isCurrent = () => version === accountVersion.current;
    pendingWrites.current++;
    ++requestId.current;
    const result = queue.current.then(async () => {
      try {
        if (!isCurrent()) return false;
        await operation(isCurrent);
        if (!isCurrent()) return false;
        setError(null);
        return true;
      } catch {
        if (isCurrent()) setError('저장하지 못했어요. 입력한 내용을 확인하고 다시 시도해주세요.');
        return false;
      } finally { pendingWrites.current--; }
    });
    queue.current = result;
    return result;
  };

  const addBook = async (book: Omit<Book, 'id' | 'userId' | 'createdAt' | 'vocab' | 'notes'>, userId: string) => {
    const newBook: Book = { ...book, id: crypto.randomUUID(), userId, createdAt: new Date().toISOString(), vocab: [], notes: [] };
    const saved = await write(async isCurrent => {
      const { data, error } = await supabase.from('books').insert(bookToDb(newBook)).select('*').single();
      if (error) throw error;
      if (isCurrent()) setBooksAndRef([dbToBook(data), ...booksRef.current.filter(b => b.id !== newBook.id)]);
    });
    if (!saved) throw new Error('책을 저장하지 못했어요. 다시 시도해주세요.');
    return newBook.id;
  };

  const updateBook = (id: string, updates: Partial<Book>) => write(async isCurrent => {
    const current = booksRef.current.find(b => b.id === id);
    const normalized = { ...updates };
    if ('review' in normalized) {
      const next = normalized.review?.trim() ?? '';
      if (next && next !== (current?.review?.trim() ?? '') && !normalized.reviewCreatedAt) normalized.reviewCreatedAt = new Date().toISOString();
      if (!next) normalized.reviewCreatedAt = undefined;
    }
    const { data, error } = await supabase.from('books').update(bookUpdatesToDb(normalized)).eq('id', id).select('*').single();
    if (error) throw error;
    if (isCurrent()) setBooksAndRef(booksRef.current.map(b => b.id === id ? dbToBook(data) : b));
  });

  const deleteBook = (id: string) => write(async isCurrent => {
    const { data, error } = await supabase.from('books').delete().eq('id', id).select('id').single();
    if (error || !data) throw error ?? new Error('삭제할 책을 찾지 못했어요.');
    if (isCurrent()) setBooksAndRef(booksRef.current.filter(b => b.id !== id));
  });

  const editEntries = (bookId: string, field: 'vocab' | 'notes', edit: (book: Book) => VocabEntry[] | Note[]) => write(async isCurrent => {
    // Read the latest saved array before editing, including other-device changes.
    const { data: current, error: readError } = await supabase.from('books').select('*').eq('id', bookId).single();
    if (readError) throw readError;
    const { data, error } = await supabase.from('books').update({ [field]: edit(dbToBook(current)) }).eq('id', bookId).select('*').single();
    if (error) throw error;
    if (isCurrent()) setBooksAndRef(booksRef.current.map(b => b.id === bookId ? dbToBook(data) : b));
  });
  const addVocab = (bookId: string, entry: Omit<VocabEntry, 'id' | 'createdAt'>) => editEntries(bookId, 'vocab', book => [...book.vocab, { ...entry, id: crypto.randomUUID(), createdAt: new Date().toISOString() }]);
  const deleteVocab = (bookId: string, id: string) => editEntries(bookId, 'vocab', book => book.vocab.filter(v => v.id !== id));
  const addNote = (bookId: string, note: Omit<Note, 'id' | 'createdAt'>) => editEntries(bookId, 'notes', book => [...book.notes, { ...note, id: crypto.randomUUID(), createdAt: new Date().toISOString() }]);
  const deleteNote = (bookId: string, id: string) => editEntries(bookId, 'notes', book => book.notes.filter(n => n.id !== id));

  const getStats = (userId: string) => {
    const userBooks = books.filter(b => b.userId === userId);
    const finished = userBooks.filter(b => b.status === 'finished');
    const reading = userBooks.filter(b => b.status === 'reading');
    const paused = userBooks.filter(b => b.status === 'paused');
    const wantToRead = userBooks.filter(b => b.status === 'want-to-read');
    const avgRating = finished.filter(b => b.rating).reduce((acc, b, _, arr) =>
      acc + (b.rating || 0) / arr.length, 0);
    const reviewCount = userBooks.filter(b => b.review && b.review.trim().length > 0).length;
    return { finished: finished.length, reading: reading.length, paused: paused.length, wantToRead: wantToRead.length, avgRating, reviewCount };
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
    loading, error,
    addBook, updateBook, deleteBook,
    addVocab, deleteVocab,
    addNote, deleteNote,
    getStats, filterBooks, getYears, groupByYear,
    refetchBooks,
  };
}
