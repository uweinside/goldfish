import { defineConfig } from 'vite';

export default defineConfig({
    // Serve wwwroot at / so existing CSS and data paths are unchanged
    publicDir: 'wwwroot',
    server: {
        port: 1420,
        strictPort: true,
    },
    build: {
        outDir: 'dist',
        emptyOutDir: true,
    },
});

