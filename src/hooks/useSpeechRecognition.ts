import { useState, useRef, useEffect } from 'react';

interface Options {
  lang?: string;
  continuous?: boolean;
  onResult: (text: string) => void;
}

interface Result {
  listening: boolean;
  supported: boolean;
  start: () => void;
  stop: () => void;
}

export function useSpeechRecognition({ lang = 'ko-KR', continuous = false, onResult }: Options): Result {
  const [listening, setListening] = useState(false);
  const recRef = useRef<SpeechRecognition | null>(null);
  const onResultRef = useRef(onResult);

  useEffect(() => { onResultRef.current = onResult; });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const SR = typeof window !== 'undefined' ? (window.SpeechRecognition || (window as any).webkitSpeechRecognition) as typeof SpeechRecognition | undefined : undefined;
  const supported = !!SR;

  const start = () => {
    if (!SR || listening) return;
    const rec = new SR();
    rec.lang = lang;
    rec.continuous = continuous;
    rec.interimResults = false;
    rec.onresult = (e: SpeechRecognitionEvent) => {
      let text = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) text += e.results[i][0].transcript;
      }
      if (text) onResultRef.current(text);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    rec.start();
    recRef.current = rec;
    setListening(true);
  };

  const stop = () => {
    recRef.current?.stop();
    setListening(false);
  };

  return { listening, start, stop, supported };
}
