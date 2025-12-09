import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, (process as any).cwd(), '');
  return {
    plugins: [react()],
    // This allows process.env to work if you are running locally with standard Node logic,
    // but Vercel prefers import.meta.env.VITE_API_KEY which is handled automatically by Vite.
    define: {
      'process.env.API_KEY': JSON.stringify(env.API_KEY),
      'process.env': {} 
    }
  }
})
