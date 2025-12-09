import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, (process as any).cwd(), '');
  return {
    plugins: [react()],
    define: {
      // Only expose the specific API_KEY. 
      // DO NOT overwrite 'process.env': {} as it breaks many libraries (like supabase-js)
      'process.env.API_KEY': JSON.stringify(env.API_KEY)
    }
  }
})
