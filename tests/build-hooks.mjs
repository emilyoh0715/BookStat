import { build } from 'rolldown';
await build({
  input: 'src/useBooks.ts',
  external: ['react'],
  plugins: [{
    name: 'mock-supabase',
    resolveId(id) { if (id === './lib/supabase') return '\0test-supabase'; },
    load(id) { if (id === '\0test-supabase') return 'export const supabase = globalThis.__bookstatTestSupabase;'; },
  }],
  output: { file: 'node_modules/.tmp/test-useBooks.mjs', format: 'esm' },
});
