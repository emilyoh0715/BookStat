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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recRef = useRef<any>(null);
  const onResultRef = useRef(onResult);

  useEffect(() => { onResultRef.current = onResult; });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getSR = (): any => typeof window !== 'undefined' ? ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) : undefined;
  const supported = !!getSR();

  const start = () => {
    const SR = getSR();
    if (!SR || listening) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rec = new (SR as any)();
    rec.lang = lang;
    rec.continuous = continuous;
    rec.interimResults = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
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
