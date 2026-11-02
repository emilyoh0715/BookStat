import { useCallback, useMemo, useSyncExternalStore } from 'react';

const eventName = 'bookstat-storage-change';
function subscribe(notify: () => void) {
  window.addEventListener('storage', notify);
  window.addEventListener(eventName, notify);
  return () => {
    window.removeEventListener('storage', notify);
    window.removeEventListener(eventName, notify);
  };
}
function parse(raw: string | null): Set<string> {
  try {
    const value: unknown = JSON.parse(raw ?? '[]');
    return new Set(Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []);
  } catch { return new Set(); }
}

export function useStoredSet(key: string) {
  const getSnapshot = useCallback(() => localStorage.getItem(key), [key]);
  const raw = useSyncExternalStore(subscribe, getSnapshot);
  const value = useMemo(() => parse(raw), [raw]);
  const setValue = useCallback((update: Set<string> | ((previous: Set<string>) => Set<string>)) => {
    const previous = localStorage.getItem(key);
    const next = JSON.stringify([...(typeof update === 'function' ? update(parse(previous)) : update)]);
    if (next === previous) return;
    localStorage.setItem(key, next);
    window.dispatchEvent(new Event(eventName));
  }, [key]);
  return [value, setValue] as const;
}
