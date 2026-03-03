// Vite configuration for React + Tailwind
// Using @vitejs/plugin-react-swc (SWC compiler) to avoid Babel TDZ issues.
// target: 'esnext' prevents Rollup from downcompiling ES modules in a way
// that causes "Cannot access 'X' before initialization" in production.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'esnext',
  },
});
