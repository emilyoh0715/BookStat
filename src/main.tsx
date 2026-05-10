import { StrictMode, Component, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './contexts/AuthContext.tsx'

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      const isChunkError = (this.state.error as Error & { name?: string }).name === 'ChunkLoadError'
        || (this.state.error as Error).message?.includes('Failed to fetch dynamically imported module')
        || (this.state.error as Error).message?.includes('Importing a module script failed');
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100dvh', padding: 24, textAlign: 'center', fontFamily: 'system-ui', gap: 16 }}>
          <div style={{ fontSize: 40 }}>📚</div>
          <p style={{ fontWeight: 700, fontSize: 17, margin: 0 }}>앱을 불러올 수 없어요</p>
          <p style={{ fontSize: 14, color: '#888', margin: 0 }}>
            {isChunkError ? '새 버전이 배포됐어요. 아래 버튼을 눌러 새로고침 해주세요.' : '잠시 후 다시 시도해주세요.'}
          </p>
          <button
            onClick={() => { localStorage.clear(); window.location.reload(); }}
            style={{ padding: '10px 24px', background: '#3b7fd4', color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: 'pointer' }}
          >
            새로고침
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ChunkLoadError 시 자동 새로고침 (1회)
window.addEventListener('unhandledrejection', (e) => {
  const msg = (e.reason as Error)?.message ?? '';
  if (msg.includes('Failed to fetch dynamically imported module') || msg.includes('Importing a module script failed')) {
    if (!sessionStorage.getItem('_chunk_reload')) {
      sessionStorage.setItem('_chunk_reload', '1');
      window.location.reload();
    }
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ErrorBoundary>
  </StrictMode>,
)
