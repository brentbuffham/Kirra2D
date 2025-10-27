import { defineConfig } from 'vite'

export default defineConfig({
  // Step 1) Set the root directory to serve files from
  root: '.',
  
  // Step 2) Configure the dev server
  server: {
    port: 5173,
    open: '/kirra.html', // Automatically open kirra.html when dev server starts
    host: true // Allow external connections
  },
  
  // Step 3) Configure build options
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: './kirra.html'
      }
    }
  },
  
  // Step 4) Configure public directory for static assets
  publicDir: 'public'
})
