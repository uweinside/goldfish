import { defineConfig } from 'vite';
import { resolve } from 'path';

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
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'index.html'),
                timer: resolve(__dirname, 'timer.html'),
            },
        },
    },
});

