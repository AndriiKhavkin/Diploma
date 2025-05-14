import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '^/printer': {
        target: 'http://localhost:8000', // де працює uvicorn
        changeOrigin: true,
      },
    },
  },
});
