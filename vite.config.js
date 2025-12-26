import { defineConfig } from 'vite'

export default defineConfig({
  // Step 1) Set the root directory to serve files from
  root: '.',
  
  // Step 2) Set base path to relative for subdirectory deployment
  // This ensures assets use ./assets/ instead of /assets/
  // Required for deployment at blastingapps.com/dist/
  base: './',
  
  // Step 3) Configure the dev server
  server: {
    port: 5173,
    open: '/kirra.html', // Automatically open kirra.html when dev server starts
    host: true // Allow external connections
  },
  
  // Step 4) Configure build options
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: './kirra.html'
      }
    }
  },
  
  // Step 5) Configure public directory for static assets
  // Files in public/ are copied to dist/ root during build
  publicDir: 'public'
})
